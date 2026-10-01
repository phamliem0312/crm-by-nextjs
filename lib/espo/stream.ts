// Stream (Note): dựng câu thông điệp cho từng loại note và gọi API stream.
// Port từ `views/stream/note` + `views/stream/notes/*` (create, update, status, assign, post, relate…)
// và `views/stream/panel`, `views/stream/record/list` của classic.
import { espoGet } from "./client";
import type { Translator } from "./i18n";
import type { EspoRecord, ListResult } from "./records";
import { sendRequest } from "./records";
import { searchParamsQuery } from "./search";
import type { Metadata } from "./types";

export type Note = EspoRecord & {
  type?: string;
  post?: string | null;
  data?: Record<string, unknown> | null;
  parentType?: string | null;
  parentId?: string | null;
  parentName?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedName?: string | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByGender?: string | null;
  createdAt?: string;
  isPinned?: boolean;
  isInternal?: boolean;
  isGlobal?: boolean;
  reactionCounts?: Record<string, number> | null;
  myReactions?: string[] | null;
  attachmentsIds?: string[];
  attachmentsNames?: Record<string, string>;
  attachmentsTypes?: Record<string, string>;
};

/** Phần tử thay vào `{placeholder}` của câu thông điệp. */
export type MessageValue =
  | { kind: "text"; text: string }
  | { kind: "record"; scope: string; id: string; name: string }
  | { kind: "records"; scope: string; items: { id: string; name: string }[] }
  | { kind: "status"; text: string; style: string };

export type MessagePart = string | MessageValue;

export type StreamContext = {
  t: Translator;
  metadata: Metadata;
  userId: string;
  /** Bản ghi đang xem (panel stream của bản ghi). Không có = stream của người dùng. */
  parent?: { scope: string; id: string } | null;
  /** Ngôn ngữ người dùng: de_DE/nl_NL giữ chữ hoa cho tên entity như classic. */
  language?: string;
};

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

/** Note thuộc chính bản ghi đang xem (thông điệp dạng "…This": "đã tạo", không nhắc lại tên bản ghi). */
export function isThisNote(note: Note, ctx: StreamContext): boolean {
  return !!ctx.parent && note.parentType === ctx.parent.scope && note.parentId === ctx.parent.id;
}

function translateEntityType(scope: string | null | undefined, ctx: StreamContext): string {
  const text = scope ? ctx.t(scope, "scopeNames") : "";

  return ["de_DE", "nl_NL"].includes(ctx.language ?? "") ? text : text.toLowerCase();
}

function statusInfo(note: Note, ctx: StreamContext, value: unknown): MessageValue | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parentType = str(note.parentType);
  const scopeDefs = (ctx.metadata.scopes?.[parentType] ?? {}) as Record<string, unknown>;
  const field = str(scopeDefs.statusField);
  const fieldDefs = (ctx.metadata.entityDefs as Record<string, { fields?: Record<string, { style?: Record<string, string> }> }> | undefined)?.[
    parentType
  ]?.fields?.[field];

  return {
    kind: "status",
    text: ctx.t.option(str(value), field, parentType),
    style: fieldDefs?.style?.[str(value)] ?? "default",
  };
}

function usersValue(list: unknown): MessageValue | null {
  if (!Array.isArray(list) || !list.length) {
    return null;
  }

  return {
    kind: "records",
    scope: "User",
    items: list.map((item: { id?: unknown; name?: unknown }) => ({ id: str(item.id), name: str(item.name) || str(item.id) })),
  };
}

export type NoteMessage = {
  /** Key trong `streamMessages` (ví dụ `createAssignedThis`). */
  key: string;
  data: Record<string, MessageValue>;
  /** Template ép sẵn (post của chính bản ghi chỉ hiện "{user}"). */
  template?: string;
  /** Badge trạng thái hiện cạnh thông điệp (Create/Update/Status). */
  status?: MessageValue | null;
};

