"use client";

// Trang chi tiết email: người gửi/nhận, thân (iframe sandbox), đính kèm, parent sửa nhanh, cột bên (trạng thái,
// thư mục, team, trả lời…). Trả lời/Trả lời tất cả/Chuyển tiếp, quan trọng, thùng rác, lưu trữ, chuyển thư mục,
// tạo Lead/Contact/Task/Case/Document từ email. Bản nháp mở thẳng form soạn.
// Tương đương `views/email/detail` + `views/email/record/detail` của classic.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { useFieldContext } from "@/components/fields/use-field-context";
import { CreatedModified, DetailField } from "@/components/record/detail-view";
import { useLayout } from "@/components/record/hooks";
import { FieldCell } from "@/components/record/panels";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { Button, ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import {
  caseAttributesFromEmail,
  copyEmailAttachments,
  FOLDER,
  folderString,
  isInArchive,
  isInTrash,
  moveFolderParamsFor,
  personAttributesFromEmail,
  splitAddresses,
  subjectStyle,
  taskAttributesFromEmail,
} from "@/lib/espo/email";
import { getFieldDefs } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { buildDefaultSideFields } from "@/lib/espo/layout";
import { deleteRecord, getRecord, sendRequest, type EspoRecord } from "@/lib/espo/records";
import { classicHref, recordCreateHref, recordViewHref } from "@/lib/espo/routes";
import { AddressList } from "./address-input";
import { ComposeForm, initialComposeValues } from "./compose-form";
import { runMailboxAction, type MailboxAction } from "./email-actions";
import { EmailBody } from "./email-body";
import { MoveFolderDialog } from "./folder-dialog";
import { useRefreshEmails } from "./hooks";

export function EmailDetail({ id }: { id: string }) {
  const ctx = useFieldContext();
  const queryClient = useQueryClient();
  const sideLayout = useLayout<{ name: string }[]>("Email", "defaultSidePanel", { optional: true });
  const record = useQuery({
    queryKey: ["record", "Email", id],
    queryFn: ({ signal }) => getRecord("Email", id, signal),
    meta: { silent: true },
    retry: false,
  });

  // Mở email = đã đọc (Espo đánh dấu khi GET) → cập nhật số chưa đọc và list.
  const loadedId = record.data?.id;

  useEffect(() => {
    if (loadedId) {
      void queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] });
      void queryClient.invalidateQueries({ queryKey: ["emailList"] });
    }
  }, [loadedId, queryClient]);

  if (record.error instanceof EspoApiError && (record.error.status === 404 || record.error.status === 403)) {
    return (
      <PageMessage
        icon={record.error.status === 404 ? "fas fa-question" : "fas fa-lock"}
        title={ctx?.t(record.error.status === 404 ? "Not found" : "Access denied") ?? ""}
      />
    );
  }

  if (!ctx || !record.data || sideLayout.isLoading) {
    return record.error ? <PageMessage icon="fas fa-exclamation-triangle" title={ctx?.t("Error") ?? "Error"} /> : <LoadingBlock />;
  }

  const email = record.data;

  if (email.status === "Draft" && ctx.acl.checkRecord("Email", email, "edit", { hasField: () => true }) !== false) {
    return (
      <ComposeForm
        key={email.id}
        ctx={ctx}
        mode="compose"
        initial={initialComposeValues(ctx, email, "compose", false)}
        saved={email}
        returnHref="/Email?folder=drafts"
        title={String(email.name ?? "") || ctx.t("Compose Email", "labels")}
      />
    );
  }

  return <EmailView ctx={ctx} email={email} sideLayout={sideLayout.data ?? null} />;
}

