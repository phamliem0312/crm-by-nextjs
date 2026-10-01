"use client";

// Một thông báo: note của stream (post, nhắc đến bạn, cập nhật…) hoặc thông điệp theo loại (phân công, reaction…).
// Mục được gộp (cùng bản ghi) có nút xem các thông báo bên trong.
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { FieldContext } from "@/components/fields/types";
import { Avatar, NoteMessageText, PostText, ShortDateTime } from "@/components/stream/note-item";
import { Markdown } from "@/components/ui/markdown";
import { listGroupedNotifications, notificationMessage, type Notification } from "@/lib/espo/notifications";
import { recordViewHref } from "@/lib/espo/routes";
import { messageParts, type MessagePart, type MessageValue, type StreamContext } from "@/lib/espo/stream";

function Part({ ctx, part }: { ctx: FieldContext; part: MessagePart }): ReactNode {
  if (typeof part === "string") {
    return part;
  }

  switch (part.kind) {
    case "text":
      return part.text;
    case "status":
      return part.text;
    case "record":
      return (
        <Link href={recordViewHref(part.scope, part.id, ctx.metadata)} className="font-medium text-slate-900 hover:text-blue-700 hover:underline">
          {part.name}
        </Link>
      );
    case "records":
      return part.items.map((item, index) => (
        <span key={item.id}>
          {index > 0 && ", "}
          <Link href={recordViewHref(part.scope, item.id, ctx.metadata)} className="font-medium text-slate-900 hover:underline">
            {item.name}
          </Link>
        </span>
      ));
  }
}

/** Thay `{user}`, `{entity}`… trong văn bản Markdown của thông báo hệ thống bằng link Markdown. */
function fillMarkdown(ctx: FieldContext, text: string, data: Record<string, MessageValue>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = data[key];

    if (!value) {
      return match;
    }

    if (value.kind === "record") {
      return `[${value.name.replace(/[[\]\\]/g, "\\$&")}](${recordViewHref(value.scope, value.id, ctx.metadata)})`;
    }

    return value.kind === "text" || value.kind === "status" ? value.text : match;
  });
}

export function NotificationItem({ ctx, notification, nested = false }: { ctx: FieldContext; notification: Notification; nested?: boolean }) {
  const { t } = ctx;
  const [expanded, setExpanded] = useState(false);
  const stream: StreamContext = {
    t,
    metadata: ctx.metadata,
    userId: ctx.user.id,
    parent: null,
    language: String(ctx.preferences.language ?? ctx.settings.language ?? ""),
  };
  const message = notificationMessage(notification, stream);
  const grouped = !nested && ((notification.groupedCount ?? 0) > 1 || (notification.groupedCount ?? 0) < 0 || !!notification.groupType);
  const children = useQuery({
    queryKey: ["notificationGroup", notification.id],
    queryFn: ({ signal }) => listGroupedNotifications(notification, signal),
    enabled: expanded,
  });

  let body: ReactNode = null;
  let author: string | null | undefined = notification.createdById;

  if (message.kind === "note") {
    author = message.note.createdById;
    body = (
      <>
        <NoteMessageText ctx={ctx} note={message.note} stream={stream} keyOverride={message.key} />
        {message.note.type === "Post" && message.note.post && (
          <div className="mt-1 line-clamp-4">
            <PostText ctx={ctx} note={message.note} />
          </div>
        )}
      </>
    );
  } else if (message.kind === "message") {
    const template = t(message.key, message.category, message.scope ?? "Global");

    body = (
      <span className="text-sm text-slate-600">
        {messageParts(template, message.data).map((part, index) => (
          <Part key={index} ctx={ctx} part={part} />
        ))}
      </span>
    );
  } else if (message.kind === "text") {
    author = null;
    body = <Markdown text={fillMarkdown(ctx, message.text, message.data)} className="text-sm text-slate-700" />;
  } else {
    body = <span className="text-sm text-slate-500">{t(notification.type ?? "", "type", "Notification")}</span>;
  }

  return (
    <div className={`flex gap-3 ${notification.read ? "" : "bg-blue-50/50"} ${nested ? "py-2" : "px-4 py-3"}`}>
      <Avatar ctx={ctx} userId={author} name="" size={nested ? 24 : 32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 leading-6">{body}</div>
          <span className="shrink-0 pt-0.5 text-xs text-slate-400">
            {!notification.read && <span className="mr-1.5 inline-block size-2 rounded-full bg-blue-600 align-middle" aria-label={t("New")} role="img" />}
            <ShortDateTime ctx={ctx} value={notification.createdAt} />
          </span>
        </div>
        {grouped && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-medium text-blue-600 hover:underline"
          >
            {expanded ? t("Hide") : t("Show more")}
          </button>
        )}
        {expanded && (
          <div className="mt-2 divide-y divide-slate-100 border-l-2 border-slate-200 pl-3">
            {children.isLoading && <p className="py-2 text-xs text-slate-500">{t("Loading...")}</p>}
            {(children.data?.list ?? []).map((item) => (
              <NotificationItem key={item.id} ctx={ctx} notification={item as Notification} nested />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