/** Key + dữ liệu của thông điệp cho một note (không dịch). */
export function noteMessage(note: Note, ctx: StreamContext): NoteMessage {
  const type = str(note.type);
  const data = (note.data ?? {}) as Record<string, unknown>;
  let isThis = isThisNote(note, ctx);
  const isUserStream = !ctx.parent;
  const values: Record<string, MessageValue> = {
    user: { kind: "record", scope: "User", id: str(note.createdById), name: str(note.createdByName) || str(note.createdById) },
    entityType: { kind: "text", text: translateEntityType(note.parentType, ctx) },
  };

  if (note.parentType && note.parentId) {
    values.entity = { kind: "record", scope: note.parentType, id: note.parentId, name: str(note.parentName) || note.parentId };
  }

  const suffix = (key: string) => (isThis ? `${key}This` : key);

  switch (type) {
    case "Post": {
      if (!note.post && note.parentId) {
        return { key: suffix("attach"), data: values };
      }

      if (note.parentId) {
        return isThis ? { key: "postThis", data: values, template: "{user}" } : { key: "post", data: values };
      }

      return postTargetMessage(note, ctx, values);
    }

    case "Create": {
      const status = statusInfo(note, ctx, data.statusValue);
      let assigneeId = str(data.assignedUserId);
      let assigneeName = str(data.assignedUserName) || assigneeId;
      const assignedUsers = Array.isArray(data.assignedUsers) ? (data.assignedUsers as { id: string; name?: string }[]) : null;

      if (assignedUsers && assignedUsers.length > 1) {
        values.assignee = usersValue(assignedUsers)!;

        return { key: suffix("createAssigned"), data: values, status };
      }

      if (assignedUsers?.length === 1) {
        assigneeId = assignedUsers[0].id;
        assigneeName = str(assignedUsers[0].name) || assigneeId;
      }

      if (!assigneeId) {
        return { key: suffix("create"), data: values, status };
      }

      values.assignee = { kind: "record", scope: "User", id: assigneeId, name: assigneeName };

      let key = "createAssigned";

      if (isThis) {
        key += "This";

        if (assigneeId === note.createdById) {
          key += "Self";
        }
      } else if (assigneeId === note.createdById) {
        key += "Self";
      } else if (isUserStream && assigneeId === ctx.userId) {
        key += "You";
      }

      return { key, data: values, status };
    }

    case "Update":
      return { key: suffix("update"), data: values, status: statusInfo(note, ctx, data.value) };

    case "Status": {
      const parentType = str(note.parentType);
      const field = str((ctx.metadata.scopes?.[parentType] as Record<string, unknown> | undefined)?.statusField);
      const label = ctx.t(field, "fields", parentType);

      values.field = { kind: "text", text: ["de_DE", "nl_NL"].includes(ctx.language ?? "") ? label : label.toLowerCase() };

      return { key: suffix("status"), data: values, status: statusInfo(note, ctx, data.value) };
    }

    case "Assign": {
      if (Array.isArray(data.addedAssignedUsers)) {
        const added = data.addedAssignedUsers as unknown[];
        const removed = Array.isArray(data.removedAssignedUsers) ? (data.removedAssignedUsers as unknown[]) : [];
        let key = added.length && removed.length ? "assignMultiAddRemove" : removed.length ? "assignMultiRemove" : "assignMultiAdd";

        if (added.length) {
          values.assignee = usersValue(added)!;
        }

        if (removed.length) {
          values.removedAssignee = usersValue(removed)!;
        }

        if (isThis) {
          key += "This";
        }

        return { key, data: values };
      }

      const assigneeId = str(data.assignedUserId);

      values.assignee = { kind: "record", scope: "User", id: assigneeId, name: str(data.assignedUserName) || assigneeId };

      let key = suffix("assign");

      if (!assigneeId) {
        key += "Void";
      } else if (assigneeId === note.createdById) {
        key += "Self";
      } else if (isUserStream && assigneeId === ctx.userId) {
        key += "You";
      }

      return { key, data: values };
    }

    case "CreateRelated":
    case "Relate":
    case "Unrelate": {
      const relatedType = str(note.relatedType) || str(data.entityType);
      const relatedId = str(note.relatedId) || str(data.entityId);
      const relatedName = str(note.relatedName) || str(data.entityName) || relatedId;

      values.relatedEntityType = { kind: "text", text: translateEntityType(relatedType, ctx) };

      if (relatedType && relatedId) {
        values.relatedEntity = { kind: "record", scope: relatedType, id: relatedId, name: relatedName };
      }

      const base = type === "CreateRelated" ? "createRelated" : type === "Relate" ? "relate" : "unrelate";

      return { key: suffix(base), data: values };
    }

    case "EmailReceived":
    case "EmailSent": {
      if (data.emailId) {
        values.email = { kind: "record", scope: "Email", id: str(data.emailId), name: str(data.emailName) || str(data.emailId) };
      }

      if (data.personEntityId && data.personEntityType) {
        const person: MessageValue = {
          kind: "record",
          scope: str(data.personEntityType),
          id: str(data.personEntityId),
          name: str(data.personEntityName) || str(data.personEntityId),
        };

        if (type === "EmailReceived") {
          values.from = person;
        } else {
          values.by = person;
        }

        if (note.parentType === data.personEntityType && note.parentId === data.personEntityId) {
          isThis = true;
        }
      } else if (type === "EmailSent") {
        values.by = values.user;
      }

      if (type === "EmailSent") {
        return { key: isThis ? "emailSentThis" : "emailSent", data: values };
      }

      let key = "emailReceived";

      if (data.isInitial) {
        key += "Initial";
      }

      if (data.personEntityId) {
        key += "From";
      }

      return { key: isThis ? `${key}This` : key, data: values };
    }

    default:
      return { key: suffix(type ? type.charAt(0).toLowerCase() + type.slice(1) : "update"), data: values };
  }
}

