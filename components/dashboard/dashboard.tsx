"use client";

// Trang chủ: Dashboard theo `preferences.dashboardLayout` (tab + lưới 4 cột như GridStack của classic).
// Chỉ hiển thị; thêm/xoá/kéo dashlet và sửa tuỳ chọn vẫn làm ở classic.
import { useMemo, useState } from "react";
import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock } from "@/components/record/scope-gate";
import { dashletAllowed, dashletOptions, resolveDashboardLayout } from "@/lib/espo/dashboard";
import { classicHref } from "@/lib/espo/routes";
import { dashletComponent } from "./dashlets";

/** Chiều cao một đơn vị lưới (classic: 4 ô × 40px). */
const ROW_UNIT = "10rem";

function readTab(): number {
  try {
    return Number(localStorage.getItem("espo-next-dashboard-tab")) || 0;
  } catch {
    return 0;
  }
}

export function Dashboard() {
  const ctx = useFieldContext();
  const [tab, setTabState] = useState(readTab);
  const tabs = useMemo(() => (ctx ? resolveDashboardLayout(ctx.settings, ctx.preferences, ctx.user) : []), [ctx]);

  if (!ctx) {
    return <LoadingBlock />;
  }

  const { t } = ctx;
  const current = tabs[tab] ? tab : 0;
  const items = (tabs[current]?.layout ?? []).filter((item) => dashletAllowed(ctx.metadata, ctx.acl, ctx.user, item.name));

  const setTab = (index: number) => {
    setTabState(index);

    try {
      localStorage.setItem("espo-next-dashboard-tab", String(index));
    } catch {
      // Không lưu được tab thì thôi.
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Home")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {tabs.length > 1 && (
            <div role="tablist" aria-label={t("Dashboard")} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
              {tabs.map((item, index) => (
                <button
                  key={`${item.name}-${index}`}
                  type="button"
                  role="tab"
                  aria-selected={current === index}
                  onClick={() => setTab(index)}
                  className={`rounded-md px-3 py-1.5 text-sm ${current === index ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
          <a
            href={classicHref("#")}
            title={`${t("Edit")} · EspoCRM Classic`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            <i className="fas fa-th-large text-xs text-slate-400" aria-hidden />
            {t("Edit")}
          </a>
        </div>
      </div>

      {items.length ? (
        <div className="flex flex-col gap-4 md:grid md:grid-cols-4" style={{ gridAutoRows: ROW_UNIT }}>
          {items.map((item) => {
            const Component = dashletComponent(ctx, item.name);

            return (
              <div
                key={item.id}
                className="h-80 md:h-auto"
                style={{ gridColumn: `${Math.min(item.x, 3) + 1} / span ${Math.min(item.width, 4 - Math.min(item.x, 3))}`, gridRow: `${item.y + 1} / span ${item.height}` }}
              >
                <Component ctx={ctx} item={item} options={dashletOptions(ctx.metadata, ctx.preferences, item)} />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">{t("No Data")}</p>
      )}
    </div>
  );
}
