"use client";

// Các panel dưới trang chi tiết (Stream, relationship, panel phụ) chia tab theo `tabBreak` của layout
// `bottomPanelsDetail`, như classic. Chỉ panel của tab đang mở được render (tải dữ liệu khi cần).
import { useState, type ReactNode } from "react";
import type { Translator } from "@/lib/espo/i18n";
import type { BottomPanel } from "@/lib/espo/layout";

export function BottomPanels({
  panels,
  t,
  render,
}: {
  panels: BottomPanel[];
  t: Translator;
  render: (panel: BottomPanel) => ReactNode;
}) {
  const tabs = [...new Set(panels.map((panel) => panel.tabNumber))];
  const [tab, setTab] = useState<number | null>(null);
  const current = tab !== null && tabs.includes(tab) ? tab : (tabs[0] ?? 0);

  if (!panels.length) {
    return null;
  }

  if (tabs.length < 2) {
    return <>{panels.map(render)}</>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label={t("Panels")} className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((number, index) => {
          const label = panels.find((panel) => panel.tabNumber === number)?.tabLabel ?? (index === 0 ? t("Overview") : String(index + 1));

          return (
            <button
              key={number}
              type="button"
              role="tab"
              aria-selected={current === number}
              onClick={() => setTab(number)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                current === number ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {panels.filter((panel) => panel.tabNumber === current).map(render)}
    </div>
  );
}