/** Post không gắn bản ghi (stream người dùng): đăng tới tất cả / nhóm / người dùng / chính mình. */
function postTargetMessage(note: Note, ctx: StreamContext, values: Record<string, MessageValue>): NoteMessage {
  const ids = (key: string) => (Array.isArray(note[`${key}Ids`]) ? (note[`${key}Ids`] as string[]) : []);
  const names = (key: string) => (note[`${key}Names`] ?? {}) as Record<string, string>;

  if (note.isGlobal) {
    return { key: "postTargetAll", data: values };
  }

  for (const [key, scope, single, multiple] of [
    ["teams", "Team", "postTargetTeam", "postTargetTeams"],
    ["portals", "Portal", "postTargetPortal", "postTargetPortals"],
  ] as const) {
    if (ids(key).length) {
      values.target = { kind: "records", scope, items: ids(key).map((id) => ({ id, name: names(key)[id] ?? id })) };

      return { key: ids(key).length > 1 ? multiple : single, data: values };
    }
  }

  const userIds = ids("users");

  if (!userIds.length) {
    return { key: "post", data: values };
  }

  if (userIds.length === 1 && userIds[0] === note.createdById) {
    return { key: "postTargetSelf", data: values };
  }

  let key = "postTarget";
  const others: { id: string; name: string }[] = [];

  for (const id of userIds) {
    if (id === ctx.userId) {
      key = userIds.length > 1 ? (id === note.createdById ? "postTargetSelfAndOthers" : "postTargetYouAndOthers") : "postTargetYou";
      continue;
    }

    if (id === note.createdById) {
      key = "postTargetSelfAndOthers";
      continue;
    }

    if (names("users")[id]) {
      others.push({ id, name: names("users")[id] });
    }
  }

  values.target = { kind: "records", scope: "User", items: others };

  return { key, data: values };
}

/** Dịch template theo giới tính người tạo (streamMessagesMale/Female) rồi về `streamMessages`. */
export function messageTemplate(message: NoteMessage, note: Note, t: Translator): string {
  if (message.template) {
    return message.template;
  }

  const scope = str(note.parentType) || "Global";
  const gender = note.createdByGender === "Male" ? "streamMessagesMale" : note.createdByGender === "Female" ? "streamMessagesFemale" : null;

  if (gender) {
    const translated = t(message.key, gender, scope);

    if (translated !== message.key) {
      return translated;
    }
  }

  return t(message.key, "streamMessages", scope);
}

/**
 * Tách template thành chuỗi + giá trị: `"{user} tạo {entityType} {entity}"` → `[{user}, " tạo ", …]`.
 * Placeholder không có dữ liệu bị bỏ; template bắt đầu bằng `{entityType}` thì viết hoa chữ cái đầu.
 */
export function messageParts(template: string, data: Record<string, MessageValue>): MessagePart[] {
  const parts: MessagePart[] = [];
  const pattern = /\{(\w+)\}/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(template))) {
    if (match.index > last) {
      parts.push(template.slice(last, match.index));
    }

    let value = data[match[1]];

    if (value?.kind === "text" && match.index === 0 && match[1] === "entityType") {
      value = { kind: "text", text: value.text.charAt(0).toUpperCase() + value.text.slice(1) };
    }

    if (value) {
      parts.push(value);
    }

    last = match.index + match[0].length;
  }

  if (last < template.length) {
    parts.push(template.slice(last));
  }

  return parts;
}

// ——— Quyền thao tác trên note ———

/**
 * Sửa/xoá: classic cho phép với post (người có quyền `edit` Note — thường là người viết, trong thời hạn
 * `noteEditThresholdPeriod`; server kiểm tra lại); note hệ thống (update, assign…) chỉ admin xoá được.
 */
export function noteEditable(note: Note, canEditNote: boolean): boolean {
  return note.type === "Post" && canEditNote;
}

export function noteRemovable(note: Note, canEditNote: boolean, isAdmin: boolean): boolean {
  if (note.type === "Post") {
    return canEditNote;
  }

  return isAdmin && !["Create", "EmailReceived", "EmailSent"].includes(str(note.type));
}

