"use client";

// Một mục của Stream: thông điệp (ai làm gì), nội dung post (Markdown + mention), đính kèm, chi tiết thay đổi,
// reaction, và menu sửa/xoá/ghim/trích dẫn. Port từ `views/stream/note` + `views/stream/notes/*`.
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { attachmentMultipleField } from "@/components/fields/extra";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { Badge, TextArea } from "@/components/fields/ui";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { Markdown } from "@/components/ui/markdown";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { getFieldDefs } from "@/lib/espo/entity";
import { applyMentions, type Mention } from "@/lib/espo/markdown";
import { recordViewHref } from "@/lib/espo/routes";
import {
  availableReactions,
  deleteNote,
  messageParts,
  messageTemplate,
  noteEditable,
  noteMessage,
  notePinnable,
  noteRemovable,
  setNotePinned,
  setNoteReaction,
  toggleReaction,
  updateNote,
  type MessagePart,
  type Note,
  type StreamContext,
} from "@/lib/espo/stream";

const AttachmentsEdit = attachmentMultipleField.Edit!;
const AttachmentsDisplay = attachmentMultipleField.Display;

/** Thời gian ngắn như `datetime-short`: hôm nay chỉ giờ, năm nay bỏ năm. */
export function ShortDateTime({ ctx, value }: { ctx: FieldContext; value: string | undefined | null }) {
  if (!value) {
    return null;
  }

  const date = ctx.dateTime.toDayjs(value);
  const now = ctx.dateTime.toDayjs(ctx.dateTime.getNow());
  const time = date.format(ctx.dateTime.timeFormat);
  const text = date.isSame(now, "day")
    ? time
    : date.isSame(now, "year")
      ? `${date.format(ctx.dateTime.getReadableShortDateFormat())} ${time}`
      : `${date.format(ctx.dateTime.dateFormat)} ${time}`;

  return (
    <time dateTime={date.toISOString()} title={ctx.dateTime.toDisplay(value)}>
      {text}
    </time>
  );
}

