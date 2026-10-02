"use client";

// Form soạn email (mới, trả lời, chuyển tiếp, bản nháp) và lưu email có sẵn ("Archive Email").
// Gửi = lưu với status `Sending` (Espo gửi ngay khi lưu); lỗi gửi → email thành bản nháp, giữ id để sửa tiếp.
// Tương đương `views/modals/compose-email` + `views/email/record/compose` + `views/email/record/edit` của classic.
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { getFieldType } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { Checkbox, Select, TextArea, TextInput } from "@/components/fields/ui";
import { RecordPicker } from "@/components/fields/link";
import { FieldCell } from "@/components/record/panels";
import { ErrorSummary } from "@/components/record/record-form";
import { Button, ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import {
  htmlToPlain,
  isValidEmailAddress,
  plainToHtml,
  prepareEmailTemplate,
  sendingFailedMessage,
  splitAddresses,
  withSignature,
} from "@/lib/espo/email";
import { getFieldDefs } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { interpolate } from "@/lib/espo/i18n";
import { createRecord, deleteRecord, updateRecord, type EspoRecord } from "@/lib/espo/records";
import { classicHref, recordViewHref } from "@/lib/espo/routes";
import { AddressInput } from "./address-input";

/** Attribute gửi lên khi lưu/gửi. */
const SAVE_ATTRIBUTES = [
  "from",
  "to",
  "cc",
  "bcc",
  "name",
  "body",
  "isHtml",
  "attachmentsIds",
  "parentType",
  "parentId",
  "teamsIds",
  "repliedId",
  "inReplyTo",
  "sendAt",
  "dateSent",
  "assignedUserId",
];

const str = (value: unknown) => (typeof value === "string" ? value : "");

export type ComposeMode = "compose" | "archive";

/** Giá trị ban đầu: chữ ký, ép HTML khi trả lời (`emailReplyForceHtml`), địa chỉ gửi mặc định. */
export function initialComposeValues(ctx: FieldContext, attributes: Values, mode: ComposeMode, isNew: boolean): Values {
  const values: Values = { isHtml: getFieldDefs(ctx.metadata, "Email", "isHtml")?.default ?? true, ...attributes };

  if (mode === "archive") {
    return { status: "Archived", dateSent: `${ctx.dateTime.getNow(15)}:00`, ...values };
  }

  values.status = "Draft";

  const fromList = Array.isArray(ctx.user.emailAddressList) ? (ctx.user.emailAddressList as string[]) : [];

  if (!values.from && fromList.length) {
    values.from = fromList[0];
  }

  if (!isNew) {
    return values;
  }

  let body = str(values.body);
  let isHtml = values.isHtml !== false;

  if (!isHtml && ctx.preferences.emailReplyForceHtml) {
    body = plainToHtml(body);
    isHtml = true;
  }

  const signature = str(ctx.preferences.signature);

  if (signature) {
    body = withSignature(body, isHtml, signature, "prepend");
  }

  return { ...values, body: body || null, isHtml };
}

export function ComposeForm({
  ctx,
  mode,
  initial,
  saved,
  returnHref,
  title,
}: {
  ctx: FieldContext;
  mode: ComposeMode;
  initial: Values;
  /** Bản nháp đã lưu (mở từ Drafts). */
  saved: EspoRecord | null;
  /** Về đâu sau khi gửi/lưu/huỷ. */
  returnHref: string;
  title: string;
}) {
  const { t, metadata, acl } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const baseId = useId();
  const [values, setValues] = useState<Values>(initial);
  const [id, setId] = useState<string | null>(saved?.id ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"send" | "draft" | "save" | null>(null);
  const [showCc, setShowCc] = useState(!!str(initial.cc));
  const [showBcc, setShowBcc] = useState(!!str(initial.bcc));
  /** Đổi khi thân email bị thay từ ngoài (mẫu, đổi HTML) để trình soạn thảo nạp lại. */
  const [bodyVersion, setBodyVersion] = useState(0);
  const [bodyChanged, setBodyChanged] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<{ id: string; name: string } | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const isArchive = mode === "archive";
  const fromList = Array.isArray(ctx.user.emailAddressList) ? (ctx.user.emailAddressList as string[]) : [];
  const nameHash = (values.nameHash ?? {}) as Record<string, string>;

  const set = (patch: Values) => setValues((current) => ({ ...current, ...patch }));

  useEffect(() => {
    document.title = `${title} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [title, ctx.settings.applicationName]);

  function validate(forSending: boolean): Record<string, string> {
    const found: Record<string, string> = {};
    const label = (field: string) => t(field, "fields", "Email");
    const required = (field: string) => interpolate(t("fieldIsRequired", "messages"), { field: label(field) });

    if (forSending || isArchive) {
      if (!str(values.from).trim()) {
        found.from = required("from");
      }

      if (!splitAddresses(values.to).length) {
        found.to = required("to");
      }
    }

    for (const field of ["from", "to", "cc", "bcc"]) {
      const invalid = splitAddresses(values[field]).find((address) => !isValidEmailAddress(address));

      if (invalid && !found[field]) {
        found[field] = interpolate(t("fieldShouldBeEmail", "messages"), { field: label(field) });
      }
    }

    if (isArchive) {
      if (!str(values.name).trim()) {
        found.name = required("subject");
      }

      if (!values.dateSent) {
        found.dateSent = required("dateSent");
      }
    }

    return found;
  }

  function collect(status: string): Values {
    const data: Values = { status };

    for (const attribute of SAVE_ATTRIBUTES) {
      if (values[attribute] !== undefined) {
        data[attribute] = values[attribute];
      }
    }

    if (!str(data.name).trim()) {
      data.name = t("No Subject", "labels", "Email");
    }

    if (!values.isHtml) {
      data.bodyPlain = data.body ?? null;
    }

    return data;
  }

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["emailList"] }),
      queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] }),
      queryClient.invalidateQueries({ queryKey: ["related"] }),
      queryClient.invalidateQueries({ queryKey: ["stream"] }),
    ]);
  }

  async function save(status: string): Promise<EspoRecord> {
    const data = collect(status);
    const result = id ? await updateRecord("Email", id, data) : await createRecord("Email", data);

    setId(result.id);

    return result;
  }

  function check(forSending: boolean): boolean {
    const found = validate(forSending);

    setErrors(found);

    if (Object.keys(found).length) {
      document.getElementById(`${baseId}-${Object.keys(found)[0]}`)?.focus();

      return false;
    }

    return true;
  }

  async function send() {
    if (busy || !check(true)) {
      return;
    }

    setBusy("send");
    toast.info(t("Sending...", "labels", "Email"));

    try {
      const result = await save("Sending");

      toast.success(t("emailSent", "messages", "Email"));
      await invalidate();
      queryClient.setQueryData(["record", "Email", result.id], result);
      router.push(returnHref);
    } catch (error) {
      // Gửi lỗi: Espo đã lưu email thành bản nháp (`sendingFail` + id) → lần sau sửa đúng bản nháp đó.
      if (error instanceof EspoApiError && error.statusReason === "sendingFail") {
        if (typeof error.body?.id === "string") {
          setId(error.body.id);
        }

        toast.errorText(sendingFailedMessage(typeof error.body?.message === "string" ? error.body.message : null, t));
      } else {
        toast.error(error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function saveDraft() {
    if (busy || !check(false)) {
      return;
    }

    setBusy("draft");

    try {
      const result = await save("Draft");

      toast.success(t("savedAsDraft", "messages", "Email"));
      await invalidate();

      // Bản nháp mới: đổi URL sang trang của bản nháp (mở lại sửa tiếp được).
      if (!saved) {
        router.replace(recordViewHref("Email", result.id, metadata));
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function saveArchived() {
    if (busy || !check(false)) {
      return;
    }

    setBusy("save");

    try {
      const result = await save("Archived");

      toast.success(t("Saved"));
      await invalidate();
      router.push(recordViewHref("Email", result.id, metadata));
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
    }
  }

  async function schedule(sendAt: string) {
    if (!check(true)) {
      return;
    }

    setBusy("send");

    try {
      const data = collect("Draft");
      const result = id ? await updateRecord("Email", id, { ...data, sendAt }) : await createRecord("Email", { ...data, sendAt });

      setId(result.id);
      toast.success(`${t("Scheduled")}: ${str(result.name)}`);
      await invalidate();
      router.push(returnHref);
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(null);
      setScheduling(false);
    }
  }

  async function removeDraft() {
    if (!id) {
      router.push(returnHref);

      return;
    }

    try {
      await deleteRecord("Email", id);
      toast.success(t("Removed"));
      await invalidate();
      router.push(returnHref);
    } catch (error) {
      toast.error(error);
    } finally {
      setConfirmDelete(false);
    }
  }

  function toggleHtml(isHtml: boolean) {
    const body = str(values.body);

    set({ isHtml, body: (isHtml ? plainToHtml(body) : htmlToPlain(body)) || null });
    setBodyVersion((version) => version + 1);
  }

  async function insertTemplate(template: { id: string; name: string }) {
    try {
      const data = await prepareEmailTemplate(template.id, values);
      let body = str(data.body);
      const isHtml = data.isHtml !== false;
      const signature = str(ctx.preferences.signature);

      if (signature) {
        body = withSignature(body, isHtml, signature, "append");
      }

      // Giữ đính kèm đang có (`removeAttachmentsOnSelectTemplate` tắt).
      const currentIds = Array.isArray(values.attachmentsIds) ? (values.attachmentsIds as string[]) : [];
      const currentNames = (values.attachmentsNames ?? {}) as Record<string, string>;
      const ids = [...(data.attachmentsIds ?? []), ...currentIds.filter((item) => !(data.attachmentsIds ?? []).includes(item))];

      set({
        isHtml,
        body: body || null,
        ...(data.subject ? { name: data.subject } : {}),
        attachmentsIds: ids,
        attachmentsNames: { ...currentNames, ...(data.attachmentsNames ?? {}) },
      });
      setBodyVersion((version) => version + 1);
      setBodyChanged(false);
    } catch (error) {
      toast.error(error);
    }
  }

  const bodyDefs = getFieldDefs(metadata, "Email", "body");
  const BodyEdit = bodyDefs ? getFieldType(bodyDefs).Edit : undefined;
  const parentDefs = getFieldDefs(metadata, "Email", "parent");
  const ParentEdit = parentDefs ? getFieldType(parentDefs).Edit : undefined;
  const attachmentsDefs = getFieldDefs(metadata, "Email", "attachments");
  const AttachmentsEdit = attachmentsDefs ? getFieldType(attachmentsDefs).Edit : undefined;
  const dateSentDefs = getFieldDefs(metadata, "Email", "dateSent");
  const DateSentEdit = dateSentDefs ? getFieldType(dateSentDefs).Edit : undefined;

  const field = (name: string, label: string, content: React.ReactNode, required = false) => (
    <FieldCell label={label} htmlFor={`${baseId}-${name}`} required={required} error={errors[name]} errorId={`${baseId}-${name}-error`}>
      {content}
    </FieldCell>
  );

  const addressField = (name: "to" | "cc" | "bcc", required = false) =>
    field(
      name,
      t(name, "fields", "Email"),
      <AddressInput
        ctx={ctx}
        inputId={`${baseId}-${name}`}
        value={str(values[name])}
        nameHash={nameHash}
        invalid={!!errors[name]}
        describedBy={errors[name] ? `${baseId}-${name}-error` : undefined}
        onChange={(value, names) => set({ [name]: value, nameHash: { ...nameHash, ...names } })}
      />,
      required,
    );

  return (
    <form
      ref={formRef}
      noValidate
      className="mx-auto flex max-w-5xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void (isArchive ? saveArchived() : send());
      }}
      onKeyDown={(event) => {
        if (isArchive) {
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          void send();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void saveDraft();
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href="/Email" className="hover:text-slate-800 hover:underline">
              {t("Email", "scopeNamesPlural")}
            </Link>
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words">{title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={returnHref}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            {t(saved || id ? "Close" : "Cancel")}
          </Link>
          {isArchive ? (
            <Button type="submit" variant="primary" disabled={!!busy}>
              {busy && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
              {t("Save")}
            </Button>
          ) : (
            <>
              {id && acl.checkScope("Email", "delete") && (
                <Button onClick={() => setConfirmDelete(true)} aria-label={t("Remove")} title={t("Remove")}>
                  <i className="fas fa-trash text-xs text-red-600" aria-hidden />
                </Button>
              )}
              <Button onClick={() => void saveDraft()} disabled={!!busy} title="Ctrl+S">
                {busy === "draft" && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
                {t("Save Draft", "labels", "Email")}
              </Button>
              <div className="inline-flex">
                <Button type="submit" variant="danger" disabled={!!busy || !fromList.length} title="Ctrl+Enter" className="rounded-r-none">
                  {busy === "send" ? <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden /> : <i className="far fa-paper-plane text-xs" aria-hidden />}
                  {t("Send", "labels", "Email")}
                </Button>
                <Menu
                  label={t("Schedule Send", "labels", "Email")}
                  trigger={<i className="fas fa-caret-down text-xs" aria-hidden />}
                  triggerClassName="inline-flex h-9 items-center rounded-r-lg border-l border-red-700 bg-red-600 px-2 text-white hover:bg-red-700"
                  items={[{ label: t("Schedule Send", "labels", "Email"), icon: "far fa-clock", onSelect: () => setScheduling(true), disabled: !fromList.length }]}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <ErrorSummary errors={errors} />

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
        <div className="grid gap-4 md:grid-cols-2">
          {isArchive
            ? field(
                "from",
                t("from", "fields", "Email"),
                <AddressInput
                  ctx={ctx}
                  inputId={`${baseId}-from`}
                  value={str(values.from)}
                  nameHash={nameHash}
                  single
                  invalid={!!errors.from}
                  onChange={(value, names) => set({ from: value, nameHash: { ...nameHash, ...names } })}
                />,
                true,
              )
            : field(
                "from",
                t("from", "fields", "Email"),
                fromList.length ? (
                  <Select id={`${baseId}-from`} value={str(values.from)} onChange={(event) => set({ from: event.target.value })} invalid={!!errors.from}>
                    {[...new Set([...fromList, ...(str(values.from) ? [str(values.from)] : [])])].map((address) => (
                      <option key={address} value={address}>
                        {address}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {t("noSmtpSetup", "messages", "Email").split("{link}")[0]}
                    <a href={classicHref("#EmailAccount")} className="font-medium underline">
                      {t("EmailAccount", "scopeNamesPlural")}
                    </a>
                  </p>
                ),
                true,
              )}
          {isArchive && DateSentEdit && dateSentDefs
            ? field(
                "dateSent",
                t("dateSent", "fields", "Email"),
                <DateSentEdit
                  ctx={ctx}
                  scope="Email"
                  name="dateSent"
                  defs={dateSentDefs}
                  values={values}
                  onChange={set}
                  inputId={`${baseId}-dateSent`}
                  invalid={!!errors.dateSent}
                  required
                />,
                true,
              )
            : null}
        </div>
        <div className="flex flex-col gap-1">
          {addressField("to", true)}
          {(!showCc || !showBcc) && (
            <div className="flex gap-3 text-xs">
              {!showCc && (
                <button type="button" onClick={() => setShowCc(true)} className="font-medium text-blue-600 hover:underline">
                  {t("cc", "fields", "Email")}
                </button>
              )}
              {!showBcc && (
                <button type="button" onClick={() => setShowBcc(true)} className="font-medium text-blue-600 hover:underline">
                  {t("bcc", "fields", "Email")}
                </button>
              )}
            </div>
          )}
        </div>
        {showCc && addressField("cc")}
        {showBcc && addressField("bcc")}
        <div className="grid gap-4 md:grid-cols-2">
          {ParentEdit &&
            parentDefs &&
            field(
              "parent",
              t("parent", "fields", "Email"),
              <ParentEdit ctx={ctx} scope="Email" name="parent" defs={parentDefs} values={values} onChange={set} inputId={`${baseId}-parent`} invalid={false} required={false} />,
            )}
          {!isArchive &&
            acl.checkScope("EmailTemplate", "read") &&
            field(
              "selectTemplate",
              t("selectTemplate", "fields", "Email"),
              <RecordPicker
                ctx={ctx}
                foreignScope="EmailTemplate"
                inputId={`${baseId}-selectTemplate`}
                onSelect={(option) => {
                  const hasBody = htmlToPlain(str(values.body)).trim() !== "";

                  if (hasBody && bodyChanged) {
                    setPendingTemplate(option);
                  } else {
                    void insertTemplate(option);
                  }
                }}
              />,
            )}
        </div>
        {field(
          "name",
          t("subject", "fields", "Email"),
          <TextInput id={`${baseId}-name`} value={str(values.name)} onChange={(event) => set({ name: event.target.value })} invalid={!!errors.name} />,
          isArchive,
        )}
        <FieldCell label={t("body", "fields", "Email")} htmlFor={`${baseId}-body`}>
          {values.isHtml !== false && BodyEdit && bodyDefs ? (
            <BodyEdit
              key={bodyVersion}
              ctx={ctx}
              scope="Email"
              name="body"
              defs={bodyDefs}
              values={values}
              onChange={(patch) => {
                set(patch);
                setBodyChanged(true);
              }}
              inputId={`${baseId}-body`}
              invalid={false}
              required={false}
            />
          ) : (
            <TextArea
              id={`${baseId}-body`}
              rows={14}
              value={str(values.body)}
              onChange={(event) => {
                set({ body: event.target.value || null });
                setBodyChanged(true);
              }}
            />
          )}
        </FieldCell>
        <div className="flex flex-wrap items-start justify-between gap-4">
          {AttachmentsEdit && attachmentsDefs && (
            <FieldCell label={t("attachments", "fields", "Email")} htmlFor={`${baseId}-attachments`}>
              <AttachmentsEdit
                ctx={ctx}
                scope="Email"
                name="attachments"
                defs={attachmentsDefs}
                values={values}
                onChange={set}
                inputId={`${baseId}-attachments`}
                invalid={false}
                required={false}
              />
            </FieldCell>
          )}
          <Checkbox label={t("isHtml", "fields", "Email")} checked={values.isHtml !== false} onChange={(event) => toggleHtml(event.target.checked)} />
        </div>
      </section>

      <ConfirmDialog
        open={!!pendingTemplate}
        title={t("selectTemplate", "fields", "Email")}
        message={t("confirmInsertTemplate", "messages", "Email")}
        confirmLabel={t("Yes")}
        cancelLabel={t("Cancel")}
        onConfirm={() => {
          const template = pendingTemplate;

          setPendingTemplate(null);

          if (template) {
            void insertTemplate(template);
          }
        }}
        onCancel={() => setPendingTemplate(null)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={t("Remove")}
        message={<span className="whitespace-pre-line">{t("removeRecordConfirmation", "messages", "Email")}</span>}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        onConfirm={() => void removeDraft()}
        onCancel={() => setConfirmDelete(false)}
      />

      {scheduling && <ScheduleDialog ctx={ctx} busy={busy === "send"} onClose={() => setScheduling(false)} onSchedule={(sendAt) => void schedule(sendAt)} />}
    </form>
  );
}

/** Hẹn giờ gửi (`views/email/modals/schedule-send`): mặc định 10 phút tới, phải sau hiện tại. */
function ScheduleDialog({
  ctx,
  busy,
  onClose,
  onSchedule,
}: {
  ctx: FieldContext;
  busy: boolean;
  onClose: () => void;
  onSchedule: (sendAt: string) => void;
}) {
  const { t, metadata } = ctx;
  const inputId = useId();
  const [values, setValues] = useState<Values>(() => {
    const date = new Date(Date.now() + 10 * 60_000);

    date.setUTCSeconds(0, 0);
    date.setUTCMinutes(Math.ceil(date.getUTCMinutes() / 10) * 10);

    return { sendAt: date.toISOString().slice(0, 16).replace("T", " ") + ":00" };
  });
  const [error, setError] = useState<string | null>(null);
  const defs = getFieldDefs(metadata, "Email", "sendAt") ?? { type: "datetime" };
  const Edit = getFieldType(defs).Edit;

  function submit() {
    const sendAt = str(values.sendAt);

    if (!sendAt) {
      setError(interpolate(t("fieldIsRequired", "messages"), { field: t("sendAt", "fields", "Email") }));

      return;
    }

    if (sendAt <= `${ctx.dateTime.getNow()}:00`) {
      setError(interpolate(t("fieldShouldAfter", "messages"), { field: t("sendAt", "fields", "Email"), otherField: t("Now") }));

      return;
    }

    onSchedule(sendAt);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("Schedule Send", "labels", "Email")}
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="danger" onClick={submit} disabled={busy}>
            {t("Schedule")}
          </Button>
        </>
      }
    >
      <FieldCell label={t("sendAt", "fields", "Email")} htmlFor={inputId} required error={error} errorId={`${inputId}-error`}>
        {Edit && (
          <Edit
            ctx={ctx}
            scope="Email"
            name="sendAt"
            defs={defs}
            values={values}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            inputId={inputId}
            invalid={!!error}
            required
            describedBy={error ? `${inputId}-error` : undefined}
          />
        )}
      </FieldCell>
    </Dialog>
  );
}
