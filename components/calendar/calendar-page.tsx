"use client";

// Trang Lịch: điều hướng (Hôm nay / trước / sau), chế độ (tháng/tuần/ngày + lịch dùng chung theo team), lọc loại
// (Meeting/Call/Task, nhớ ở trình duyệt), xem lịch của người khác (`?userId=`). Chế độ Timeline vẫn mở ở classic.
// Tương đương `crm:views/calendar/calendar-page` + `mode-buttons` của classic.
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { Button } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { calendarColors, calendarDefs, calendarScopes, customViews, DEFAULT_MODE, MODE_VIEWS, resolveMode } from "@/lib/espo/calendar";
import { classicHref } from "@/lib/espo/routes";
import type { CalendarHandle, CalendarRange } from "./calendar-view";

// FullCalendar chỉ chạy phía trình duyệt.
const CalendarView = dynamic(() => import("./calendar-view").then((module) => module.CalendarView), {
  ssr: false,
  loading: () => <LoadingBlock />,
});

const MODE_KEY = "espo-next-calendar-mode";
const SCOPES_KEY = "espo-next-calendar-scopes";

function readStorage<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Không lưu được thì chỉ nhớ trong phiên này.
  }
}

export function CalendarPage() {
  const ctx = useFieldContext();

  if (!ctx) {
    return <LoadingBlock />;
  }

  if (!ctx.acl.checkScope("Calendar")) {
    return <PageMessage icon="fas fa-lock" title={ctx.t("Access denied")} />;
  }

  return <CalendarContent ctx={ctx} />;
}