export function Avatar({ ctx, userId, name, size = 32 }: { ctx: FieldContext; userId: string | null | undefined; name: string; size?: number }) {
  if (!userId) {
    return <span className="inline-block shrink-0 rounded-full bg-slate-200" style={{ width: size, height: size }} aria-hidden />;
  }

  return (
    // Avatar lấy qua entry point của Espo (cookie auth-token), không qua next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${ctx.classicBasePath}/?entryPoint=avatar&size=small&id=${encodeURIComponent(userId)}`}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full bg-slate-100 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

function PartView({ ctx, part }: { ctx: FieldContext; part: MessagePart }): ReactNode {
  if (typeof part === "string") {
    return part;
  }

  switch (part.kind) {
    case "text":
      return part.text;
    case "status":
      return <Badge style={part.style}>{part.text}</Badge>;
    case "record":
      return part.id ? (
        <Link href={recordViewHref(part.scope, part.id, ctx.metadata)} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
          {part.name}
        </Link>
      ) : (
        <span className="font-medium">{part.name}</span>
      );
    case "records":
      return part.items.map((item, index) => (
        <span key={item.id}>
          {index > 0 && ", "}
          <Link href={recordViewHref(part.scope, item.id, ctx.metadata)} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
            {item.name}
          </Link>
        </span>
      ));
  }
}

export function NoteMessageText({
  ctx,
  note,
  stream,
  keyOverride,
}: {
  ctx: FieldContext;
  note: Note;
  stream: StreamContext;
  /** Key thông điệp thay thế (ví dụ "mentionYouInPost" khi hiện trong thông báo). */
  keyOverride?: string;
}) {
  const base = noteMessage(note, stream);
  const message = keyOverride ? { ...base, key: keyOverride, template: undefined } : base;
  const parts = messageParts(messageTemplate(message, note, ctx.t), message.data);

  return (
    <span className="text-sm text-slate-600">
      {parts.map((part, index) => (
        <PartView key={index} ctx={ctx} part={part} />
      ))}
      {message.status && (
        <>
          {" "}
          <PartView ctx={ctx} part={message.status} />
        </>
      )}
    </span>
  );
}

/** Nội dung post: Markdown, `@username` thành link tới người dùng. */
export function PostText({ ctx, note }: { ctx: FieldContext; note: Note }) {
  const mentions = ((note.data ?? {}) as { mentions?: Record<string, Mention> }).mentions ?? {};
  const text = applyMentions(note.post ?? "", mentions, (id) => recordViewHref("User", id, ctx.metadata));

  return <Markdown text={text} className="text-sm text-slate-800" />;
}

/** Chi tiết của note "Update": field đã đổi, giá trị trước → sau. */
function UpdateDetails({ ctx, note }: { ctx: FieldContext; note: Note }) {
  const [open, setOpen] = useState(false);
  const data = (note.data ?? {}) as { fields?: string[]; attributes?: { was?: Values; became?: Values } };
  const scope = note.parentType ?? "";
  const fields = (data.fields ?? []).filter((field) => getFieldDefs(ctx.metadata, scope, field) && ctx.acl.checkField(scope, field));

  if (!fields.length) {
    return null;
  }

  return (
    <div className="mt-1 text-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800"
      >
        <span>{fields.map((field) => ctx.t(field, "fields", scope)).join(", ")}</span>
        <i className={`fas ${open ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`} aria-hidden />
      </button>
      {open && (
        <dl className="mt-2 grid gap-2 rounded-lg bg-slate-50 p-3">
          {fields.map((field) => {
            const defs = getFieldDefs(ctx.metadata, scope, field)!;
            const was = data.attributes?.was ?? {};
            const became = data.attributes?.became ?? {};

            return (
              <div key={field} className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                <dt className="text-xs font-medium text-slate-500">{ctx.t(field, "fields", scope)}</dt>
                <dd className="flex flex-wrap items-baseline gap-2">
                  <span className="text-slate-500 line-through decoration-slate-300">
                    <FieldValue ctx={ctx} scope={scope} name={field} defs={defs} values={was} mode="detail" />
                  </span>
                  <i className="fas fa-arrow-right text-[10px] text-slate-400" aria-hidden />
                  <FieldValue ctx={ctx} scope={scope} name={field} defs={defs} values={became} mode="detail" />
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}

export function NoteItem({
  ctx,
  note,
  stream,
  canEditParent = false,
  pinnedSection = false,
  onChange,
  onRemoved,
  onPinnedChange,
  onQuote,
}: {
  ctx: FieldContext;
  note: Note;
  stream: StreamContext;
  canEditParent?: boolean;
  /** Đang hiện trong khu "Đã ghim" (không lặp lại nhãn ghim). */
  pinnedSection?: boolean;
  onChange: (note: Note) => void;
  onRemoved: (id: string) => void;
  onPinnedChange?: () => void;
  onQuote?: (text: string) => void;
}) {
  const { t } = ctx;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Values>({});
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const canEditNote = ctx.acl.isAdmin() || ctx.acl.checkRecord("Note", note, "edit", { hasField: () => true }) !== false;
  const editable = noteEditable(note, canEditNote) && ctx.acl.checkScope("Note", "edit");
  const removable = noteRemovable(note, canEditNote, ctx.acl.isAdmin()) && ctx.acl.checkScope("Note", "edit");
  const pinnable = notePinnable(note, stream, canEditParent) && (Number(ctx.settings.notePinnedMaxCount ?? 5) > 0 || !!note.isPinned);
  const reactions = note.type === "Post" ? availableReactions(ctx.settings, ctx.metadata) : [];
  const isPost = note.type === "Post" || note.type === "EmailReceived" || note.type === "EmailSent";
  const hasAttachments = Array.isArray(note.attachmentsIds) && note.attachmentsIds.length > 0;

  async function act(action: () => Promise<void>) {
    setBusy(true);

    try {
      await action();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  const react = (type: string) =>
    act(async () => {
      const reacted = !(note.myReactions ?? []).includes(type);
      const previous = note;

      onChange({ ...note, ...toggleReaction(note, type) });

      try {
        await setNoteReaction(note.id, type, reacted);
      } catch (error) {
        onChange(previous);
        throw error;
      }
    });

  const saveEdit = () =>
    act(async () => {
      const post = String(draft.post ?? "").trim();
      const attachmentsIds = (draft.attachmentsIds as string[] | undefined) ?? [];

      if (!post && !attachmentsIds.length) {
        toast.errorText(t("Post cannot be empty"));

        return;
      }

      const saved = await updateNote(note.id, { post: post || null, attachmentsIds });

      onChange({ ...note, ...saved });
      setEditing(false);
      toast.success(t("Saved"));
    });

  const menu: MenuItem[] = [];

  if (editable) {
    menu.push({
      label: t("Edit"),
      icon: "fas fa-pen",
      onSelect: () => {
        setDraft({ post: note.post ?? "", attachmentsIds: note.attachmentsIds ?? [], attachmentsNames: note.attachmentsNames ?? {}, attachmentsTypes: note.attachmentsTypes ?? {} });
        setEditing(true);
      },
    });
  }

  if (onQuote && note.type === "Post" && note.post && stream.parent && note.parentId === stream.parent.id) {
    menu.push({ label: t("Quote Reply", "labels", "Note"), icon: "fas fa-quote-left", onSelect: () => onQuote(note.post ?? "") });
  }

  if (pinnable) {
    menu.push({
      label: note.isPinned ? t("Unpin", "labels", "Note") : t("Pin", "labels", "Note"),
      icon: "fas fa-map-pin",
      onSelect: () =>
        act(async () => {
          await setNotePinned(note.id, !note.isPinned);
          onChange({ ...note, isPinned: !note.isPinned });
          onPinnedChange?.();
        }),
    });
  }

  if (removable) {
    menu.push({ label: t("Remove"), icon: "fas fa-trash", danger: true, onSelect: () => setConfirmRemove(true) });
  }

  const author = note.type === "EmailReceived" ? null : (note.createdById ?? null);

  return (
    <article className="flex gap-3 px-4 py-3">
      <Avatar ctx={ctx} userId={author} name={note.createdByName ?? ""} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 leading-6">
            <NoteMessageText ctx={ctx} note={note} stream={stream} />
            {note.isInternal && (
              <span className="ml-2 align-middle">
                <Badge style="warning">{t("isInternal", "fields", "Note").replace(/\s*\(.*\)$/, "")}</Badge>
              </span>
            )}
            {note.isPinned && !pinnedSection && (
              <i className="fas fa-map-pin ml-2 text-xs text-slate-400" title={t("Pinned", "labels", "Note")} aria-label={t("Pinned", "labels", "Note")} role="img" />
            )}
          </div>
          <span className="shrink-0 pt-0.5 text-xs text-slate-400">
            <ShortDateTime ctx={ctx} value={note.createdAt} />
          </span>
          <Menu label={t("Actions")} items={menu} />
        </div>

        {editing ? (
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit();
            }}
          >
            <TextArea
              aria-label={t("post", "fields", "Note")}
              value={String(draft.post ?? "")}
              rows={4}
              autoFocus
              onChange={(event) => setDraft({ ...draft, post: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void saveEdit();
                }

                if (event.key === "Escape") {
                  setEditing(false);
                }
              }}
            />
            <AttachmentsEdit
              ctx={ctx}
              scope="Note"
              name="attachments"
              defs={{ type: "attachmentMultiple" }}
              values={draft}
              onChange={(patch) => setDraft({ ...draft, ...patch })}
              inputId={`note-${note.id}-attachments`}
              invalid={false}
              required={false}
            />
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="h-8 px-3" disabled={busy}>
                {t("Save")}
              </Button>
              <Button className="h-8 px-3" onClick={() => setEditing(false)} disabled={busy}>
                {t("Cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {isPost && note.post && (
              <div className="mt-1">
                <PostText ctx={ctx} note={note} />
              </div>
            )}
            {hasAttachments && (
              <div className="mt-2">
                <AttachmentsDisplay ctx={ctx} scope="Note" name="attachments" defs={{ type: "attachmentMultiple" }} values={note} mode="detail" />
              </div>
            )}
            {note.type === "Update" && <UpdateDetails ctx={ctx} note={note} />}
          </>
        )}

        {reactions.length > 0 && !editing && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {reactions.map((reaction) => {
              const count = note.reactionCounts?.[reaction.type] ?? 0;
              const mine = (note.myReactions ?? []).includes(reaction.type);
              const label = t(reaction.type, "reactions");

              return (
                <button
                  key={reaction.type}
                  type="button"
                  aria-pressed={mine}
                  aria-label={`${label}${count ? ` (${count})` : ""}`}
                  title={label}
                  disabled={busy}
                  onClick={() => react(reaction.type)}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition ${
                    mine ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <i className={mine ? reaction.iconClass.replace(/^far /, "fas ") : reaction.iconClass} aria-hidden />
                  {count > 0 && <span className="tabular-nums">{count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={t("Remove")}
        message={t("removeRecordConfirmation", "messages")}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() =>
          act(async () => {
            await deleteNote(note.id);
            setConfirmRemove(false);
            onRemoved(note.id);
            toast.success(t("Removed"));
          })
        }
        onCancel={() => setConfirmRemove(false)}
      />
    </article>
  );
}
