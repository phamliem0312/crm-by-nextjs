"use client";

// Hộp thoại Export: chọn định dạng, xuất các cột đang hiển thị hoặc mọi field; xuất nền (idle) khi nhiều bản ghi.
// Port từ `views/export/modals/export` + `views/export/modals/idle` của classic.
import { useEffect, useId, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { Checkbox, Select } from "@/components/fields/ui";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  downloadUrl,
  exportAttributeList,
  exportFormats,
  exportShouldBeIdle,
  getExportStatus,
  startExport,
  type ExportStatus,
} from "@/lib/espo/export";
import type { SearchParams } from "@/lib/espo/search";

export function ExportDialog({
  ctx,
  scope,
  fields,
  ids,
  searchParams,
  total,
  onClose,
}: {
  ctx: FieldContext;
  scope: string;
  /** Cột của list (xuất mặc định các cột này). */
  fields: string[];
  /** Bản ghi đã chọn; `null` = mọi kết quả theo bộ lọc hiện tại. */
  ids: string[] | null;
  searchParams: SearchParams;
  total: number;
  onClose: () => void;
}) {
  const { t } = ctx;
  const formatId = useId();
  const formats = exportFormats(ctx.metadata, scope);
  const [format, setFormat] = useState(formats[0]);
  const [allFields, setAllFields] = useState(false);
  const [lite, setLite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idle, setIdle] = useState<{ id: string; status: ExportStatus | null } | null>(null);

  const download = (attachmentId: string) => {
    window.location.href = downloadUrl(ctx.classicBasePath, attachmentId);
  };

  // Xuất nền: hỏi trạng thái mỗi 2 giây tới khi xong.
  useEffect(() => {
    if (!idle || (idle.status && !["Pending", "Running"].includes(idle.status.status))) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const status = await getExportStatus(idle.id);

        setIdle({ id: idle.id, status });
      } catch (error) {
        toast.error(error);
        setIdle({ id: idle.id, status: { status: "Failed" } });
      }
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [idle]);

  async function run() {
    setBusy(true);

    try {
      const result = await startExport({
        entityType: scope,
        format,
        ...(ids ? { ids } : { searchParams: { ...searchParams, maxSize: undefined, offset: undefined, select: undefined } }),
        ...(allFields ? {} : { fieldList: fields, attributeList: exportAttributeList(ctx.metadata, scope, fields) }),
        idle: exportShouldBeIdle(total, !ids, ctx.settings, ctx.user.type === "portal"),
        ...(format === "xlsx" ? { params: { lite } } : {}),
      });

      if (result.exportId) {
        setIdle({ id: result.exportId, status: null });

        return;
      }

      if (result.id) {
        download(result.id);
        onClose();
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  const status = idle?.status?.status ?? (idle ? "Pending" : null);

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Export")}
      size="sm"
      footer={
        idle ? (
          <>
            {status === "Success" && idle.status?.attachmentId && (
              <Button variant="primary" onClick={() => download(idle.status!.attachmentId!)}>
                <i className="fas fa-download text-xs" aria-hidden />
                {t("Download")}
              </Button>
            )}
            <Button onClick={onClose}>{t("Close")}</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={busy}>
              {t("Cancel")}
            </Button>
            <Button variant="primary" onClick={() => void run()} disabled={busy}>
              {busy && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
              {t("Export")}
            </Button>
          </>
        )
      }
    >
      {idle ? (
        <div className="flex flex-col gap-3" role="status">
          <p>{t("infoText", "messages", "Export")}</p>
          <p className="font-medium">
            {t("status", "fields", "Export")}: {t.option(status ?? "Pending", "status", "Export")}
            {(status === "Pending" || status === "Running") && <i className="fas fa-circle-notch fa-spin ml-2 text-xs" aria-hidden />}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-slate-500">
            {ids ? `${ids.length} / ${ctx.numbers.formatInt(total)}` : `${t("Total")}: ${ctx.numbers.formatInt(total)}`}
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={formatId} className="text-xs font-medium text-slate-500">
              {t("format", "fields", "Export")}
            </label>
            <Select id={formatId} value={format} onChange={(event) => setFormat(event.target.value)}>
              {formats.map((item) => (
                <option key={item} value={item}>
                  {t.option(item, "format", "Export")}
                </option>
              ))}
            </Select>
          </div>
          <Checkbox label={t("exportAllFields", "fields", "Export")} checked={allFields} onChange={(event) => setAllFields(event.target.checked)} />
          {!allFields && (
            <p className="text-xs text-slate-500">
              {t("fieldList", "fields", "Export")}: {fields.map((field) => t(field, "fields", scope)).join(", ")}
            </p>
          )}
          {format === "xlsx" && (
            <Checkbox label={t("xlsxLite", "fields", "Export")} checked={lite} onChange={(event) => setLite(event.target.checked)} />
          )}
        </div>
      )}
    </Dialog>
  );
}