function CalendarContent({ ctx }: { ctx: FieldContext }) {
  const { t, metadata, acl, settings, preferences } = ctx;
  const params = useSearchParams();
  const userId = params.get("userId");
  const userName = params.get("userName");
  const scopes = useMemo(() => calendarScopes(settings, metadata, acl), [settings, metadata, acl]);
  const views = useMemo(() => (userId || acl.getPermissionLevel("userCalendar") === "no" ? [] : customViews(preferences)), [userId, acl, preferences]);
  const modeList = (calendarDefs(metadata).modeList ?? ["month", "agendaWeek", "agendaDay"]).filter((mode) => mode === "timeline" || MODE_VIEWS[mode]);
  const colors = useMemo(() => calendarColors(metadata, scopes), [metadata, scopes]);
  const [mode, setMode] = useState(() => {
    const fromUrl = params.get("mode");
    const stored = userId ? null : readStorage<string>(MODE_KEY);
    const candidate = fromUrl ?? stored ?? DEFAULT_MODE;

    return MODE_VIEWS[candidate] || (candidate.startsWith("view-") && views.some((view) => `view-${view.id}` === candidate)) ? candidate : DEFAULT_MODE;
  });
  const [enabled, setEnabled] = useState<string[]>(() => {
    const stored = readStorage<string[]>(SCOPES_KEY);

    return Array.isArray(stored) ? stored.filter((scope) => scopes.includes(scope)) : scopes;
  });
  const [range, setRange] = useState<CalendarRange | null>(null);
  const [loading, setLoading] = useState(false);
  const calendar = useRef<CalendarHandle>(null);
  // Ngày ban đầu chỉ đọc một lần (sau đó lịch tự giữ ngày đang xem).
  const [initialDate] = useState(() => params.get("date"));
  const resolved = resolveMode(mode, views);

  useEffect(() => {
    document.title = `${t("Calendar", "scopeNames")} · ${settings.applicationName || "EspoCRM"}`;
  }, [t, settings.applicationName]);

  // Giữ chế độ + ngày trên URL (mở lại/chia sẻ được), không điều hướng lại trang.
  useEffect(() => {
    if (!range) {
      return;
    }

    const query = new URLSearchParams();

    query.set("mode", mode);
    query.set("date", range.date);

    if (userId) {
      query.set("userId", userId);

      if (userName) {
        query.set("userName", userName);
      }
    }

    window.history.replaceState(null, "", `/Calendar?${query.toString()}`);
  }, [mode, range, userId, userName]);

  function selectMode(next: string) {
    const target = resolveMode(next, views);

    setMode(next);
    calendar.current?.api()?.changeView(MODE_VIEWS[target.viewMode]);

    if (!userId) {
      writeStorage(MODE_KEY, next);
    }
  }

  function toggleScope(scope: string) {
    const next = enabled.includes(scope) ? enabled.filter((item) => item !== scope) : scopes.filter((item) => item === scope || enabled.includes(item));

    setEnabled(next);
    writeStorage(SCOPES_KEY, next);
  }

  const modeButtons = modeList.map((item) => ({ mode: item, label: t(item, "modes", "Calendar") }));
  const viewItems: MenuItem[] = views.map((view) => ({
    label: view.name,
    checked: mode === `view-${view.id}`,
    onSelect: () => selectMode(`view-${view.id}`),
  }));

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[32rem] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            onClick={() => (range?.isToday ? calendar.current?.refetch() : calendar.current?.api()?.today())}
            aria-pressed={range?.isToday}
            className={range?.isToday ? "bg-slate-100" : ""}
          >
            {t("Today", "labels", "Calendar")}
          </Button>
          <div className="inline-flex">
            <Button className="rounded-r-none" aria-label={t("Previous Page", "labels")} onClick={() => calendar.current?.api()?.prev()}>
              <i className="fas fa-chevron-left text-xs" aria-hidden />
            </Button>
            <Button className="-ml-px rounded-l-none" aria-label={t("Next Page", "labels")} onClick={() => calendar.current?.api()?.next()}>
              <i className="fas fa-chevron-right text-xs" aria-hidden />
            </Button>
          </div>
          <h1 className="truncate text-xl font-semibold tracking-tight" aria-live="polite">
            {range?.title ?? t("Calendar", "scopeNames")}
            {resolved.view && <span className="ml-2 text-sm font-normal text-slate-500">· {resolved.view.name}</span>}
          </h1>
          {loading && <i className="fas fa-circle-notch fa-spin text-sm text-slate-400" aria-label={t("Loading...")} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("View")} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
            {modeButtons.map((item) =>
              item.mode === "timeline" ? (
                <a
                  key={item.mode}
                  href={classicHref(`#Calendar/show/mode=timeline${userId ? `&userId=${encodeURIComponent(userId)}` : ""}`)}
                  title="EspoCRM Classic"
                  className="inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-sm text-slate-500 hover:text-slate-800"
                >
                  {item.label}
                  <i className="fas fa-external-link-alt text-[10px]" aria-hidden />
                </a>
              ) : (
                <button
                  key={item.mode}
                  type="button"
                  aria-pressed={mode === item.mode}
                  onClick={() => selectMode(item.mode)}
                  className={`inline-flex h-8 items-center rounded-md px-2.5 text-sm ${
                    mode === item.mode ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                </button>
              ),
            )}
          </div>
          {viewItems.length > 0 && (
            <Menu
              label={t("Shared", "labels", "Calendar")}
              trigger={
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <i className="fas fa-users text-xs" aria-hidden />
                  {t("Shared", "labels", "Calendar")}
                </span>
              }
              triggerClassName={`inline-flex h-9 items-center rounded-lg border px-3 shadow-xs ${
                resolved.view ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
              items={viewItems}
            />
          )}
          <Menu
            label={t("Filter")}
            trigger={
              <span className="inline-flex items-center gap-1.5 text-sm">
                <i className="fas fa-filter text-xs" aria-hidden />
                <span className="hidden sm:inline">{t("Filter")}</span>
                {enabled.length < scopes.length && <span className="rounded-full bg-blue-600 px-1.5 text-xs text-white">{enabled.length}</span>}
              </span>
            }
            triggerClassName="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-slate-600 shadow-xs hover:bg-slate-50"
            items={scopes.map((scope) => ({
              label: t(scope, "scopeNamesPlural"),
              checked: enabled.includes(scope),
              onSelect: () => toggleScope(scope),
            }))}
          />
          <Button aria-label={t("Refresh")} title={t("Refresh")} onClick={() => calendar.current?.refetch()}>
            <i className="fas fa-sync-alt text-xs" aria-hidden />
          </Button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-slate-600" aria-label={t("Filter")}>
        {scopes
          .filter((scope) => enabled.includes(scope))
          .map((scope) => (
            <li key={scope} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: colors[scope] }} aria-hidden />
              {t(scope, "scopeNamesPlural")}
            </li>
          ))}
      </ul>

      <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
        <CalendarView
          ref={calendar}
          ctx={ctx}
          viewMode={resolved.viewMode}
          initialDate={initialDate}
          scopes={enabled}
          allScopes={scopes}
          userId={userId}
          userName={userName}
          teamIdList={resolved.teamIdList}
          onRangeChange={setRange}
          onLoading={setLoading}
        />
      </div>
    </div>
  );
}
