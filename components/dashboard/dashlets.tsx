"use client";

// Các dashlet của Dashboard: Stream, danh sách bản ghi (Records, Tasks, Cases, Leads, Opportunities, Meetings, Calls),
// Activities sắp tới, Emails, Calendar, Memo, Iframe. Dashlet chưa làm (biểu đồ) có link mở classic.
// Port từ `views/dashlets/*` và `crm:views/dashlets/*` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CalendarHandle } from "@/components/calendar/calendar-view";
import { LoadingBlock } from "@/components/record/scope-gate";
import { translateOption } from "@/components/fields/basic";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { ScopeIcon } from "@/components/shell/scope-icon";
import { UserStreamList } from "@/components/stream/user-stream";
import { Markdown } from "@/components/ui/markdown";
import { listUpcomingActivities } from "@/lib/espo/activities";
import { calendarScopes, MODE_VIEWS } from "@/lib/espo/calendar";
import {
  autorefreshMs,
  dashletEntityType,
  dashletSearchParams,
  expandedLayoutFields,
  type DashletLayoutItem,
  type DashletOptions,
  type ExpandedLayout,
} from "@/lib/espo/dashboard";
import { getFieldDefs, getSelectAttributes, isFieldAvailable } from "@/lib/espo/entity";
import { emailIsRead, folderWhere, FOLDER } from "@/lib/espo/email";
import { listRecords, type EspoRecord } from "@/lib/espo/records";
import { ShortDateTime } from "@/components/stream/note-item";
import { classicHref, recordCreateHref, recordViewHref, scopeListHref } from "@/lib/espo/routes";

export type DashletProps = { ctx: FieldContext; item: DashletLayoutItem; options: DashletOptions };

/** Khung dashlet: tiêu đề, nút làm mới/tạo, thân cuộn trong chiều cao cố định. */
export function DashletFrame({
  ctx,
  item,
  title,
  actions,
  onRefresh,
  children,
}: {
  ctx: FieldContext;
  item: DashletLayoutItem;
  title: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  children: ReactNode;
}) {
  const headingId = `dashlet-${item.id}`;

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <div className="flex min-h-11 shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-4 py-1.5">
        <h2 id={headingId} className="truncate text-sm font-semibold text-slate-800">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label={`${ctx.t("Refresh")}: ${title}`}
              title={ctx.t("Refresh")}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <i className="fas fa-sync-alt text-xs" aria-hidden />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

function dashletTitle(ctx: FieldContext, item: DashletLayoutItem, options: DashletOptions): string {
  return typeof options.title === "string" && options.title ? options.title : ctx.t(item.name, "dashlets");
}

function Empty({ ctx, loading }: { ctx: FieldContext; loading: boolean }) {
  return <p className="px-4 py-4 text-sm text-slate-500">{loading ? ctx.t("Loading...") : ctx.t("No Data")}</p>;
}

// ——— Stream ———

export function StreamDashlet({ ctx, item, options }: DashletProps) {
  const queryClient = useQueryClient();

  return (
    <DashletFrame
      ctx={ctx}
      item={item}
      title={dashletTitle(ctx, item, options)}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["stream", "@user"] })}
      actions={
        <Link href="/stream" aria-label={ctx.t("View")} title={ctx.t("View")} className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <i className="fas fa-external-link-alt text-xs" aria-hidden />
        </Link>
      }
    >
      <UserStreamList
        ctx={ctx}
        maxSize={typeof options.displayRecords === "number" ? options.displayRecords : 10}
        skipOwn={!!options.skipOwn}
        queryKeyExtra={[item.id]}
        refetchInterval={autorefreshMs(options)}
        compact
      />
    </DashletFrame>
  );
}

// ——— Danh sách bản ghi ———

const DEFAULT_EXPANDED: ExpandedLayout = { rows: [[{ name: "name", link: true }]] };

