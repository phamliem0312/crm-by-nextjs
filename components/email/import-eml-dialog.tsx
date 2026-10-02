"use client";

// Nhập một file .eml thành email (`views/email/modals/import-eml`): tải file lên (Attachment của `ImportEml`)
// rồi `POST Email/importEml`, mở email vừa tạo.
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { FieldCell } from "@/components/record/panels";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { interpolate } from "@/lib/espo/i18n";
import { sendRequest, uploadAttachment } from "@/lib/espo/records";

export function ImportEmlDialog({ ctx, onClose }: { ctx: FieldContext; onClose: () => void }) {
  const { t } = ctx;
  const router = useRouter();
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = t("file", "otherFields", "Email");

  async function proceed() {
    if (!file) {
      setError(interpolate(t("fieldIsRequired", "messages"), { field: label }));

      return;
    }

    setBusy(true);

    try {
      const attachment = await uploadAttachment(file, { relatedType: "ImportEml", field: "file" });
      const result = await sendRequest<{ id: string }>("POST", "Email/importEml", { fileId: attachment.id });

      router.push(`/Email/${encodeURIComponent(result.id)}`);
    } catch (e) {
      toast.error(e);
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Import EML", "labels", "Email")}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="danger" onClick={() => void proceed()} disabled={busy}>
            {busy && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
            {t("Proceed")}
          </Button>
        </>
      }
    >
      <FieldCell label={label} htmlFor={inputId} required error={error} errorId={`${inputId}-error`}>
        <input
          id={inputId}
          type="file"
          accept=".eml,message/rfc822"
          aria-describedby={error ? `${inputId}-error` : undefined}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setError(null);
          }}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:text-slate-700 hover:file:bg-slate-50"
        />
      </FieldCell>
    </Dialog>
  );
}