function EmailView({ ctx, email, sideLayout }: { ctx: FieldContext; email: EspoRecord; sideLayout: { name: string }[] | null }) {
  const { t, metadata, acl, user } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = useRefreshEmails();
  const [moving, setMoving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showPlain, setShowPlain] = useState(false);
  const [busy, setBusy] = useState(false);
  const hasField = (field: string) => !!getFieldDefs(metadata, "Email", field);
  const canEdit = acl.checkScope("Email", "edit") && acl.checkRecord("Email", email, "edit", { hasField }) !== false;
  const canDelete = acl.checkScope("Email", "delete") && acl.checkRecord("Email", email, "delete", { hasField }) !== false;
  const nameHash = (email.nameHash ?? {}) as Record<string, string>;
  const typeHash = (email.typeHash ?? {}) as Record<string, string>;
  const idHash = (email.idHash ?? {}) as Record<string, string>;
  const style = subjectStyle(email);
  const inTrash = isInTrash(email);
  const inArchive = isInArchive(email);
  const subject = String(email.name ?? "") || t("No Subject", "labels", "Email");
  const sideFields = useMemo(
    () => buildDefaultSideFields(sideLayout, { scope: "Email", metadata, acl }).filter((field) => field !== "folderString"),
    [sideLayout, metadata, acl],
  );
  const folders = folderString(email, user.id, t);
  const replyAll = !!ctx.preferences.emailReplyToAllByDefault;

  useEffect(() => {
    document.title = `${subject} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [subject, ctx.settings.applicationName]);

  const setEmail = (patch: Record<string, unknown>) => queryClient.setQueryData(["record", "Email", email.id], { ...email, ...patch });

  async function act(action: MailboxAction, patch: Record<string, unknown>) {
    setBusy(true);

    try {
      await runMailboxAction(ctx, [email.id], action);
      setEmail(patch);
      // Không tải lại email (GET sẽ đánh dấu đã đọc lại); chỉ làm mới list và số chưa đọc.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["emailList"] }),
        queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] }),
      ]);

      if (action.kind === "read" && !action.value) {
        router.push("/Email");
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);

    try {
      await deleteRecord("Email", email.id);
      toast.success(t("Removed"));
      await refresh();
      router.push("/Email");
    } catch (error) {
      toast.error(error);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const createHref = (scope: string, attributes: Record<string, unknown>) =>
    `${recordCreateHref(scope, metadata)}?${new URLSearchParams({ attributes: JSON.stringify(attributes) }).toString()}`;

  async function createCase() {
    setBusy(true);

    try {
      const attributes = caseAttributesFromEmail(email);
      const attachmentIds = Array.isArray(email.attachmentsIds) ? email.attachmentsIds : [];

      if (attachmentIds.length) {
        const copied = await copyEmailAttachments(email.id, "Case", "attachments");

        attributes.attachmentsIds = copied.ids;
        attributes.attachmentsNames = copied.names;
      }

      router.push(createHref("Case", attributes));
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  }

  async function createDocument(attachmentId: string) {
    setBusy(true);

    try {
      const attachment = await sendRequest<{ id: string; name: string }>("POST", `Attachment/copy/${encodeURIComponent(attachmentId)}`, {
        relatedType: "Document",
        field: "file",
      });
      const attributes: Record<string, unknown> = { fileId: attachment.id, fileName: attachment.name, name: attachment.name };

      if (email.accountId) {
        attributes.accountsIds = [email.accountId];
        attributes.accountsNames = { [String(email.accountId)]: email.accountName };
      }

      router.push(createHref("Document", attributes));
    } catch (error) {
      toast.error(error);
      setBusy(false);
    }
  }

  const attachmentIds = Array.isArray(email.attachmentsIds) ? (email.attachmentsIds as string[]) : [];
  const mailbox = !!email.isUsers || !!email.groupFolderId;
  const composeHref = (params: Record<string, string>) => `/Email/compose?${new URLSearchParams(params).toString()}`;

  const menu: MenuItem[] = [
    { label: t("Reply", "labels", "Email"), icon: "fas fa-reply", onSelect: () => router.push(composeHref({ reply: email.id })) },
    { label: t("Reply to All", "labels", "Email"), icon: "fas fa-reply-all", onSelect: () => router.push(composeHref({ reply: email.id, all: "1" })) },
    { label: t("Forward", "labels", "Email"), icon: "fas fa-share", onSelect: () => router.push(composeHref({ forward: email.id })) },
    { kind: "divider" },
    ...(email.status === "Archived" && !email.parentId
      ? [
          ...(acl.checkScope("Lead", "create")
            ? [{ label: t("Create Lead", "labels", "Email"), icon: "fas fa-plus", onSelect: () => router.push(createHref("Lead", personAttributesFromEmail(email))) }]
            : []),
          ...(acl.checkScope("Contact", "create")
            ? [{ label: t("Create Contact", "labels", "Email"), icon: "fas fa-plus", onSelect: () => router.push(createHref("Contact", personAttributesFromEmail(email))) }]
            : []),
        ]
      : []),
    ...(acl.checkScope("Task", "create")
      ? [
          {
            label: t("Create Task", "labels", "Email"),
            icon: "fas fa-plus",
            onSelect: () => router.push(createHref("Task", taskAttributesFromEmail(email, recordViewHref("Email", email.id, metadata), t))),
          },
        ]
      : []),
    ...(acl.checkScope("Case", "create") && (email.parentType !== "Case" || !email.parentId)
      ? [{ label: t("Create Case", "labels", "Email"), icon: "fas fa-plus", onSelect: () => void createCase() }]
      : []),
    ...(acl.checkScope("Document", "create") && attachmentIds.length === 1
      ? [{ label: t("Create Document", "labels", "Document"), icon: "fas fa-plus", onSelect: () => void createDocument(attachmentIds[0]) }]
      : []),
    { kind: "divider" },
    ...(email.isUsers
      ? [
          email.isImportant
            ? { label: t("Unmark Importance", "labels", "Email"), onSelect: () => void act({ kind: "important", value: false }, { isImportant: false }) }
            : { label: t("Mark as Important", "labels", "Email"), icon: "far fa-star", onSelect: () => void act({ kind: "important", value: true }, { isImportant: true }) },
          { label: t("markAsNotRead", "massActions", "Email"), onSelect: () => void act({ kind: "read", value: false }, { isRead: false }) },
        ]
      : []),
    ...(mailbox
      ? [
          inTrash
            ? {
                label: t("Retrieve from Trash", "labels", "Email"),
                onSelect: () => void act({ kind: "trash", value: false }, email.groupFolderId ? { groupStatusFolder: null } : { inTrash: false }),
              }
            : {
                label: t("Move to Trash", "labels", "Email"),
                icon: "far fa-trash-can",
                onSelect: () => void act({ kind: "trash", value: true }, email.groupFolderId ? { groupStatusFolder: "Trash" } : { inTrash: true }),
              },
          ...(!inArchive && !(email.groupFolderId && inTrash)
            ? [
                {
                  label: t("moveToArchive", "actions", "Email"),
                  icon: "far fa-caret-square-down",
                  onSelect: () =>
                    void act({ kind: "folder", folderId: FOLDER.archive }, email.groupFolderId ? { groupStatusFolder: "Archive" } : { inArchive: true }),
                },
              ]
            : []),
        ]
      : []),
    ...(!(email.groupFolderId && inTrash) ? [{ label: t("Move to Folder", "labels", "Email"), icon: "far fa-folder", onSelect: () => setMoving(true) }] : []),
    { kind: "divider" },
    ...(email.isHtml && email.bodyPlain ? [{ label: t("Show Plain Text", "labels", "Email"), onSelect: () => setShowPlain(true) }] : []),
    { label: t("Print", "labels"), icon: "fas fa-print", onSelect: () => printEmail() },
  ];

  function printEmail() {
    const frame = document.querySelector<HTMLIFrameElement>("iframe[title=Email]");

    if (frame?.contentWindow) {
      frame.contentWindow.print();

      return;
    }

    window.print();
  }

  const row = (label: string, content: React.ReactNode) =>
    content ? (
      <div className="grid gap-1 sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-xs font-medium text-slate-500 sm:pt-0.5">{label}</dt>
        <dd className="min-w-0 text-sm text-slate-800">{content}</dd>
      </div>
    ) : null;

  const addresses = (field: string) =>
    splitAddresses(email[field]).length > 0 && (
    <AddressList
      value={email[field]}
      nameHash={nameHash}
      typeHash={typeHash}
      idHash={idHash}
      renderLink={(scope, id, name) => (
        <Link href={recordViewHref(scope, id, metadata)} className="font-medium text-blue-700 hover:underline">
          {name}
        </Link>
      )}
    />
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href="/Email" className="hover:text-slate-800 hover:underline">
              {t("Email", "scopeNamesPlural")}
            </Link>
          </nav>
          <h1
            className={`mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight break-words ${
              style === "important" ? "text-amber-700" : style === "trash" ? "text-slate-400" : style === "archive" ? "text-sky-700" : ""
            }`}
          >
            {subject}
            {!!email.isUsers && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ kind: "important", value: !email.isImportant }, { isImportant: !email.isImportant })}
                aria-pressed={!!email.isImportant}
                aria-label={email.isImportant ? t("Unmark Importance", "labels", "Email") : t("Mark as Important", "labels", "Email")}
                title={email.isImportant ? t("Unmark Importance", "labels", "Email") : t("Mark as Important", "labels", "Email")}
                className={`rounded p-1 text-base ${email.isImportant ? "text-amber-500" : "text-slate-300 hover:text-slate-500"}`}
              >
                <i className={email.isImportant ? "fas fa-star" : "far fa-star"} aria-hidden />
              </button>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {acl.checkScope("Email", "create") && (
            <Link
              href={composeHref(replyAll ? { reply: email.id, all: "1" } : { reply: email.id })}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700"
            >
              <i className={`fas ${replyAll ? "fa-reply-all" : "fa-reply"} text-xs`} aria-hidden />
              {t(replyAll ? "Reply to All" : "Reply", "labels", "Email")}
            </Link>
          )}
          <Menu
            label={t("Actions")}
            triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800"
            items={acl.checkScope("Email", "create") ? menu : menu.slice(4)}
          />
          {canDelete && (
            <Button onClick={() => setConfirmDelete(true)} aria-label={t("Remove")} title={t("Remove")}>
              <i className="fas fa-trash text-xs text-red-600" aria-hidden />
            </Button>
          )}
          <a
            href={classicHref(`#Email/view/${encodeURIComponent(email.id)}`)}
            className="inline-flex h-9 items-center rounded-lg px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="EspoCRM Classic"
            aria-label="EspoCRM Classic"
          >
            <i className="fas fa-external-link-alt text-xs" aria-hidden />
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
            <dl className="flex flex-col gap-2">
              {row(t("from", "fields", "Email"), addresses("from"))}
              {row(t("to", "fields", "Email"), addresses("to"))}
              {row(t("cc", "fields", "Email"), addresses("cc"))}
              {row(t("bcc", "fields", "Email"), addresses("bcc"))}
              {row(t("replyTo", "fields", "Email"), addresses("replyTo"))}
              {row(
                t("dateSent", "fields", "Email"),
                typeof email.dateSent === "string" && email.dateSent ? <span className="tabular-nums">{ctx.dateTime.toDisplay(email.dateSent)}</span> : null,
              )}
            </dl>
            <div className="grid gap-4 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <DetailField
                ctx={ctx}
                scope="Email"
                record={email}
                field="parent"
                label={t("parent", "fields", "Email")}
                noLabel={false}
                canEdit={canEdit}
                onSaved={(next) => queryClient.setQueryData(["record", "Email", email.id], next)}
              />
              {attachmentIds.length > 0 && (
                <FieldCell label={t("attachments", "fields", "Email")}>
                  <FieldValue
                    ctx={ctx}
                    scope="Email"
                    name="attachments"
                    defs={getFieldDefs(metadata, "Email", "attachments") ?? { type: "attachmentMultiple" }}
                    values={email}
                    mode="detail"
                  />
                </FieldCell>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs" aria-label={t("body", "fields", "Email")}>
            <EmailBody
              html={String(email.body ?? "")}
              plain={String(email.isHtml ? (email.bodyPlain ?? "") : (email.body ?? email.bodyPlain ?? ""))}
              isHtml={!!email.isHtml}
              espoBasePath={ctx.classicBasePath}
            />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
            {folders.length > 0 && (
              <FieldCell label={t("folderString", "fields", "Email")}>
                <span className="flex flex-wrap gap-1.5">
                  {folders.map((item) => (
                    <Badge key={item}>{item}</Badge>
                  ))}
                </span>
              </FieldCell>
            )}
            {sideFields.map((field) => (
              <DetailField
                key={field}
                ctx={ctx}
                scope="Email"
                record={email}
                field={field}
                label={t(field, "fields", "Email")}
                noLabel={false}
                canEdit={canEdit && field !== "replied"}
                onSaved={(next) => queryClient.setQueryData(["record", "Email", email.id], next)}
              />
            ))}
            <CreatedModified ctx={ctx} scope="Email" record={email} />
          </section>
        </aside>
      </div>

      <MoveFolderDialog
        ctx={ctx}
        params={moving ? moveFolderParamsFor(email) : null}
        onClose={() => setMoving(false)}
        onSelect={(folderId) => {
          setMoving(false);
          void act(
            { kind: "folder", folderId },
            email.groupFolderId
              ? { groupStatusFolder: folderId === FOLDER.archive ? "Archive" : null }
              : { inArchive: folderId === FOLDER.archive, folderId: folderId === FOLDER.inbox || folderId === FOLDER.archive ? null : folderId },
          ).then(() => queryClient.invalidateQueries({ queryKey: ["record", "Email", email.id] }));
        }}
      />

      <Dialog open={showPlain} onClose={() => setShowPlain(false)} title={t("Show Plain Text", "labels", "Email")} size="lg">
        <pre className="text-sm break-words whitespace-pre-wrap text-slate-800">{String(email.bodyPlain ?? "")}</pre>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={t("Remove")}
        message={<span className="whitespace-pre-line">{t("removeRecordConfirmation", "messages", "Email")}</span>}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
