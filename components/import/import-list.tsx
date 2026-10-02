"use client";

// Danh sách các lần nhập (`/Import/list`): thời gian (mở kết quả), trạng thái, entity, người nhập; xoá log.
// Tương đương `views/import/list` + `views/import/record/list` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { getFieldDefs } from "@/lib/espo/entity";
import { deleteRecord, listRecords } from "@/lib/espo/records";

export function ImportList() {
  const ctx = useFieldContext();

  if (!ctx) {
    return <LoadingBlock />;
  }

  if (!ctx.acl.checkScope("Import")) {
    return <PageMessage icon="fas fa-lock" title={ctx.t("Access denied")} />;
  }

  return <ImportListContent ctx={ctx} />;
}

function ImportListContent({ ctx }: { ctx: FieldContext }) {
  const { t, metadata, acl } = ctx;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = typeof ctx.settings.recordsPerPage === "number" ? ctx.settings.recordsPerPage : 20;
  const list = useQuery({
    queryKey: ["importList", page, pageSize],
    queryFn: ({ signal }) =>
      listRecords(
        "Import",
        { maxSize: pageSize, offset: (page - 1) * pageSize, orderBy: "createdAt", order: "desc", select: ["createdAt", "status", "entityType", "createdById", "createdByName"] },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
  const records = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const statusDefs = getFieldDefs(metadata, "Import", "status");

  useEffect(() => {
    document.title = `${t("Import Results", "labels", "Import")} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [t, ctx.settings.applicationName]);

  async function remove(id: string) {
    setBusy(true);

    try {
      await deleteRecord("Import", id);
      toast.success(t("Removed"));
      await queryClient.invalidateQueries({ queryKey: ["importList"] });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Import Results", "labels", "Import")}</h1>
        <Link
          href="/Import"
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
        >
          <i className="fas fa-file-import text-xs" aria-hidden />
          {t("New Import", "labels", "Import")}
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm" aria-busy={list.isFetching}>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-3 py-2.5">{t("createdAt", "fields")}</th>
                <th className="px-3 py-2.5">{t("status", "fields", "Import")}</th>
                <th className="px-3 py-2.5">{t("entityType", "fields", "Import")}</th>
                <th className="px-3 py-2.5">{t("createdBy", "fields")}</th>
                <th className="w-12 px-3 py-2.5">
                  <span className="sr-only">{t("Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <Link href={`/Import/${encodeURIComponent(record.id)}`} className="font-medium text-blue-700 hover:underline">
                      {ctx.dateTime.toDisplay(String(record.createdAt ?? ""))}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {typeof record.status === "string" && <Badge style={statusDefs?.style?.[record.status] ?? null}>{t.option(record.status, "status", "Import")}</Badge>}
                  </td>
                  <td className="px-3 py-2.5">{record.entityType ? t(String(record.entityType), "scopeNamesPlural") : ""}</td>
                  <td className="px-3 py-2.5 text-slate-600">{String(record.createdByName ?? "")}</td>
                  <td className="px-3 py-2 text-right">
                    {acl.checkScope("Import", "delete") && (
                      <button
                        type="button"
                        onClick={() => setRemoving(record.id)}
                        aria-label={`${t("Remove")}: ${ctx.dateTime.toDisplay(String(record.createdAt ?? ""))}`}
                        title={t("Remove")}
                        className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <i className="fas fa-trash text-xs" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.isLoading && <LoadingBlock />}
        {!list.isLoading && !records.length && <p className="px-4 py-10 text-center text-sm text-slate-500">{t("No Data")}</p>}
        {total > pageSize && (
          <nav aria-label="Pagination" className="flex items-center justify-end gap-1 border-t border-slate-200 px-4 py-2 text-sm text-slate-600">
            <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label={t("Previous Page", "labels")}>
              <i className="fas fa-chevron-left text-xs" aria-hidden />
            </Button>
            <span className="px-2 tabular-nums">
              {page} / {pageCount}
            </span>
            <Button variant="ghost" disabled={page >= pageCount} onClick={() => setPage(page + 1)} aria-label={t("Next Page", "labels")}>
              <i className="fas fa-chevron-right text-xs" aria-hidden />
            </Button>
          </nav>
        )}
      </div>

      <ConfirmDialog
        open={!!removing}
        title={t("Remove Import Log", "labels", "Import")}
        message={t("confirmRemoveImportLog", "messages", "Import")}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() => removing && void remove(removing)}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
