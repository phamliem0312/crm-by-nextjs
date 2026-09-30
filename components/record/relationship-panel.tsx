"use client";

// Relationship panel ở cuối trang chi tiết: bản ghi liên quan qua một link (hasMany/manyMany/hasChildren).
// Tương đương `views/record/panels/relationship` của classic: layout riêng (defs.layout, mặc định listSmall),
// tạo mới kèm `createAttributeMap`, chọn bản ghi có sẵn để liên kết, bỏ liên kết.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { RecordPicker } from "@/components/fields/link";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Button, ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { getFieldDefs, getSelectAttributes } from "@/lib/espo/entity";
import { buildListColumns, type ListLayoutItem, type RelationshipPanel as PanelDefs } from "@/lib/espo/layout";
import { linkRecords, listLinked, unlinkRecord, type EspoRecord } from "@/lib/espo/records";
import { recordCreateHref, recordViewHref } from "@/lib/espo/routes";
import { useLayout } from "./hooks";

const PAGE_SIZE = 5;

/** Attribute cho bản ghi mới tạo từ panel, theo `createAttributeMap` (thuộc tính cha → thuộc tính con). */
export function createAttributesFor(panel: PanelDefs, parent: Record<string, unknown>): Record<string, unknown> {
  const map = panel.defs.createAttributeMap ?? {};

  return Object.fromEntries(Object.entries(map).map(([from, to]) => [to, parent[from] ?? null]));
}

export function RelationshipPanel({
  ctx,
  scope,
  record,
  panel,
  canEditParent,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  panel: PanelDefs;
  canEditParent: boolean;
}) {
  const { t, metadata, acl } = ctx;
  const queryClient = useQueryClient();
  const layout = useLayout<ListLayoutItem[]>(panel.foreignScope, panel.defs.layout ?? "listSmall", { fallback: "listSmall" });
  const [maxSize, setMaxSize] = useState(PAGE_SIZE);
  const [selecting, setSelecting] = useState(false);
  const [unlinking, setUnlinking] = useState<EspoRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const columns = layout.data
    ? buildListColumns(layout.data, { scope: panel.foreignScope, metadata, acl, t }).slice(0, 4)
    : [];
  const select = getSelectAttributes(metadata, panel.foreignScope, ["name", ...columns.map((c) => c.name)]);
  const queryKey = ["related", scope, record.id, panel.link];

  const related = useQuery({
    queryKey: [...queryKey, maxSize, select],
    queryFn: ({ signal }) =>
      listLinked(
        scope,
        record.id,
        panel.link,
        {
          select,
          maxSize,
          offset: 0,
          ...(panel.defs.orderBy ? { orderBy: panel.defs.orderBy, order: panel.defs.orderDirection ?? "asc" } : {}),
        },
        signal,
      ),
    enabled: !!layout.data,
    placeholderData: keepPreviousData,
  });

  const list = related.data?.list ?? [];
  const total = related.data?.total ?? 0;
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  // Tạo mới: đưa thuộc tính theo createAttributeMap và thông tin liên kết lên URL của trang tạo.
  const createParams = new URLSearchParams({
    relate: JSON.stringify({ scope, id: record.id, link: panel.link, name: String(record.name ?? "") }),
    attributes: JSON.stringify(createAttributesFor(panel, record)),
  });

  async function link(ids: string[]) {
    setBusy(true);

    try {
      await linkRecords(scope, record.id, panel.link, ids);
      await refresh();
      setSelecting(false);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function unlink(item: EspoRecord) {
    setBusy(true);

    try {
      await unlinkRecord(scope, record.id, panel.link, item.id);
      await refresh();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      setUnlinking(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs" aria-labelledby={`rel-${panel.link}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-2.5">
        <h2 id={`rel-${panel.link}`} className="text-sm font-semibold text-slate-800">
          {panel.label}
          {total > 0 && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{total}</span>}
        </h2>
        <div className="flex gap-1">
          {panel.canCreate && (
            <Link
              href={`${recordCreateHref(panel.foreignScope, metadata)}?${createParams.toString()}`}
              aria-label={`${t("Create")}: ${panel.label}`}
              title={t("Create")}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <i className="fas fa-plus text-xs" aria-hidden />
            </Link>
          )}
          {panel.canSelect && canEditParent && (
            <button
              type="button"
              onClick={() => setSelecting(true)}
              aria-label={`${t("Select")}: ${panel.label}`}
              title={t("Select")}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <i className="fas fa-link text-xs" aria-hidden />
            </button>
          )}
        </div>
      </div>

      {list.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sr-only">
              <tr>
                {columns.map((column) => (
                  <th key={column.name} scope="col">
                    {column.label}
                  </th>
                ))}
                <th scope="col">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  {columns.map((column, index) => {
                    const defs = getFieldDefs(metadata, panel.foreignScope, column.name)!;

                    return (
                      <td key={column.name} className="px-5 py-2.5 align-top">
                        {index === 0 || column.link ? (
                          <Link href={recordViewHref(panel.foreignScope, item.id, metadata)} className="font-medium text-blue-700 hover:underline">
                            {String(item.name ?? "") || item.id}
                          </Link>
                        ) : (
                          <FieldValue ctx={ctx} scope={panel.foreignScope} name={column.name} defs={defs} values={item} mode="list" />
                        )}
                      </td>
                    );
                  })}
                  <td className="w-12 px-3 py-1.5 text-right">
                    {panel.canUnlink && canEditParent && (
                      <button
                        type="button"
                        onClick={() => setUnlinking(item)}
                        aria-label={`${t("Unlink")}: ${String(item.name ?? item.id)}`}
                        title={t("Unlink")}
                        className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <i className="fas fa-unlink text-xs" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > list.length && (
            <div className="border-t border-slate-100 px-5 py-2">
              <button
                type="button"
                onClick={() => setMaxSize(maxSize + PAGE_SIZE * 2)}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                {t("Show more")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-500">{related.isLoading || layout.isLoading ? t("Loading...") : t("No Data")}</p>
      )}

      <Dialog
        open={selecting}
        onClose={() => setSelecting(false)}
        title={`${t("Select")}: ${panel.label}`}
        footer={<Button onClick={() => setSelecting(false)}>{t("Cancel")}</Button>}
      >
        <RecordPicker
          ctx={ctx}
          foreignScope={panel.foreignScope}
          exclude={list.map((item) => item.id)}
          onSelect={(option) => !busy && link([option.id])}
        />
      </Dialog>

      <ConfirmDialog
        open={!!unlinking}
        title={t("Unlink")}
        message={t("unlinkRecordConfirmation", "messages")}
        confirmLabel={t("Unlink")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() => unlinking && unlink(unlinking)}
        onCancel={() => setUnlinking(null)}
      />
    </section>
  );
}
