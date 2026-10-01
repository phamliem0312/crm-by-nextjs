"use client";

// Trang list dùng chung cho mọi entity: cột theo layout `list`, sắp xếp, phân trang, tìm kiếm/lọc,
// chọn nhiều + xoá/cập nhật hàng loạt. Trạng thái lọc giữ trên URL. Tương đương `views/list` + `views/record/list`.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { canExport, exportableFields } from "@/lib/espo/export";
import { kanbanStatusField } from "@/lib/espo/kanban";
import { toast } from "@/components/ui/toaster";
import { getEntityDefs, getFieldDefs, getSelectAttributes } from "@/lib/espo/entity";
import { interpolate } from "@/lib/espo/i18n";
import { buildListColumns, type ListColumn, type ListLayoutItem } from "@/lib/espo/layout";
import { deleteRecord, listRecords, massAction, type EspoRecord } from "@/lib/espo/records";
import { recordCreateHref, recordEditHref, recordViewHref } from "@/lib/espo/routes";
import {
  buildSearchParams,
  parseListState,
  serializeListState,
  type ListState,
  type SearchState,
  type SortState,
} from "@/lib/espo/search";
import { useLayout } from "./hooks";
import { ExportDialog } from "./export-dialog";
import { KanbanView } from "./kanban-view";
import { MassUpdateDialog } from "./mass-update-dialog";
import { LoadingBlock } from "./scope-gate";
import { SearchPanel } from "./search-panel";

function useDefaultSort(ctx: FieldContext | null, scope: string): SortState {
  const collection = ctx ? getEntityDefs(ctx.metadata, scope).collection : undefined;

  return {
    orderBy: collection?.orderBy ?? null,
    order: collection?.order === "asc" || collection?.order === "desc" ? collection.order : null,
  };
}

export function ListView({ scope }: { scope: string }) {
  const ctx = useFieldContext();
  const layout = useLayout<ListLayoutItem[]>(scope, "list");
  const filtersLayout = useLayout<string[]>(scope, "filters");
  const massUpdateLayout = useLayout<string[]>(scope, "massUpdate");

  if (!ctx || !layout.data) {
    return <LoadingBlock />;
  }

  return (
    <ListViewContent
      ctx={ctx}
      scope={scope}
      layout={layout.data}
      filterFields={filtersLayout.data ?? []}
      massUpdateFields={massUpdateLayout.data ?? []}
    />
  );
}

