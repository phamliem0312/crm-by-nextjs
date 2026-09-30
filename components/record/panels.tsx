"use client";

import { useState, type ReactNode } from "react";
import type { Translator } from "@/lib/espo/i18n";
import type { DetailCell, DetailPanel } from "@/lib/espo/layout";

/**
 * Lưới panel theo layout detail (dùng cho cả xem và sửa). Ô `null` là ô trống; ô `fullWidth` chiếm cả hàng.
 * Panel `underShowMore` nằm dưới nút "Show more"; nhiều tab (`tabBreak`) hiện thành thanh tab.
 */
export function PanelGrid({
  panels,
  t,
  renderCell,
  isFieldVisible,
  isPanelVisible,
}: {
  panels: DetailPanel[];
  t: Translator;
  renderCell: (cell: DetailCell) => ReactNode;
  isFieldVisible: (field: string) => boolean;
  isPanelVisible: (panel: DetailPanel) => boolean;
}) {
  const [showMore, setShowMore] = useState(false);
  const [tab, setTab] = useState(0);
  const tabs = [...new Set(panels.map((panel) => panel.tabNumber))];
  const visible = panels.filter(isPanelVisible);
  const current = tabs.length > 1 ? visible.filter((panel) => panel.tabNumber === tab) : visible;
  const main = current.filter((panel) => !panel.underShowMore);
  const more = current.filter((panel) => panel.underShowMore);

  const renderPanel = (panel: DetailPanel) => {
    const rows = panel.rows
      .map((row) => row.map((cell) => (cell && isFieldVisible(cell.name) ? cell : null)))
      .filter((row) => row.some(Boolean));

    if (!rows.length) {
      return null;
    }

    return (
      <section key={panel.name} className="rounded-xl border border-slate-200 bg-white shadow-xs">
        {panel.label && (
          <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{panel.label}</h2>
        )}
        {panel.noteText && (
          <p className="mx-5 mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{panel.noteText}</p>
        )}
        <div className="grid gap-x-8 gap-y-5 px-5 py-4 md:grid-cols-2">
          {rows.flatMap((row, rowIndex) => {
            const wide = row.length === 1 || row.some((cell) => cell?.fullWidth);

            return row.map((cell, cellIndex) =>
              cell ? (
                <div key={cell.name} className={wide ? "md:col-span-2" : ""}>
                  {renderCell(cell)}
                </div>
              ) : (
                <div key={`empty-${rowIndex}-${cellIndex}`} className="hidden md:block" aria-hidden />
              ),
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div role="tablist" className="flex gap-1 border-b border-slate-200">
          {tabs.map((number) => {
            const label = panels.find((panel) => panel.tabNumber === number && panel.tabLabel)?.tabLabel ?? String(number + 1);

            return (
              <button
                key={number}
                type="button"
                role="tab"
                aria-selected={tab === number}
                onClick={() => setTab(number)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === number ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
      {main.map(renderPanel)}
      {more.length > 0 &&
        (showMore ? (
          more.map(renderPanel)
        ) : (
          <button
            type="button"
            onClick={() => setShowMore(true)}
            className="self-center text-sm font-medium text-blue-600 hover:underline"
          >
            {t("Show more")}
          </button>
        ))}
    </div>
  );
}

/** Nhãn + nội dung một ô field. */
export function FieldCell({
  label,
  htmlFor,
  noLabel,
  required,
  children,
  actions,
  error,
  errorId,
}: {
  label: string;
  htmlFor?: string;
  noLabel?: boolean;
  required?: boolean;
  children: ReactNode;
  actions?: ReactNode;
  error?: string | null;
  errorId?: string;
}) {
  return (
    <div className="group flex min-w-0 flex-col gap-1">
      {!noLabel && (
        <div className="flex min-h-5 items-center justify-between gap-2">
          {htmlFor ? (
            <label htmlFor={htmlFor} className="text-xs font-medium text-slate-500">
              {label}
              {required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
            </label>
          ) : (
            <span className="text-xs font-medium text-slate-500">{label}</span>
          )}
          {actions}
        </div>
      )}
      <div className="min-w-0 text-sm text-slate-900">{children}</div>
      {error && (
        <p id={errorId} className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
