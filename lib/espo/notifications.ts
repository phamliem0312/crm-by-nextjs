// Thông báo: đếm chưa đọc (polling), danh sách, đánh dấu đã đọc, thông điệp theo loại.
// Port từ `views/notification/badge|panel|list`, `views/notification/fields/container`, `views/notification/items/*`.
import { espoGet } from "./client";
import type { ListResult } from "./records";
import { sendRequest } from "./records";
import { searchParamsQuery } from "./search";
import type { MessageValue, Note, StreamContext } from "./stream";

export type Notification = {
  id: string;
  type?: string | null;
  read?: boolean;
  createdAt?: string;
  createdById?: string | null;
  createdByName?: string | null;
  data?: Record<string, unknown> | null;
  noteData?: Note | null;
  message?: string | null;
  relatedId?: string | null;
  relatedType?: string | null;
  relatedParentId?: string | null;
  relatedParentType?: string | null;
  relatedParentName?: string | null;
  groupType?: string | null;
  groupedCount?: number | null;
  groupedUnreadCount?: number | null;
  [key: string]: unknown;
};

export function getNotReadCount(): Promise<number> {
  return espoGet<number>("Notification/action/notReadCount");
}

/** Lấy danh sách cũng làm server đánh dấu các thông báo đó là đã đọc. */
export function listNotifications(params: { maxSize: number; offset?: number }, signal?: AbortSignal): Promise<ListResult> {
  return espoGet<ListResult>(`Notification?${searchParamsQuery({ maxSize: params.maxSize, offset: params.offset ?? 0 })}`, { signal });
}

/** Các thông báo được gộp vào một mục (cùng bản ghi). */
export function listGroupedNotifications(notification: Notification, signal?: AbortSignal): Promise<ListResult> {
  const url = notification.groupType
    ? `Notification/group?type=${encodeURIComponent(notification.groupType)}&id=${encodeURIComponent(notification.id)}`
    : `Notification/${encodeURIComponent(notification.id)}/group`;

  return espoGet<ListResult>(url, { signal });
}

export function markAllNotificationsRead(): Promise<unknown> {
  return sendRequest("POST", "Notification/action/markAllRead");
}

export type PopupReminder = {
  id: string;
  data: { id: string; entityType: string; name?: string; dateField?: string; attributes?: Record<string, unknown> };
};

/** Nhắc nhở popup của Meeting/Call/Task tới hạn (`app.popupNotifications.event`). */
export function getPopupReminders(): Promise<Record<string, PopupReminder[]>> {
  return espoGet<Record<string, PopupReminder[]>>("PopupNotification/action/grouped");
}

export function dismissPopupReminder(id: string): Promise<unknown> {
  return sendRequest("POST", "Activities/action/removePopupNotification", { id });
}

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type NotificationMessage =
  /** Hiện như một note của stream (Note, MentionInPost). */
  | { kind: "note"; note: Note; key?: string }
  | { kind: "message"; key: string; category: "notificationMessages" | "streamMessages"; scope: string | null; data: Record<string, MessageValue> }
  /** Thông báo hệ thống/tin nhắn: văn bản Markdown. */
  | { kind: "text"; text: string; data: Record<string, MessageValue> }
  | { kind: "unknown" };

function entityTypeText(scope: string | null | undefined, ctx: StreamContext): MessageValue {
  const text = scope ? ctx.t(scope, "scopeNames").toLowerCase() : "";

  return { kind: "text", text: ["de_DE", "nl_NL"].includes(ctx.language ?? "") ? text.charAt(0).toUpperCase() + text.slice(1) : text };
}

function record(scope: unknown, id: unknown, name: unknown): MessageValue | null {
  return scope && id ? { kind: "record", scope: str(scope), id: str(id), name: str(name) || str(id) } : null;
}

function compact(data: Record<string, MessageValue | null>): Record<string, MessageValue> {
  return Object.fromEntries(Object.entries(data).filter((entry): entry is [string, MessageValue] => !!entry[1]));
}

/** Key thông điệp "nhắc đến bạn" theo đối tượng của post (port `mention-in-post` khi là thông báo). */
export function mentionMessageKey(note: Note): string {
  if (note.parentId) {
    return "mentionYouInPost";
  }

  if (note.isGlobal) {
    return "mentionYouInPostTargetAll";
  }

  const users = Array.isArray(note.usersIds) ? (note.usersIds as string[]) : [];

  if ((users.length === 1 && users[0] === note.createdById) || note.targetType === "self") {
    return "mentionYouInPostTargetNoTarget";
  }

  return "mentionYouInPostTarget";
}