function ListViewContent({
  ctx,
  scope,
  layout,
  filterFields,
  massUpdateFields,
}: {
  ctx: FieldContext;
  scope: string;
  layout: ListLayoutItem[];
  filterFields: string[];
  massUpdateFields: string[];
}) {
  const { t, acl, metadata } = ctx;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const defaults = useDefaultSort(ctx, scope);
  const state = useMemo(() => parseListState(new URLSearchParams(searchParams.toString()), defaults), [searchParams, defaults]);
  // Lựa chọn gắn với trạng thái list hiện tại: đổi trang/bộ lọc thì tự bỏ chọn.
  const stateKey = searchParams.toString();
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: stateKey, ids: [] });
  const selected = selection.key === stateKey ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ key: stateKey, ids });
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [massUpdateOpen, setMassUpdateOpen] = useState(false);
  /** Xuất: danh sách id đã chọn, hoặc `"all"` = mọi kết quả theo bộ lọc. */
  const [exporting, setExporting] = useState<string[] | "all" | null>(null);
  const statusField = kanbanStatusField(metadata, scope);
  // Chế độ xem (list/kanban) nhớ theo scope như classic (lưu ở trình duyệt).
  const [mode, setModeState] = useState<"list" | "kanban">(() => {
    try {
      return statusField && localStorage.getItem(`espo-next-list-mode-${scope}`) === "kanban" ? "kanban" : "list";
    } catch {
      return "list";
    }
  });
  const setMode = (next: "list" | "kanban") => {
    setModeState(next);

    try {
      localStorage.setItem(`espo-next-list-mode-${scope}`, next);
    } catch {
      // Không lưu được thì chỉ đổi trong phiên này.
    }
  };
  const kanban = mode === "kanban" && !!statusField;
  const [busy, setBusy] = useState(false);
  const pageSize = typeof ctx.settings.recordsPerPage === "number" ? ctx.settings.recordsPerPage : 20;

  const columns = useMemo(() => buildListColumns(layout, { scope, metadata, acl, t }), [layout, scope, metadata, acl, t]);
  // Thêm assignedUser/createdBy/teams để kiểm tra quyền sửa/xoá theo từng bản ghi (field không có thì bị bỏ qua).
  const select = useMemo(
    () => getSelectAttributes(metadata, scope, [...columns.map((c) => c.name), "name", "assignedUser", "assignedUsers", "createdBy", "teams"]),
    [metadata, scope, columns],
  );

  const setState = useCallback(
    (next: ListState) => {
      const query = serializeListState(next, defaults).toString();

      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname, defaults],
  );

  const onSearchChange = useCallback((search: SearchState) => setState({ ...state, ...search, page: 1 }), [setState, state]);

  const listSearch = useMemo(() => buildSearchParams(state, { timeZone: ctx.dateTime.getTimeZone() }), [state, ctx.dateTime]);
  const list = useQuery({
    queryKey: ["recordList", scope, state, select, pageSize],
    queryFn: ({ signal }) =>
      listRecords(scope, { ...listSearch, select, maxSize: pageSize, offset: (state.page - 1) * pageSize }, signal),
    placeholderData: keepPreviousData,
    enabled: !kanban,
  });

  useEffect(() => {
    document.title = `${t(scope, "scopeNamesPlural")} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [t, scope, ctx.settings.applicationName]);

  const records = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = total > 0 ? Math.ceil(total / pageSize) : 1;
  const canCreate = acl.checkScope(scope, "create");
  const canDelete = acl.checkScope(scope, "delete");
  const exportAllowed = canExport(scope, { settings: ctx.settings, acl, metadata });
  const canMassUpdate = acl.checkScope(scope, "edit") && acl.getPermissionLevel("massUpdate") !== "no" && massUpdateFields.length > 0;
  const allSelected = records.length > 0 && records.every((record) => selected.includes(record.id));

  const hasField = (field: string) => !!getFieldDefs(metadata, scope, field);
  const canOn = (record: EspoRecord, action: "edit" | "delete") => acl.checkRecord(scope, record, action, { hasField }) !== false;

  function toggleSort(column: ListColumn) {
    if (!column.sortable) {
      return;
    }

    const order = state.orderBy === column.name && state.order === "asc" ? "desc" : "asc";

    setState({ ...state, orderBy: column.name, order, page: 1 });
  }

  async function removeRecords(ids: string[]) {
    setBusy(true);

    try {
      if (ids.length === 1) {
        await deleteRecord(scope, ids[0]);
        toast.success(t("Removed"));
      } else {
        const result = await massAction(scope, "delete", ids);

        toast.success(interpolate(t("massRemoveResult", "messages"), { count: result?.count ?? ids.length }));
      }

      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t(scope, "scopeNamesPlural")}</h1>
        <div className="flex items-center gap-2">
          {statusField && (
            <div role="group" aria-label={t("View")} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
              {(["list", "kanban"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  title={t(item, "listViewModes")}
                  onClick={() => setMode(item)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm ${
                    mode === item ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <i className={`fas ${item === "list" ? "fa-list" : "fa-columns"} text-xs`} aria-hidden />
                  <span className="hidden sm:inline">{t(item, "listViewModes")}</span>
                </button>
              ))}
            </div>
          )}
          <Menu
            label={t("Actions")}
            triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800"
            items={exportAllowed && total > 0 ? [{ label: t("Export"), icon: "fas fa-file-export", onSelect: () => setExporting("all") }] : []}
          />
          {canCreate && (
            <Link
              href={recordCreateHref(scope, metadata)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
            >
              <i className="fas fa-plus text-xs" aria-hidden />
              {t("Create")} {t(scope, "scopeNames")}
            </Link>
          )}
        </div>
      </div>

      <SearchPanel ctx={ctx} scope={scope} state={state} filterFields={filterFields} onChange={onSearchChange} />

      {kanban && statusField && <KanbanView ctx={ctx} scope={scope} statusField={statusField} searchParams={listSearch} />}

      {!kanban && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
          <span className="font-medium text-blue-900">
            {selected.length} / {total}
          </span>
          <span className="flex-1" />
          {exportAllowed && (
            <Button onClick={() => setExporting(selected)}>
              <i className="fas fa-file-export text-xs" aria-hidden />
              {t("Export")}
            </Button>
          )}
          {canMassUpdate && (
            <Button onClick={() => setMassUpdateOpen(true)}>
              <i className="fas fa-pen text-xs" aria-hidden />
              {t("Mass Update")}
            </Button>
          )}
          {canDelete && (
            <Button variant="danger" onClick={() => setConfirmDelete(selected)}>
              <i className="fas fa-trash text-xs" aria-hidden />
              {t("Remove")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSelected([])}>
            {t("Cancel")}
          </Button>
        </div>
      )}

      {!kanban && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm" aria-busy={list.isFetching}>
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-blue-600"
                      aria-label={t("Select")}
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : records.map((record) => record.id))}
                    />
                  </th>
                  {columns.map((column) => {
                    const sorted = state.orderBy === column.name;

                    return (
                      <th
                        key={column.name}
                        scope="col"
                        aria-sort={sorted ? (state.order === "desc" ? "descending" : "ascending") : undefined}
                        style={column.width ? { width: `${column.width}%` } : column.widthPx ? { width: column.widthPx } : undefined}
                        className={`px-3 py-2.5 ${column.align === "right" ? "text-right" : ""}`}
                      >
                        {column.sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(column)}
                            className="inline-flex items-center gap-1.5 uppercase hover:text-slate-800"
                          >
                            {column.label}
                            <i
                              aria-hidden
                              className={`fas text-[10px] ${
                                sorted ? (state.order === "desc" ? "fa-arrow-down text-blue-600" : "fa-arrow-up text-blue-600") : "fa-sort text-slate-300"
                              }`}
                            />
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                  <th scope="col" className="w-24 px-3 py-2.5">
                    <span className="sr-only">{t("Actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-100 ${list.isFetching && list.isPlaceholderData ? "opacity-60" : ""}`}>
                {records.map((record) => {
                  const checked = selected.includes(record.id);

                  return (
                    <tr key={record.id} className={checked ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="size-4 accent-blue-600"
                          aria-label={`${t("Select")}: ${String(record.name ?? record.id)}`}
                          checked={checked}
                          onChange={() =>
                            setSelected(checked ? selected.filter((id) => id !== record.id) : [...selected, record.id])
                          }
                        />
                      </td>
                      {columns.map((column) => {
                        const defs = getFieldDefs(metadata, scope, column.name)!;

                        return (
                          <td key={column.name} className={`max-w-xs px-3 py-2.5 align-top ${column.align === "right" ? "text-right" : ""}`}>
                            {column.link ? (
                              <Link href={recordViewHref(scope, record.id, metadata)} className="font-medium text-blue-700 hover:underline">
                                {typeof record[column.name] === "string" && record[column.name]
                                  ? String(record[column.name])
                                  : String(record.name ?? "") || record.id}
                              </Link>
                            ) : (
                              <FieldValue ctx={ctx} scope={scope} name={column.name} defs={defs} values={record} mode="list" />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {canOn(record, "edit") && acl.checkScope(scope, "edit") && (
                          <Link
                            href={recordEditHref(scope, record.id, metadata)}
                            aria-label={`${t("Edit")}: ${String(record.name ?? record.id)}`}
                            title={t("Edit")}
                            className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                            <i className="fas fa-pen text-xs" aria-hidden />
                          </Link>
                        )}
                        {canDelete && canOn(record, "delete") && (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete([record.id])}
                            aria-label={`${t("Remove")}: ${String(record.name ?? record.id)}`}
                            title={t("Remove")}
                            className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <i className="fas fa-trash text-xs" aria-hidden />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {list.isLoading && <LoadingBlock />}
          {!list.isLoading && !records.length && <p className="px-4 py-10 text-center text-sm text-slate-500">{t("No Data")}</p>}

          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-sm text-slate-600">
              <span>
                {t("Total")}: <span className="font-medium text-slate-900">{ctx.numbers.formatInt(total)}</span>
              </span>
              <nav aria-label="Pagination" className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  disabled={state.page <= 1}
                  onClick={() => setState({ ...state, page: state.page - 1 })}
                  aria-label={t("Previous Page", "labels")}
                >
                  <i className="fas fa-chevron-left text-xs" aria-hidden />
                </Button>
                <span className="px-2 tabular-nums">
                  {state.page} / {pageCount}
                </span>
                <Button
                  variant="ghost"
                  disabled={state.page >= pageCount}
                  onClick={() => setState({ ...state, page: state.page + 1 })}
                  aria-label={t("Next Page", "labels")}
                >
                  <i className="fas fa-chevron-right text-xs" aria-hidden />
                </Button>
              </nav>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("Remove")}
        message={t(confirmDelete && confirmDelete.length > 1 ? "removeSelectedRecordsConfirmation" : "removeRecordConfirmation", "messages")}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() => confirmDelete && removeRecords(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      {exporting && (
        <ExportDialog
          ctx={ctx}
          scope={scope}
          fields={exportableFields(metadata, scope, columns.map((column) => column.name))}
          ids={exporting === "all" ? null : exporting}
          searchParams={listSearch}
          total={total}
          onClose={() => setExporting(null)}
        />
      )}

      {massUpdateOpen && (
        <MassUpdateDialog
          ctx={ctx}
          scope={scope}
          ids={selected}
          fields={massUpdateFields}
          open={massUpdateOpen}
          onClose={() => setMassUpdateOpen(false)}
          onDone={() => {
            setMassUpdateOpen(false);
            setSelected([]);
            void queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
          }}
        />
      )}
    </div>
  );
}