/** Ghim chỉ cho post/email của chính bản ghi và khi người dùng sửa được bản ghi đó. */
export function notePinnable(note: Note, ctx: StreamContext, canEditParent: boolean): boolean {
  return isThisNote(note, ctx) && ["Post", "EmailReceived", "EmailSent"].includes(str(note.type)) && canEditParent;
}

// ——— API ———

export type StreamFilter = "all" | "posts" | "updates";

export type StreamResult = ListResult & { pinnedList?: Note[] };

export function listStream(
  scope: string,
  id: string,
  params: { maxSize: number; offset?: number; filter?: StreamFilter | null },
  signal?: AbortSignal,
): Promise<StreamResult> {
  const query = searchParamsQuery({ maxSize: params.maxSize, offset: params.offset ?? 0 });
  const filter = params.filter && params.filter !== "all" ? `&filter=${params.filter}` : "";

  return espoGet<StreamResult>(`${encodeURIComponent(scope)}/${encodeURIComponent(id)}/stream?${query}${filter}`, { signal });
}

/** Stream của người dùng hiện tại (trang Stream, dashlet Stream). */
export function listUserStream(
  params: { maxSize: number; offset?: number; filter?: StreamFilter | null; skipOwn?: boolean },
  signal?: AbortSignal,
): Promise<StreamResult> {
  const query = searchParamsQuery({ maxSize: params.maxSize, offset: params.offset ?? 0 });
  const filter = params.filter && params.filter !== "all" ? `&filter=${params.filter}` : "";

  return espoGet<StreamResult>(`Stream?${query}${filter}${params.skipOwn ? "&skipOwn=true" : ""}`, { signal });
}

export type PostData = {
  post: string | null;
  attachmentsIds: string[];
  parentType?: string;
  parentId?: string;
  isInternal?: boolean;
  /** Post không gắn bản ghi: self/users/teams/all. */
  targetType?: "self" | "users" | "teams" | "all" | "portals";
  usersIds?: string[];
  teamsIds?: string[];
};

export function createPost(data: PostData): Promise<Note> {
  return sendRequest<Note>("POST", "Note", { type: "Post", ...data });
}

export function updateNote(id: string, data: { post: string | null; attachmentsIds?: string[] }): Promise<Note> {
  return sendRequest<Note>("PUT", `Note/${encodeURIComponent(id)}`, data);
}

export function deleteNote(id: string): Promise<unknown> {
  return sendRequest("DELETE", `Note/${encodeURIComponent(id)}`);
}

export function setNotePinned(id: string, pinned: boolean): Promise<unknown> {
  return sendRequest(pinned ? "POST" : "DELETE", `Note/${encodeURIComponent(id)}/pin`);
}

export function setNoteReaction(id: string, type: string, reacted: boolean): Promise<unknown> {
  return sendRequest(reacted ? "POST" : "DELETE", `Note/${encodeURIComponent(id)}/myReactions/${encodeURIComponent(type)}`);
}

/**
 * Cập nhật lạc quan khi bấm reaction (classic chỉ cho một reaction mỗi người).
 * Trả về `myReactions`/`reactionCounts` mới.
 */
export function toggleReaction(note: Note, type: string): { myReactions: string[]; reactionCounts: Record<string, number> } {
  const mine = note.myReactions ?? [];
  const counts = { ...(note.reactionCounts ?? {}) };

  if (mine.includes(type)) {
    counts[type] = Math.max(0, (counts[type] ?? 1) - 1);

    if (!counts[type]) {
      delete counts[type];
    }

    return { myReactions: [], reactionCounts: counts };
  }

  for (const previous of mine) {
    counts[previous] = Math.max(0, (counts[previous] ?? 1) - 1);

    if (!counts[previous]) {
      delete counts[previous];
    }
  }

  counts[type] = (counts[type] ?? 0) + 1;

  return { myReactions: [type], reactionCounts: counts };
}

/** Reaction được bật trong Settings (`availableReactions`) kèm icon từ `app.reactions`. */
export function availableReactions(settings: Record<string, unknown>, metadata: Metadata): { type: string; iconClass: string }[] {
  const enabled = Array.isArray(settings.availableReactions) ? settings.availableReactions.map(String) : [];
  const defs = ((metadata.app as Record<string, unknown> | undefined)?.reactions as { list?: { type: string; iconClass?: string }[] } | undefined)
    ?.list;

  return enabled.map((type) => ({ type, iconClass: defs?.find((item) => item.type === type)?.iconClass ?? "far fa-thumbs-up" }));
}
