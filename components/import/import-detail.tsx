"use client";

// Kết quả một lần nhập (`/Import/<id>`): trạng thái (tự hỏi lại khi đang chạy), số bản ghi tạo/trùng/cập nhật,
// Revert, Remove Duplicates, xoá log, nhập lại với cùng tham số; panel Imported/Duplicates/Updated/Errors.
// Tương đương `views/import/detail` + `views/import/record/*` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { useFieldContext } from "@/components/fields/use-field-context";
import { PanelCard } from "@/components/record/activity-panels";
import { FieldCell } from "@/components/record/panels";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { getFieldDefs } from "@/lib/espo/entity";
import { downloadUrl } from "@/lib/espo/export";
import { EspoApiError } from "@/lib/espo/errors";
import {
  exportImportErrors,
  getImport,
  isImportRunning,
  removeImportDuplicates,
  revertImport,
  unmarkImportDuplicate,
} from "@/lib/espo/import";
import { deleteRecord, listLinked, type EspoRecord } from "@/lib/espo/records";
import { recordViewHref } from "@/lib/espo/routes";
import { SAME_PARAMS_KEY } from "./import-wizard";

const CHECK_INTERVAL = 5000;
const PAGE_SIZE = 10;

export function ImportDetail({ id }: { id: string }) {
  const ctx = useFieldContext();
  const record = useQuery({
    queryKey: ["record", "Import", id],
    queryFn: ({ signal }) => getImport(id, signal),
    meta: { silent: true },
    retry: false,
    // Đang chạy → hỏi lại 5 giây một lần (`setupChecking` của classic).
    refetchInterval: (query) => (isImportRunning(query.state.data?.status) ? CHECK_INTERVAL : false),
  });

  if (record.error instanceof EspoApiError && (record.error.status === 404 || record.error.status === 403)) {
    return <PageMessage icon={record.error.status === 404 ? "fas fa-question" : "fas fa-lock"} title={ctx?.t(record.error.status === 404 ? "Not found" : "Access denied") ?? ""} />;
  }

  if (!ctx || !record.data) {
    return record.error ? <PageMessage icon="fas fa-exclamation-triangle" title={ctx?.t("Error") ?? "Error"} /> : <LoadingBlock />;
  }

  return <ImportContent ctx={ctx} record={record.data} />;
}

type Pending = "revert" | "duplicates" | "remove" | null;