function RecordRows({ ctx, scope, layout, records }: { ctx: FieldContext; scope: string; layout: ExpandedLayout; records: EspoRecord[] }) {
  const rows = layout.rows
    .map((row) => row.filter((cell) => cell?.name && isFieldAvailable(ctx.metadata, scope, cell.name) && ctx.acl.checkField(scope, cell.name)))
    .filter((row) => row.length);

  return (
    <ul className="divide-y divide-slate-100">
      {records.map((record) => (
        <li key={record.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 ${rowIndex > 0 ? "text-xs text-slate-500" : ""}`}>
              {row.map((cell) => {
                const defs = getFieldDefs(ctx.metadata, scope, cell.name);

                if (cell.link) {
                  return (
                    <Link key={cell.name} href={recordViewHref(scope, record.id, ctx.metadata)} className="min-w-0 font-medium break-words text-blue-700 hover:underline">
                      {String(record[cell.name] ?? record.name ?? "") || record.id}
                    </Link>
                  );
                }

                if (!defs) {
                  return null;
                }

                if (defs.type === "enum" && typeof record[cell.name] === "string" && record[cell.name]) {
                  return (
                    <Badge key={cell.name} style={defs.style?.[String(record[cell.name])] ?? null}>
                      {translateOption(ctx, scope, cell.name, defs, String(record[cell.name]))}
                    </Badge>
                  );
                }

                return (
                  <span key={cell.name} className={cell.soft ? "text-slate-500" : ""}>
                    <FieldValue ctx={ctx} scope={scope} name={cell.name} defs={defs} values={record} mode="list" />
                  </span>
                );
              })}
            </div>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function RecordsDashlet({ ctx, item, options }: DashletProps) {
  const queryClient = useQueryClient();
  const scope = dashletEntityType(ctx.metadata, item.name, options);
  const layout = options.expandedLayout?.rows?.length ? options.expandedLayout : DEFAULT_EXPANDED;
  const allowed = !!scope && ctx.acl.checkScope(scope, "read");
  const params = scope ? dashletSearchParams(options, { metadata: ctx.metadata, scope, timeZone: ctx.dateTime.getTimeZone() }) : {};
  const select = scope ? getSelectAttributes(ctx.metadata, scope, ["name", ...expandedLayoutFields(layout)]) : [];
  const queryKey = ["dashlet", item.id, scope, params, select];
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) => listRecords(scope!, { ...params, select }, signal),
    enabled: allowed,
    placeholderData: keepPreviousData,
    refetchInterval: autorefreshMs(options),
  });
  const title = dashletTitle(ctx, item, options);

  if (!scope || !allowed) {
    return (
      <DashletFrame ctx={ctx} item={item} title={title}>
        <p className="px-4 py-4 text-sm text-slate-500">{scope ? ctx.t("No Access") : ctx.t("selectEntityType", "messages", "DashletOptions")}</p>
      </DashletFrame>
    );
  }

  const canCreate = ctx.acl.checkScope(scope, "create");
  const createAttributes = options.populateAssignedUser ? { assignedUserId: ctx.user.id, assignedUserName: ctx.user.name ?? ctx.user.userName } : null;

  return (
    <DashletFrame
      ctx={ctx}
      item={item}
      title={title}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["dashlet", item.id] })}
      actions={
        <>
          {canCreate && (
            <Link
              href={`${recordCreateHref(scope, ctx.metadata)}${createAttributes ? `?${new URLSearchParams({ attributes: JSON.stringify(createAttributes) })}` : ""}`}
              aria-label={`${ctx.t("Create")}: ${ctx.t(scope, "scopeNames")}`}
              title={ctx.t("Create")}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <i className="fas fa-plus text-xs" aria-hidden />
            </Link>
          )}
          <Link
            href={scopeListHref(scope, ctx.metadata)}
            aria-label={`${ctx.t("View List")}: ${ctx.t(scope, "scopeNamesPlural")}`}
            title={ctx.t("View List")}
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <i className="fas fa-align-justify text-xs" aria-hidden />
          </Link>
        </>
      }
    >
      {list.data?.list.length ? (
        <RecordRows ctx={ctx} scope={scope} layout={layout} records={list.data.list} />
      ) : (
        <Empty ctx={ctx} loading={list.isLoading} />
      )}
    </DashletFrame>
  );
}

// ——— Activities ———

export function ActivitiesDashlet({ ctx, item, options }: DashletProps) {
  const queryClient = useQueryClient();
  const entityTypeList = (Array.isArray(options.enabledScopeList) ? options.enabledScopeList.map(String) : ["Meeting", "Call", "Task"]).filter(
    (scope) => ctx.acl.checkScope(scope, "read") && !ctx.metadata.scopes?.[scope]?.disabled,
  );
  const params = {
    maxSize: typeof options.displayRecords === "number" ? options.displayRecords : 10,
    entityTypeList,
    futureDays: typeof options.futureDays === "number" ? options.futureDays : 3,
    includeShared: !!options.includeShared,
  };
  const list = useQuery({
    queryKey: ["dashlet", item.id, params],
    queryFn: ({ signal }) => listUpcomingActivities(params, signal),
    enabled: entityTypeList.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: autorefreshMs(options),
  });

  return (
    <DashletFrame ctx={ctx} item={item} title={dashletTitle(ctx, item, options)} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["dashlet", item.id] })}>
      {list.data?.list.length ? (
        <ul className="divide-y divide-slate-100">
          {list.data.list.map((record) => {
            const scope = String(record._scope ?? "");
            const clientDefs = ctx.metadata.clientDefs?.[scope];
            const date = (record.dateStart ?? record.dateEnd ?? record.dateStartDate ?? record.dateEndDate) as string | null;
            const statusDefs = getFieldDefs(ctx.metadata, scope, "status");

            return (
              <li key={`${scope}-${record.id}`} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="mt-0.5 text-slate-400" title={ctx.t(scope, "scopeNames")}>
                  <ScopeIcon iconClass={clientDefs?.iconClass ?? null} color={clientDefs?.color ?? null} label={ctx.t(scope, "scopeNames")} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={recordViewHref(scope, record.id, ctx.metadata)} className="block truncate font-medium text-blue-700 hover:underline">
                    {String(record.name ?? "") || record.id}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                    {date && <span>{date.length > 10 ? ctx.dateTime.toDisplay(date) : ctx.dateTime.toDisplayDate(date)}</span>}
                    {statusDefs && typeof record.status === "string" && (
                      <Badge style={statusDefs.style?.[record.status] ?? null}>{translateOption(ctx, scope, "status", statusDefs, record.status)}</Badge>
                    )}
                    {typeof record.parentName === "string" && record.parentName && <span>{record.parentName}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty ctx={ctx} loading={list.isLoading && entityTypeList.length > 0} />
      )}
    </DashletFrame>
  );
}

// ——— Emails ———

/** Email trong một thư mục (mặc định Inbox), như `views/dashlets/emails`. */
export function EmailsDashlet({ ctx, item, options }: DashletProps) {
  const queryClient = useQueryClient();
  const folder = typeof options.folder === "string" && options.folder ? options.folder : FOLDER.inbox;
  const maxSize = typeof options.displayRecords === "number" ? options.displayRecords : 5;
  const list = useQuery({
    queryKey: ["dashlet", item.id, "emails", folder, maxSize],
    queryFn: ({ signal }) =>
      listRecords(
        "Email",
        {
          where: folderWhere(folder),
          orderBy: "dateSent",
          order: "desc",
          maxSize,
          select: ["name", "subject", "dateSent", "personStringData", "isRead", "isImportant", "sentById", "hasAttachment"],
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    refetchInterval: autorefreshMs(options),
  });
  const iconLink = "inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700";

  return (
    <DashletFrame
      ctx={ctx}
      item={item}
      title={dashletTitle(ctx, item, options)}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ["dashlet", item.id] })}
      actions={
        <>
          {ctx.acl.checkScope("Email", "create") && (
            <Link href="/Email/compose" aria-label={ctx.t("Compose Email", "labels")} title={ctx.t("Compose Email", "labels")} className={iconLink}>
              <i className="fas fa-plus text-xs" aria-hidden />
            </Link>
          )}
          <Link
            href={folder === FOLDER.inbox ? "/Email" : `/Email?folder=${encodeURIComponent(folder)}`}
            aria-label={`${ctx.t("View List")}: ${ctx.t("Email", "scopeNamesPlural")}`}
            title={ctx.t("View List")}
            className={iconLink}
          >
            <i className="fas fa-align-justify text-xs" aria-hidden />
          </Link>
        </>
      }
    >
      {list.data?.list.length ? (
        <ul className="divide-y divide-slate-100">
          {list.data.list.map((record) => {
            const read = emailIsRead(record, ctx.user.id);

            return (
              <li key={record.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm">
                <Link
                  href={recordViewHref("Email", record.id, ctx.metadata)}
                  className={`truncate hover:underline ${read ? "text-blue-700" : "font-semibold text-blue-800"}`}
                >
                  {String(record.name ?? "") || ctx.t("No Subject", "labels", "Email")}
                </Link>
                <span className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                  <ShortDateTime ctx={ctx} value={typeof record.dateSent === "string" ? record.dateSent : null} />
                  <span className="truncate">{String(record.personStringData ?? "")}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty ctx={ctx} loading={list.isLoading} />
      )}
    </DashletFrame>
  );
}

// ——— Calendar ———

const CalendarView = dynamic(() => import("@/components/calendar/calendar-view").then((module) => module.CalendarView), {
  ssr: false,
  loading: () => <LoadingBlock />,
});

/** Lịch thu nhỏ (`crm:views/dashlets/calendar`): chế độ, loại và team theo tuỳ chọn; Timeline mở ở classic. */
export function CalendarDashlet({ ctx, item, options }: DashletProps) {
  const calendar = useRef<CalendarHandle>(null);
  const [title, setTitle] = useState<string | null>(null);
  const mode = typeof options.mode === "string" ? options.mode : "basicWeek";
  const scopes = calendarScopes(ctx.settings, ctx.metadata, ctx.acl);
  const enabled = (Array.isArray(options.enabledScopeList) ? options.enabledScopeList.map(String) : scopes).filter((scope) => scopes.includes(scope));
  const teams = ["basicWeek", "month", "basicDay"].includes(mode) && Array.isArray(options.teamsIds) && options.teamsIds.length ? options.teamsIds.map(String) : null;
  const refresh = autorefreshMs(options);
  const baseTitle = dashletTitle(ctx, item, options);
  const iconButton = "inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700";

  useEffect(() => {
    if (!refresh) {
      return;
    }

    const timer = window.setInterval(() => calendar.current?.refetch(), refresh);

    return () => window.clearInterval(timer);
  }, [refresh]);

  if (mode === "timeline" || !MODE_VIEWS[mode]) {
    return <ClassicDashlet ctx={ctx} item={item} options={options} />;
  }

  return (
    <DashletFrame
      ctx={ctx}
      item={item}
      title={mode === "month" && title ? `${baseTitle} › ${title}` : baseTitle}
      onRefresh={() => calendar.current?.refetch()}
      actions={
        <>
          <button type="button" className={iconButton} aria-label={ctx.t("Previous Page", "labels")} onClick={() => calendar.current?.api()?.prev()}>
            <i className="fas fa-chevron-left text-xs" aria-hidden />
          </button>
          <button type="button" className={iconButton} aria-label={ctx.t("Next Page", "labels")} onClick={() => calendar.current?.api()?.next()}>
            <i className="fas fa-chevron-right text-xs" aria-hidden />
          </button>
          <Link href="/Calendar" aria-label={ctx.t("View Calendar", "labels", "Calendar")} title={ctx.t("View Calendar", "labels", "Calendar")} className={iconButton}>
            <i className="far fa-calendar-alt text-xs" aria-hidden />
          </Link>
        </>
      }
    >
      <div className="espo-calendar-dashlet h-full p-1">
        <CalendarView
          ref={calendar}
          ctx={ctx}
          viewMode={mode}
          initialDate={null}
          scopes={enabled}
          allScopes={scopes}
          teamIdList={teams}
          onRangeChange={(range) => setTitle(range.title)}
        />
      </div>
    </DashletFrame>
  );
}

// ——— Memo, Iframe ———

export function MemoDashlet({ ctx, item, options }: DashletProps) {
  const text = typeof options.text === "string" ? options.text : "";

  return (
    <DashletFrame ctx={ctx} item={item} title={dashletTitle(ctx, item, options)}>
      <div className="px-4 py-3">{text ? <Markdown text={text} className="text-sm" /> : <Empty ctx={ctx} loading={false} />}</div>
    </DashletFrame>
  );
}

export function IframeDashlet({ ctx, item, options }: DashletProps) {
  const url = typeof options.url === "string" && /^https?:\/\//i.test(options.url) ? options.url : null;

  return (
    <DashletFrame ctx={ctx} item={item} title={dashletTitle(ctx, item, options)}>
      {url ? (
        <iframe src={url} title={dashletTitle(ctx, item, options)} className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
      ) : (
        <Empty ctx={ctx} loading={false} />
      )}
    </DashletFrame>
  );
}

/** Dashlet chưa làm trên UI mới (biểu đồ, Timeline): mở dashboard classic. */
export function ClassicDashlet({ ctx, item, options }: DashletProps) {
  return (
    <DashletFrame ctx={ctx} item={item} title={dashletTitle(ctx, item, options)}>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-sm text-slate-500">
        <i className="fas fa-chart-bar text-2xl text-slate-300" aria-hidden />
        <a href={classicHref("#")} className="font-medium text-blue-600 hover:underline">
          <i className="fas fa-external-link-alt mr-1.5 text-xs" aria-hidden />
          EspoCRM Classic
        </a>
      </div>
    </DashletFrame>
  );
}

/** Chọn component theo tên dashlet (hoặc theo `entityType` cho dashlet danh sách tự tạo). */
export function dashletComponent(ctx: FieldContext, name: string): (props: DashletProps) => ReactNode {
  switch (name) {
    case "Stream":
      return StreamDashlet;
    case "Activities":
      return ActivitiesDashlet;
    case "Memo":
      return MemoDashlet;
    case "Iframe":
      return IframeDashlet;
    case "Records":
      return RecordsDashlet;
    case "Emails":
      return EmailsDashlet;
    case "Calendar":
      return CalendarDashlet;
  }

  const defs = (ctx.metadata.dashlets as Record<string, { entityType?: string; view?: string }> | undefined)?.[name];

  // Dashlet danh sách có entity cố định (Tasks, Cases, Leads, Opportunities, Meetings, Calls…).
  if (defs?.entityType && defs.entityType !== "Email") {
    return RecordsDashlet;
  }

  return ClassicDashlet;
}
