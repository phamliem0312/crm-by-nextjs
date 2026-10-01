"use client";

// Panel tìm kiếm của list: text filter, primary filter (clientDefs.filterList), bool filter
// (clientDefs.boolFilterList), bộ lọc nâng cao theo layout `filters`. Tương đương `views/record/search` của classic.
import { useEffect, useId, useMemo, useState } from "react";
import { getFieldType } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Select, TextInput } from "@/components/fields/ui";
import { getFieldDefs, isFieldAvailable, isFieldFilterable } from "@/lib/espo/entity";
import { hasActiveSearch, type AdvancedFilter, type SearchState } from "@/lib/espo/search";

type FilterItem = string | { name: string; style?: string };

/**
 * Bộ lọc khi vừa thêm field. Bool/ngày có lựa chọn mặc định dùng được ngay (giống classic);
 * loại khác cần người dùng nhập giá trị nên để "chưa hoàn tất" (không gửi lên server).
 */
function initialFilter(type: string | undefined): AdvancedFilter {
  if (type === "bool") {
    return { type: "isTrue", data: { type: "isTrue" } };
  }

  if (type === "date") {
    return { type: "lastSevenDays", date: true, data: { type: "lastSevenDays" } };
  }

  if (type === "datetime" || type === "datetimeOptional") {
    return { type: "lastSevenDays", dateTime: true, data: { type: "lastSevenDays" } };
  }

  return { type: "", data: { incomplete: true } };
}

export function SearchPanel({
  ctx,
  scope,
  state,
  filterFields,
  onChange,
}: {
  ctx: FieldContext;
  scope: string;
  state: SearchState;
  /** Layout `filters`. */
  filterFields: string[];
  onChange: (next: SearchState) => void;
}) {
  const { t } = ctx;
  const clientDefs = (ctx.metadata.clientDefs?.[scope] ?? {}) as { filterList?: FilterItem[]; boolFilterList?: string[] };
  const presets = (clientDefs.filterList ?? []).map((item) => (typeof item === "string" ? item : item.name)).filter(Boolean);
  const boolFilters = clientDefs.boolFilterList ?? [];
  const [text, setText] = useState(state.textFilter);
  const [adding, setAdding] = useState(false);
  const textId = useId();

  // Text filter: chờ người dùng ngừng gõ mới tìm.
  useEffect(() => {
    if (text === state.textFilter) {
      return;
    }

    const timer = window.setTimeout(() => onChange({ ...state, textFilter: text }), 350);

    return () => window.clearTimeout(timer);
  }, [text, state, onChange]);

  // Đồng bộ khi state đổi từ ngoài (Reset, quay lại trang).
  const [lastText, setLastText] = useState(state.textFilter);

  if (lastText !== state.textFilter) {
    setLastText(state.textFilter);
    setText(state.textFilter);
  }

  const availableFilters = useMemo(
    () =>
      filterFields.filter((field) => {
        const defs = getFieldDefs(ctx.metadata, scope, field);

        return (
          !!defs &&
          isFieldAvailable(ctx.metadata, scope, field) &&
          ctx.acl.checkField(scope, field) &&
          isFieldFilterable(ctx.metadata, defs.type) &&
          !!getFieldType(defs).Search
        );
      }),
    [filterFields, ctx, scope],
  );

  const unused = availableFilters.filter((field) => !(field in state.advanced));

  const setAdvanced = (field: string, filter: AdvancedFilter | null) => {
    const advanced = { ...state.advanced };

    if (filter) {
      advanced[field] = filter;
    } else {
      delete advanced[field];
    }

    onChange({ ...state, advanced });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <label htmlFor={textId} className="sr-only">
            {t("Search")}
          </label>
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
            <i className="fas fa-search text-xs" />
          </span>
          <TextInput
            id={textId}
            type="search"
            className="pl-8"
            placeholder={t("Search")}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onChange({ ...state, textFilter: text });
              }
            }}
          />
        </div>

        {presets.length > 0 && (
          <Select
            aria-label={t("Filters", "labels")}
            className="w-auto"
            value={state.primary ?? ""}
            onChange={(event) => onChange({ ...state, primary: event.target.value || null })}
          >
            <option value="">{t("all", "presetFilters", scope)}</option>
            {presets.map((name) => (
              <option key={name} value={name}>
                {t(name, "presetFilters", scope)}
              </option>
            ))}
          </Select>
        )}

        {boolFilters.map((name) => {
          const active = state.bool.includes(name);

          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange({ ...state, bool: active ? state.bool.filter((item) => item !== name) : [...state.bool, name] })
              }
              className={`h-9 rounded-lg border px-3 text-sm font-medium transition ${
                active ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t(name, "boolFilters", scope)}
            </button>
          );
        })}

        {unused.length > 0 && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={adding}
              onClick={() => setAdding(!adding)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50"
            >
              <i className="fas fa-filter text-xs" aria-hidden />
              {t("Add Field")}
            </button>
            {adding && (
              <ul
                role="menu"
                className="absolute left-0 z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                {unused.map((field) => (
                  <li key={field}>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setAdding(false);
                        setAdvanced(field, initialFilter(getFieldDefs(ctx.metadata, scope, field)?.type));
                      }}
                    >
                      {t(field, "fields", scope)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasActiveSearch(state) && (
          <button
            type="button"
            onClick={() => {
              setText("");
              onChange({ textFilter: "", primary: null, bool: [], advanced: {} });
            }}
            className="h-9 rounded-lg px-3 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            {t("Reset")}
          </button>
        )}
      </div>

      {Object.keys(state.advanced).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Object.entries(state.advanced).map(([field, filter]) => (
            <AdvancedFilterCard
              key={field}
              ctx={ctx}
              scope={scope}
              field={field}
              filter={filter}
              onChange={(next) => setAdvanced(field, next ?? { type: "", data: { incomplete: true } })}
              onRemove={() => setAdvanced(field, null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdvancedFilterCard({
  ctx,
  scope,
  field,
  filter,
  onChange,
  onRemove,
}: {
  ctx: FieldContext;
  scope: string;
  field: string;
  filter: AdvancedFilter;
  onChange: (filter: AdvancedFilter | null) => void;
  onRemove: () => void;
}) {
  const defs = getFieldDefs(ctx.metadata, scope, field);
  const inputId = useId();
  const Search = defs ? getFieldType(defs).Search : undefined;

  if (!defs || !Search) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-[13px] font-medium text-slate-700">
          {ctx.t(field, "fields", scope)}
        </label>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${ctx.t("Remove Filter")}: ${ctx.t(field, "fields", scope)}`}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <i className="fas fa-times text-xs" aria-hidden />
        </button>
      </div>
      <Search
        ctx={ctx}
        scope={scope}
        name={field}
        defs={defs}
        filter={filter.type ? filter : null}
        onChange={onChange}
        inputId={inputId}
      />
    </div>
  );
}