function ImportContent({ ctx, record }: { ctx: FieldContext; record: EspoRecord }) {
  const { t, metadata, acl } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const entityType = String(record.entityType ?? "");
  const running = isImportRunning(record.status);
  const title = ctx.dateTime.toDisplay(String(record.createdAt ?? ""));
  const statusDefs = getFieldDefs(metadata, "Import", "status");
  const counts = { imported: Number(record.importedCount ?? 0), duplicates: Number(record.duplicateCount ?? 0), updated: Number(record.updatedCount ?? 0) };

  useEffect(() => {
    document.title = `${t("Import", "scopeNames")} ${title} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [t, title, ctx.settings.applicationName]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["record", "Import", record.id] });
    await queryClient.invalidateQueries({ queryKey: ["importResult", record.id] });
  }

  async function run(kind: Exclude<Pending, null>) {
    setBusy(true);

    try {
      if (kind === "revert") {
        await revertImport(record.id);
        toast.success(t("Done"));
        router.push("/Import/list");

        return;
      }

      if (kind === "remove") {
        await deleteRecord("Import", record.id);
        toast.success(t("Removed"));
        await queryClient.invalidateQueries({ queryKey: ["importList"] });
        router.push("/Import/list");

        return;
      }

      await removeImportDuplicates(record.id);
      toast.success(t("duplicatesRemoved", "messages", "Import"));
      await refresh();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  function sameParams() {
    const params = (record.params ?? {}) as Record<string, unknown>;

    try {
      sessionStorage.setItem(SAME_PARAMS_KEY, JSON.stringify({ ...params, entityType, attributeList: record.attributeList ?? [] }));
    } catch {
      // Không lưu được thì mở wizard trống.
    }

    router.push("/Import");
  }

  const confirmMessages: Record<Exclude<Pending, null>, string> = {
    revert: "confirmRevert",
    duplicates: "confirmRemoveDuplicates",
    remove: "confirmRemoveImportLog",
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href="/Import/list" className="hover:text-slate-800 hover:underline">
              {t("Import", "scopeNamesPlural")}
            </Link>
          </nav>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {title}
            {running && <i className="fas fa-circle-notch fa-spin text-base text-slate-400" aria-label={t("In Process", "options")} />}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {counts.duplicates > 0 && acl.checkScope("Import", "edit") && (
            <Button onClick={() => setConfirm("duplicates")} title={t("removeDuplicates", "messages", "Import")} disabled={busy}>
              {t("Remove Duplicates", "labels", "Import")}
            </Button>
          )}
          {counts.imported > 0 && acl.checkScope("Import", "edit") && (
            <Button variant="danger" onClick={() => setConfirm("revert")} title={t("revert", "messages", "Import")} disabled={busy}>
              {t("Revert Import", "labels", "Import")}
            </Button>
          )}
          {acl.checkScope("Import", "delete") && (
            <Button onClick={() => setConfirm("remove")} title={t("removeImportLog", "messages", "Import")} disabled={busy}>
              {t("Remove Import Log", "labels", "Import")}
            </Button>
          )}
          <Menu
            label={t("Actions")}
            triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800"
            items={[{ label: t("New import with same params", "labels", "Import"), icon: "fas fa-redo", onSelect: sameParams }]}
          />
        </div>
      </div>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <FieldCell label={t("entityType", "fields", "Import")}>{entityType ? t(entityType, "scopeNamesPlural") : ""}</FieldCell>
        <FieldCell label={t("status", "fields", "Import")}>
          {typeof record.status === "string" && (
            <Badge style={statusDefs?.style?.[record.status] ?? null}>{t.option(record.status, "status", "Import")}</Badge>
          )}
        </FieldCell>
        <FieldCell label={t("file", "fields", "Import")}>
          <FieldValue ctx={ctx} scope="Import" name="file" defs={getFieldDefs(metadata, "Import", "file") ?? { type: "file" }} values={record} mode="detail" />
        </FieldCell>
        <FieldCell label={t("Created")}>
          <span>
            {title}
            {record.createdByName ? <span className="text-slate-500"> · {String(record.createdByName)}</span> : null}
          </span>
        </FieldCell>
        <FieldCell label={t("importedCount", "labels", "Import")}>{ctx.numbers.formatInt(counts.imported)}</FieldCell>
        <FieldCell label={t("duplicateCount", "labels", "Import")}>{ctx.numbers.formatInt(counts.duplicates)}</FieldCell>
        <FieldCell label={t("updatedCount", "labels", "Import")}>{ctx.numbers.formatInt(counts.updated)}</FieldCell>
      </section>

      {entityType && (
        <>
          <ResultPanel ctx={ctx} importId={record.id} entityType={entityType} link="imported" title={t("Imported", "labels", "Import")} running={running} />
          <ResultPanel
            ctx={ctx}
            importId={record.id}
            entityType={entityType}
            link="duplicates"
            title={t("Duplicates", "labels", "Import")}
            running={running}
            onUnmark={async (item) => {
              try {
                await unmarkImportDuplicate(record.id, entityType, item.id);
                toast.success(t("Done"));
                await refresh();
              } catch (error) {
                toast.error(error);
              }
            }}
          />
          <ResultPanel ctx={ctx} importId={record.id} entityType={entityType} link="updated" title={t("Updated", "labels", "Import")} running={running} />
          <ErrorsPanel ctx={ctx} importId={record.id} entityType={entityType} />
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm === "revert" ? t("Revert Import", "labels", "Import") : confirm === "duplicates" ? t("Remove Duplicates", "labels", "Import") : t("Remove Import Log", "labels", "Import")}
        message={confirm ? t(confirmMessages[confirm], "messages", "Import") : ""}
        confirmLabel={t("Yes")}
        cancelLabel={t("Cancel")}
        danger={confirm !== "remove"}
        busy={busy}
        onConfirm={() => confirm && void run(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

/** Bản ghi đã tạo / trùng / đã cập nhật (`GET Import/:id/<link>`). */
function ResultPanel({
  ctx,
  importId,
  entityType,
  link,
  title,
  running,
  onUnmark,
}: {
  ctx: FieldContext;
  importId: string;
  entityType: string;
  link: "imported" | "duplicates" | "updated";
  title: string;
  running: boolean;
  onUnmark?: (item: EspoRecord) => Promise<void>;
}) {
  const { t, metadata } = ctx;
  const [maxSize, setMaxSize] = useState(PAGE_SIZE);
  const list = useQuery({
    queryKey: ["importResult", importId, link, maxSize],
    queryFn: ({ signal }) => listLinked("Import", importId, link, { maxSize, orderBy: "createdAt", order: "desc", select: ["id", "name", "createdAt"] }, signal),
    placeholderData: keepPreviousData,
    refetchInterval: running ? CHECK_INTERVAL : false,
  });
  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;

  return (
    <PanelCard id={`import-${link}`} title={`${title}${total > 0 ? ` (${ctx.numbers.formatInt(total)})` : ""}`}>
      {items.length ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-2 text-sm">
              <Link href={recordViewHref(entityType, item.id, metadata)} className="min-w-0 flex-1 truncate font-medium text-blue-700 hover:underline">
                {String(item.name ?? "") || item.id}
              </Link>
              {typeof item.createdAt === "string" && <span className="text-xs text-slate-500">{ctx.dateTime.toDisplay(item.createdAt)}</span>}
              {onUnmark && (
                <Menu
                  label={`${t("Actions")}: ${String(item.name ?? item.id)}`}
                  items={[{ label: t("Set as Not Duplicate", "labels", "Import"), onSelect: () => void onUnmark(item) }]}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-500">{list.isLoading ? t("Loading...") : t("No Data")}</p>
      )}
      {total > items.length && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button type="button" onClick={() => setMaxSize(maxSize + PAGE_SIZE * 2)} className="text-sm font-medium text-blue-600 hover:underline">
            {t("Show more")}
          </button>
        </div>
      )}
    </PanelCard>
  );
}

type ValidationFailure = { field?: string; type?: string };

/** Dòng lỗi (`ImportError`): số dòng trong CSV gốc, loại lỗi, field sai, nội dung dòng; xuất CSV các dòng lỗi. */
function ErrorsPanel({ ctx, importId, entityType }: { ctx: FieldContext; importId: string; entityType: string }) {
  const { t } = ctx;
  const [maxSize, setMaxSize] = useState(PAGE_SIZE);
  const [exporting, setExporting] = useState(false);
  const list = useQuery({
    queryKey: ["importResult", importId, "errors", maxSize],
    queryFn: ({ signal }) => listLinked("Import", importId, "errors", { maxSize, orderBy: "rowIndex", order: "asc" }, signal),
    placeholderData: keepPreviousData,
  });
  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;

  async function exportErrors() {
    setExporting(true);

    try {
      const { attachmentId } = await exportImportErrors(importId);

      window.location.href = downloadUrl(ctx.classicBasePath, attachmentId);
    } catch (error) {
      toast.error(error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <PanelCard
      id="import-errors"
      title={`${t("errors", "links", "Import")}${total > 0 ? ` (${ctx.numbers.formatInt(total)})` : ""}`}
      actions={
        total > 0 ? (
          <Button variant="ghost" className="h-8 px-2.5" onClick={() => void exportErrors()} disabled={exporting}>
            <i className="fas fa-file-export text-xs" aria-hidden />
            {t("Export", "labels", "Import")}
          </Button>
        ) : null
      }
    >
      {items.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-2">{t("lineNumber", "fields", "ImportError")}</th>
                <th className="px-4 py-2">{t("type", "fields", "ImportError")}</th>
                <th className="px-4 py-2">{t("validationFailures", "fields", "ImportError")}</th>
                <th className="px-4 py-2">{t("row", "fields", "ImportError")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="align-top">
                  <td className="px-4 py-2 tabular-nums">{typeof item.rowIndex === "number" ? item.rowIndex + 1 : ""}</td>
                  <td className="px-4 py-2">{item.type ? t.option(String(item.type), "type", "ImportError") : ""}</td>
                  <td className="px-4 py-2">
                    {(Array.isArray(item.validationFailures) ? (item.validationFailures as ValidationFailure[]) : []).map((failure, index) => (
                      <div key={index}>
                        {t(String(failure.field ?? ""), "fields", entityType)}: {t(String(failure.type ?? ""), "fieldValidations")}
                      </div>
                    ))}
                  </td>
                  <td className="max-w-md truncate px-4 py-2 text-slate-600" title={Array.isArray(item.row) ? item.row.join(", ") : ""}>
                    {Array.isArray(item.row) ? item.row.join(", ") : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-500">{list.isLoading ? t("Loading...") : t("noErrors", "messages", "Import")}</p>
      )}
      {total > items.length && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button type="button" onClick={() => setMaxSize(maxSize + PAGE_SIZE * 2)} className="text-sm font-medium text-blue-600 hover:underline">
            {t("Show more")}
          </button>
        </div>
      )}
    </PanelCard>
  );
}
