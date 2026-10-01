"use client";

// Nút hành động riêng ở đầu trang chi tiết (Set Held/Not Held, trạng thái tham dự, chuyển đổi Lead).
// Điều kiện hiện lấy từ metadata (`lib/espo/record-actions.ts`), nên entity tự tạo cùng kiểu cũng dùng được.
import Link from "next/link";
import { useState } from "react";
import { acceptanceStyle } from "@/components/fields/event";
import type { FieldContext } from "@/components/fields/types";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { acceptanceOptions, canConvert, canSetHeld, myAcceptanceStatus, statusFieldOf } from "@/lib/espo/record-actions";
import { getRecord, postAction, updateRecord, type EspoRecord } from "@/lib/espo/records";

const STYLE_ICONS: Record<string, string> = {
  success: "fas fa-check-circle text-emerald-600",
  danger: "fas fa-times-circle text-red-600",
  warning: "fas fa-question-circle text-amber-500",
};

export function RecordHeaderActions({
  ctx,
  scope,
  record,
  canEdit,
  onRecordChange,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  canEdit: boolean;
  onRecordChange: (record: EspoRecord) => void;
}) {
  const { t, metadata, acl } = ctx;
  const [busy, setBusy] = useState(false);
  const [acceptanceOpen, setAcceptanceOpen] = useState(false);
  const statusField = statusFieldOf(metadata, scope);
  const acceptance = myAcceptanceStatus(metadata, scope, record, ctx.user.id);

  async function run(action: () => Promise<EspoRecord>, message = t("Saved")) {
    setBusy(true);

    try {
      onRecordChange(await action());
      toast.success(message);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (status: string) =>
    run(async () => ({ ...record, ...(await updateRecord(scope, record.id, { [statusField!]: status })) }));

  const setAcceptance = (status: string) => {
    setAcceptanceOpen(false);

    return run(async () => {
      await postAction(scope, "setAcceptanceStatus", { id: record.id, status });

      return getRecord(scope, record.id);
    });
  };

  const acceptanceLabel =
    acceptance && acceptance !== "None" ? t.option(acceptance, "acceptanceStatus", scope) : t("Acceptance", "labels", scope);
  const acceptanceIcon = STYLE_ICONS[acceptanceStyle(ctx, scope, acceptance ?? null) ?? ""];

  return (
    <>
      {acceptance !== undefined && (
        <Button onClick={() => setAcceptanceOpen(true)} disabled={busy}>
          {acceptanceIcon && <i className={`${acceptanceIcon} text-xs`} aria-hidden />}
          {acceptanceLabel}
        </Button>
      )}

      {canSetHeld(metadata, acl, scope, record, canEdit) && (
        <>
          <Button onClick={() => setStatus("Held")} disabled={busy}>
            <i className="fas fa-check text-xs text-emerald-600" aria-hidden />
            {t("Set Held", "labels", scope)}
          </Button>
          <Button onClick={() => setStatus("Not Held")} disabled={busy}>
            <i className="fas fa-ban text-xs text-slate-400" aria-hidden />
            {t("Set Not Held", "labels", scope)}
          </Button>
        </>
      )}

      {canConvert(metadata, scope, record, canEdit) && (
        <Link
          href={`/${scope}/${encodeURIComponent(record.id)}/convert`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <i className="fas fa-exchange-alt text-xs text-slate-400" aria-hidden />
          {t("Convert", "labels", scope)}
        </Link>
      )}

      <Dialog
        open={acceptanceOpen}
        onClose={() => setAcceptanceOpen(false)}
        title={t("Acceptance", "labels", scope)}
        size="sm"
        footer={<Button onClick={() => setAcceptanceOpen(false)}>{t("Cancel")}</Button>}
      >
        <div className="flex flex-wrap gap-2">
          {acceptanceOptions(metadata, scope).map((status) => {
            const icon = STYLE_ICONS[acceptanceStyle(ctx, scope, status) ?? ""];

            return (
              <Button key={status} onClick={() => setAcceptance(status)} aria-pressed={acceptance === status} disabled={busy}>
                {icon && <i className={`${icon} text-xs`} aria-hidden />}
                {t.option(status, "acceptanceStatus", scope)}
              </Button>
            );
          })}
        </div>
      </Dialog>
    </>
  );
}