export function notificationMessage(notification: Notification, ctx: StreamContext): NotificationMessage {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const type = str(notification.type);

  if (notification.groupType === "Record") {
    const count = notification.groupedUnreadCount ?? 0;

    return {
      kind: "message",
      key: notification.read ? "groupUpdates" : count > 1 ? "groupUpdatesMultiple" : "groupUpdatesOne",
      category: "notificationMessages",
      scope: notification.relatedParentType ?? null,
      data: compact({
        entityType: entityTypeText(notification.relatedParentType, ctx),
        entity: record(notification.relatedParentType, notification.relatedParentId, notification.relatedParentName),
        number: { kind: "text", text: String(count) },
      }),
    };
  }

  if (notification.groupType === "EmailReceived") {
    const count = notification.groupedUnreadCount ?? 0;

    return {
      kind: "message",
      key: count ? "groupEmailsReceivedNew" : "groupEmailsReceived",
      category: "notificationMessages",
      scope: null,
      data: { number: { kind: "text", text: String(count) } },
    };
  }

  switch (type) {
    case "Note":
      return notification.noteData ? { kind: "note", note: notification.noteData } : { kind: "unknown" };

    case "MentionInPost":
      return notification.noteData ? { kind: "note", note: notification.noteData, key: mentionMessageKey(notification.noteData) } : { kind: "unknown" };

    case "Assign":
      return {
        kind: "message",
        key: "assign",
        category: "notificationMessages",
        scope: str(data.entityType) || null,
        data: compact({
          entityType: entityTypeText(str(data.entityType), ctx),
          entity: record(data.entityType ?? notification.relatedType, data.entityId ?? notification.relatedId, data.entityName),
          user: record("User", data.userId, data.userName),
        }),
      };

    case "EntityRemoved":
      return {
        kind: "message",
        key: "entityRemoved",
        category: "notificationMessages",
        scope: str(data.entityType) || null,
        data: compact({
          entityType: entityTypeText(str(data.entityType), ctx),
          entity: data.entityName ? { kind: "text", text: str(data.entityName) } : null,
          user: record("User", data.userId, data.userName),
        }),
      };

    case "EmailReceived":
    case "EmailInbox":
      return {
        kind: "message",
        key: type === "EmailInbox" ? "emailInbox" : "emailReceived",
        category: "notificationMessages",
        scope: null,
        data: compact({
          from: data.personEntityId
            ? record(data.personEntityType, data.personEntityId, data.personEntityName)
            : { kind: "text", text: str(data.fromString) || ctx.t("empty address") },
          entity: record("Email", data.emailId ?? notification.relatedId, data.emailName),
          entityType: entityTypeText("Email", ctx),
          user: record("User", data.userId, data.userName),
        }),
      };

    case "UserReaction": {
      const inParent = !!notification.relatedParentId && !!notification.relatedParentType;

      return {
        kind: "message",
        key: inParent ? "userPostInParentReaction" : "userPostReaction",
        category: "notificationMessages",
        scope: notification.relatedParentType ?? null,
        data: compact({
          user: record("User", notification.createdById ?? data.userId, data.userName ?? notification.createdByName),
          post: { kind: "text", text: ctx.t("Post").toLowerCase() },
          type: { kind: "text", text: ctx.t(str(data.type), "reactions") },
          entityType: inParent ? entityTypeText(notification.relatedParentType, ctx) : null,
          entity: inParent ? record(notification.relatedParentType, notification.relatedParentId, notification.relatedParentName) : null,
        }),
      };
    }

    case "Collaborating":
      return {
        kind: "message",
        key: "addedToCollaborators",
        category: "notificationMessages",
        scope: notification.relatedType ?? null,
        data: compact({
          user: record("User", notification.createdById, notification.createdByName),
          entityType: entityTypeText(notification.relatedType, ctx),
          entity: record(notification.relatedType, notification.relatedId, data.entityName),
        }),
      };

    case "Message":
    case "System":
      return {
        kind: "text",
        text: str(notification.message) || str(data.message),
        data: compact({
          user: record("User", data.userId, data.userName),
          entity: record(data.entityType, data.entityId, data.entityName),
          entityType: entityTypeText(str(data.entityType), ctx),
        }),
      };

    default:
      return { kind: "unknown" };
  }
}
