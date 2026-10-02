// Email: thư mục, hành động hộp thư, trả lời/chuyển tiếp, chữ ký. Port từ `views/email/list`,
// `views/email/record/list`, `views/email/record/detail`, `views/email-folder/*` và `email-helper` của classic.
import { checkParentTypeAvailability } from "./activities";
import { espoGet } from "./client";
import { getEntityDefs, getFieldDefs } from "./entity";
import type { DateTimeFormat } from "./format";
import type { Translator } from "./i18n";
import { postAction, sendRequest, type EspoRecord } from "./records";
import type { WhereItem } from "./search";
import type { Metadata, Settings } from "./types";

export const FOLDER = {
  all: "all",
  inbox: "inbox",
  important: "important",
  sent: "sent",
  drafts: "drafts",
  trash: "trash",
  archive: "archive",
} as const;

const BUILT_IN_FOLDERS: string[] = [FOLDER.inbox, FOLDER.important, FOLDER.sent, FOLDER.drafts, FOLDER.trash, FOLDER.archive];
const AUX_FOLDERS: string[] = [...BUILT_IN_FOLDERS, FOLDER.all];

/** Không kéo email vào Sent/Drafts. */
const NO_DROP_FOLDERS: string[] = [FOLDER.sent, FOLDER.drafts];

const FOLDER_ICONS: Record<string, string> = {
  [FOLDER.all]: "far fa-hdd",
  [FOLDER.trash]: "far fa-trash-alt",
  [FOLDER.sent]: "far fa-paper-plane",
  [FOLDER.inbox]: "fas fa-inbox",
  [FOLDER.archive]: "far fa-caret-square-down",
  [FOLDER.drafts]: "far fa-file",
  [FOLDER.important]: "far fa-star",
};

export type FolderItem = { id: string; name: string };

export type FolderEntry = {
  id: string;
  name: string;
  icon: string;
  /** Có vạch phân cách phía trên (đầu nhóm). */
  groupStart: boolean;
  droppable: boolean;
  /** Chú thích (Folder / Group Folder) cho thư mục tự tạo. */
  title: string | null;
};

export const isGroupFolder = (id: string | null | undefined) => !!id && id.startsWith("group:");

/** Danh sách thư mục bên trái của trang Email (`views/email/list.loadFolders`). */
export function folderEntries(list: FolderItem[], t: Translator): FolderEntry[] {
  const firstGroupIndex = list.findIndex((item) => isGroupFolder(item.id));
  const hasArchive = list.some((item) => item.id === FOLDER.archive);

  return list.map((item, index) => {
    const group = isGroupFolder(item.id);
    const custom = !group && !AUX_FOLDERS.includes(item.id);

    return {
      id: item.id,
      // Thư mục hệ thống dịch theo `presetFilters`; thư mục tự tạo giữ tên.
      name: BUILT_IN_FOLDERS.includes(item.id) ? t(item.id, "presetFilters", "Email") : item.name,
      icon: group ? "far fa-circle" : custom ? "far fa-folder" : (FOLDER_ICONS[item.id] ?? "far fa-folder"),
      groupStart:
        item.id === FOLDER.inbox ||
        item.id === FOLDER.archive ||
        (item.id === FOLDER.trash && !hasArchive) ||
        (group && index === firstGroupIndex),
      droppable: !NO_DROP_FOLDERS.includes(item.id),
      title: group ? t("groupFolder", "fields", "Email") : custom ? t("folder", "fields", "Email") : null,
    };
  });
}

/** Điều kiện lọc list theo thư mục (`inFolder`). Thư mục bị tắt → không lọc. */
export function folderWhere(folderId: string | null): WhereItem[] {
  return folderId ? [{ type: "inFolder", attribute: "folderId", value: folderId }] : [];
}

/** Có thả email từ thư mục đang xem sang thư mục đích được không (`views/email/list.isDroppable`). */
export function canDropToFolder(selectedFolderId: string, folderId: string): boolean {
  if (folderId === selectedFolderId || NO_DROP_FOLDERS.includes(folderId)) {
    return false;
  }

  if (selectedFolderId === FOLDER.drafts) {
    return false;
  }

  if (selectedFolderId === FOLDER.sent && folderId === FOLDER.inbox) {
    return false;
  }

  if (selectedFolderId === FOLDER.all) {
    return isGroupFolder(folderId);
  }

  if (folderId === FOLDER.all) {
    return isGroupFolder(selectedFolderId);
  }

  if (isGroupFolder(selectedFolderId)) {
    return ([FOLDER.all, FOLDER.archive, FOLDER.trash] as string[]).includes(folderId) || isGroupFolder(folderId);
  }

  return true;
}

export type DropAction =
  | { kind: "important" }
  | { kind: "trash" }
  | { kind: "retrieveAndMove"; folderId: string }
  | { kind: "move"; folderId: string }
  | { kind: "none" };

/** Thả email vào thư mục thì làm gì (`views/email/list.onDrop`). */
export function dropAction(selectedFolderId: string, folderId: string): DropAction {
  if (folderId === FOLDER.important) {
    return { kind: "important" };
  }

  if (selectedFolderId === FOLDER.trash) {
    return folderId === FOLDER.trash ? { kind: "none" } : { kind: "retrieveAndMove", folderId };
  }

  if (folderId === FOLDER.trash) {
    return { kind: "trash" };
  }

  // Từ thư mục nhóm thả vào "All" = trả về Inbox cá nhân.
  if (isGroupFolder(selectedFolderId) && folderId === FOLDER.all) {
    return { kind: "move", folderId: FOLDER.inbox };
  }

  return { kind: "move", folderId };
}

export type EmailMassAction =
  | "retrieveFromTrash"
  | "moveToTrash"
  | "moveToArchive"
  | "moveToFolder"
  | "markAsImportant"
  | "markAsNotImportant"
  | "markAsRead"
  | "markAsNotRead";

/** Hành động hàng loạt hiện theo thư mục (`controlEmailMassActionsVisibility`). */
export function emailMassActions(folderId: string | null): EmailMassAction[] {
  const result: EmailMassAction[] = [];

  if (folderId === FOLDER.trash) {
    result.push("retrieveFromTrash");
  }

  if (folderId !== FOLDER.trash && folderId !== FOLDER.all) {
    result.push("moveToTrash");
  }

  if (folderId !== FOLDER.trash && folderId !== FOLDER.archive && folderId !== FOLDER.all) {
    result.push("moveToArchive");
  }

  result.push("moveToFolder");

  if (folderId !== FOLDER.important && folderId !== FOLDER.all) {
    result.push("markAsImportant");
  }

  result.push("markAsNotImportant", "markAsRead");

  if (folderId !== FOLDER.all) {
    result.push("markAsNotRead");
  }

  return result;
}

export type FolderOption = { id: string; name: string; icon: string; disabled: boolean };

/** Lựa chọn của hộp "Move to Folder" (`views/email-folder/modals/select-folder`). */
export function moveFolderOptions(
  list: FolderItem[],
  options: { isGroup: boolean; noArchive: boolean; currentFolderId: string | null },
  t: Translator,
): FolderOption[] {
  const result: FolderOption[] = list
    .filter((item) => (!options.isGroup || isGroupFolder(item.id)) && !BUILT_IN_FOLDERS.includes(item.id))
    .map((item) => ({
      id: item.id,
      name: item.name,
      icon: isGroupFolder(item.id) ? "far fa-circle" : "far fa-folder",
      disabled: item.id === options.currentFolderId,
    }));

  result.unshift({
    id: FOLDER.inbox,
    name: t(options.isGroup ? "all" : "inbox", "presetFilters", "Email"),
    icon: FOLDER_ICONS[options.isGroup ? FOLDER.all : FOLDER.inbox],
    disabled: false,
  });

  if (!options.noArchive) {
    result.push({
      id: FOLDER.archive,
      name: t("archive", "presetFilters", "Email"),
      icon: FOLDER_ICONS[FOLDER.archive],
      disabled: options.currentFolderId === FOLDER.archive,
    });
  }

  return result;
}

type EmailValues = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value : "");

export function isInTrash(email: EmailValues): boolean {
  return email.groupFolderId ? email.groupStatusFolder === "Trash" : !!email.inTrash;
}

export function isInArchive(email: EmailValues): boolean {
  return email.groupFolderId ? email.groupStatusFolder === "Archive" : !!email.inArchive;
}

/** Tham số hộp "Move to Folder" cho một email (trang chi tiết). */
export function moveFolderParamsFor(email: EmailValues): { isGroup: boolean; noArchive: boolean; currentFolderId: string | null } {
  let currentFolderId: string | null = null;

  if (isInArchive(email)) {
    currentFolderId = FOLDER.archive;
  } else if (!isInTrash(email)) {
    currentFolderId = email.groupFolderId ? `group:${str(email.groupFolderId)}` : str(email.folderId) || null;
  }

  return {
    isGroup: !!email.groupFolderId || !email.isUsers,
    noArchive: !email.groupFolderId && !email.isUsers,
    currentFolderId,
  };
}

/** Kiểu chữ của tiêu đề email: quan trọng / thùng rác / lưu trữ (`views/email/fields/subject`). */
export function subjectStyle(email: EmailValues): "important" | "trash" | "archive" | null {
  if (email.isImportant) {
    return "important";
  }

  if (isInTrash(email)) {
    return "trash";
  }

  return isInArchive(email) ? "archive" : null;
}

/** Thư mục chứa email, như field `folderString` (`views/email/fields/folder-string`). Nhiều giá trị → mảng. */
export function folderString(email: EmailValues, userId: string, t: Translator): string[] {
  const preset = (name: string) => t(name, "presetFilters", "Email");
  const withSent = (value: string) => (email.isUsersSent ? [value, preset("sent")] : [value]);

  if (str(email.groupFolderName)) {
    let value = `${t("group", "strings", "Email")} · ${str(email.groupFolderName)}`;

    if (email.groupStatusFolder === "Archive") {
      value += ` · ${preset("archive")}`;
    } else if (email.groupStatusFolder === "Trash") {
      value += ` · ${preset("trash")}`;
    }

    return withSent(value);
  }

  let value: string | null = null;

  if (email.inTrash) {
    value = preset("trash");
  }

  if (email.inArchive) {
    value = preset("archive");
  }

  if (str(email.folderName) && email.folderId) {
    value = str(email.folderName);
  }

  if (value && email.isUsersSent) {
    return withSent(value);
  }

  if (email.isUsersSent) {
    return [preset("sent")];
  }

  if (email.createdById === userId && email.status === "Draft") {
    return [preset("drafts")];
  }

  if (value) {
    return [value];
  }

  return email.isUsers ? [preset("inbox")] : [];
}

/** Email đã đọc chưa (email mình gửi luôn coi là đã đọc; không có `isRead` → đã đọc). */
export function emailIsRead(email: EmailValues, userId: string): boolean {
  return email.sentById === userId || email.isRead !== false;
}

// ===== Địa chỉ =====

/** `Tên <a@b.c>` → `Tên`; không có `<` → null. */
export function parseNameFromStringAddress(value: string): string | null {
  if (!value.includes("<")) {
    return null;
  }

  let name = value.replace(/<(.*)>/, "").trim();

  if (name.length > 1 && name.startsWith('"') && name.endsWith('"')) {
    name = name.slice(1, -1);
  }

  return name;
}

/** `Tên <a@b.c>` → `a@b.c`. */
export function parseAddressFromStringAddress(value: string): string {
  const match = value.match(/<(.*)>/);

  return match ? match[1] : value.trim();
}

/** Chuỗi địa chỉ phân cách `;` → danh sách (bỏ rỗng). */
export function splitAddresses(value: unknown): string[] {
  return str(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export const joinAddresses = (list: string[]) => list.join(";");

const EMAIL_PATTERN = /^[^\s@;,<>]+@[^\s@;,<>]+$/;

export const isValidEmailAddress = (value: string) => EMAIL_PATTERN.test(value.trim());

/** Tách chuỗi người dùng dán/gõ (`a@b.c, Tên <d@e.f>; …`) thành danh sách địa chỉ kèm tên. */
export function parseAddressInput(input: string): { address: string; name: string | null }[] {
  return input
    .split(/[;,\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ address: parseAddressFromStringAddress(part), name: parseNameFromStringAddress(part) }))
    .filter((item) => !!item.address);
}

const ERASED_PREFIX = "ERASED:";

type ReplyUser = {
  id: string;
  emailAddress?: unknown;
  emailAddressList?: unknown;
  userEmailAddressList?: unknown;
  excludeFromReplyEmailAddressList?: unknown;
  defaultTeamId?: unknown;
  defaultTeamName?: unknown;
};

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

/** Dòng mở đầu trích dẫn khi trả lời: "30 Thg 9, 14:00, Tên:". */
function replyHead(email: EmailValues, dateTime: DateTimeFormat, t: Translator, now: Date): string {
  const dateSent = str(email.dateSent);
  let head: string;

  if (dateSent) {
    const date = dateTime.toDayjs(dateSent);

    head = date.format(`${dateTime.getReadableShortDateFormat()} ${dateTime.timeFormat}`);

    if (date.year() !== dateTime.toDayjs(now.toISOString().slice(0, 19).replace("T", " ")).year()) {
      head += `, ${date.year()}`;
    }
  } else {
    head = t("Original message", "labels", "Email");
  }

  if (!email.fromName && email.from) {
    const name = (email.nameHash as Record<string, string> | undefined)?.[str(email.from)];

    if (name) {
      head += `, ${name}`;
    }
  }

  return `${head}:`;
}

/** Thân email trả lời: trích dẫn thư gốc (`addReplyBodyAttributes`). */
export function replyBody(email: EmailValues, dateTime: DateTimeFormat, t: Translator, now = new Date()): { body: string; bodyPlain?: string } {
  const head = replyHead(email, dateTime, t, now);

  if (email.isHtml) {
    return { body: `<p data-quote-start="true"><br></p><p>${escapeText(head)}</p><blockquote>${str(email.body)}</blockquote>` };
  }

  const plain = str(email.body) || str(email.bodyPlain);
  let body = `\n\n${head}\n`;

  for (const line of plain.split("\n")) {
    body += `> ${line}\n`;
  }

  return { body, bodyPlain: body };
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Attribute của email trả lời (`EmailHelper.getReplyAttributes`): người nhận lấy từ Reply-To hoặc người gửi,
 * Reply All thêm CC (bỏ địa chỉ của mình), giữ parent/team, `repliedId` để Espo nối luồng.
 * `canAssignTeam`: kiểm tra quyền gán team (team không có quyền thì bỏ).
 */
export function replyAttributes(
  email: EmailValues,
  options: { cc: boolean; user: ReplyUser; dateTime: DateTimeFormat; t: Translator; canAssignTeam?: (teamId: string) => boolean; now?: Date },
): EmailValues {
  const { user } = options;
  const attributes: EmailValues = { status: "Draft", isHtml: email.isHtml };
  const subject = str(email.name);

  attributes.name = subject.toUpperCase().startsWith("RE:") ? subject : `Re: ${subject}`;

  const nameHash: Record<string, string> = { ...((email.nameHash as Record<string, string> | undefined) ?? {}) };
  const userAddresses = stringList(user.emailAddressList);
  const personalAddresses = stringList(user.userEmailAddressList);
  const lcPersonal = personalAddresses.map((item) => item.toLowerCase());
  let to = "";
  let isReplyOnSent = false;

  if (str(email.replyTo)) {
    to = str(email.replyTo);
  } else if (str(email.replyToString)) {
    const list: string[] = [];

    for (const item of str(email.replyToString).split(";")) {
      const address = parseAddressFromStringAddress(item);

      if (!address) {
        continue;
      }

      list.push(address);

      const name = parseNameFromStringAddress(item.trim());

      if (name && name !== address) {
        nameHash[address] = name;
      }
    }

    to = list.join(";");
  }

  const from = str(email.from);

  if ((!to || !to.includes("@")) && from) {
    if (!userAddresses.includes(from)) {
      to = from;

      if (!nameHash[to]) {
        const fromString = str(email.fromString) || str(email.fromName);
        const name = fromString ? parseNameFromStringAddress(fromString) : null;

        if (name && name !== to) {
          nameHash[to] = name;
        }
      }
    } else {
      isReplyOnSent = true;
    }
  }

  let cc = "";

  if (options.cc) {
    cc = str(email.cc);

    const exclude = stringList(user.excludeFromReplyEmailAddressList);

    for (const raw of str(email.to).split(";")) {
      const item = raw.trim();

      if (!item || item === user.emailAddress || exclude.includes(item)) {
        continue;
      }

      if (isReplyOnSent) {
        to = to ? `${to};${item}` : item;
        continue;
      }

      cc = cc ? `${cc};${item}` : item;
    }
  }

  attributes.to = to
    .split(";")
    .filter((item) => item && !item.startsWith(ERASED_PREFIX))
    .join(";");

  if (options.cc) {
    attributes.cc = cc
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item && !lcPersonal.includes(item.toLowerCase()) && !item.startsWith(ERASED_PREFIX))
      .join(";");
  }

  if (email.parentId) {
    attributes.parentId = email.parentId;
    attributes.parentName = email.parentName;
    attributes.parentType = email.parentType;
  }

  const teamsIds = stringList(email.teamsIds);

  if (teamsIds.length) {
    const teamsNames: Record<string, string> = { ...((email.teamsNames as Record<string, string> | undefined) ?? {}) };
    const defaultTeamId = str(user.defaultTeamId);

    if (defaultTeamId && !teamsIds.includes(defaultTeamId)) {
      teamsIds.push(defaultTeamId);
      teamsNames[defaultTeamId] = str(user.defaultTeamName);
    }

    attributes.teamsIds = teamsIds.filter((id) => options.canAssignTeam?.(id) ?? true);
    attributes.teamsNames = teamsNames;
  }

  attributes.nameHash = nameHash;
  attributes.typeHash = email.typeHash ?? {};
  attributes.idHash = email.idHash ?? {};
  attributes.repliedId = email.id;
  attributes.inReplyTo = email.messageId;

  // Gửi từ đúng địa chỉ cá nhân đã nhận thư.
  const lcTo = str(email.to)
    .split(";")
    .map((item) => item.toLowerCase());

  for (const address of personalAddresses) {
    if (lcTo.includes(address.toLowerCase())) {
      attributes.from = address;
      break;
    }
  }

  return { ...attributes, ...replyBody(email, options.dateTime, options.t, options.now) };
}

/**
 * Attribute của email chuyển tiếp (`getForwardAttributes` + `addForwardBodyAttributes`).
 * `email.body` nên lấy từ `getDuplicateAttributes` (ảnh nhúng đã được copy).
 */
export function forwardAttributes(email: EmailValues, options: { dateTime: DateTimeFormat; t: Translator }): EmailValues {
  const { t, dateTime } = options;
  const isHtml = !!email.isHtml;
  const subject = str(email.name);
  const attributes: EmailValues = {
    status: "Draft",
    isHtml: email.isHtml,
    name: /^(FWD?|FW):/i.test(subject) ? subject : `Fwd: ${subject}`,
  };

  if (email.parentId) {
    attributes.parentId = email.parentId;
    attributes.parentName = email.parentName;
    attributes.parentType = email.parentType;
  }

  const nameHash = (email.nameHash as Record<string, string> | undefined) ?? {};
  const address = (value: string) => {
    const name = Object.hasOwn(nameHash, value) ? `${isHtml ? escapeText(nameHash[value]) : nameHash[value]} ` : "";

    return `${name}${isHtml ? `&lt;${escapeText(value)}&gt;` : `<${value}>`}`;
  };
  const text = (value: string) => (isHtml ? escapeText(value) : value);
  const lines: string[] = [];

  if (email.from) {
    lines.push(`${t("from", "fields", "Email")}: ${address(str(email.from))}`);
  }

  if (email.dateSent) {
    lines.push(`${t("dateSent", "fields", "Email")}: ${dateTime.toDisplay(str(email.dateSent))}`);
  }

  if (subject) {
    lines.push(`${t("subject", "fields", "Email")}: ${text(subject)}`);
  }

  if (email.to) {
    lines.push(`${t("to", "fields", "Email")}: ${splitAddresses(email.to).map(address).join(";")}`);
  }

  const marker = `------${t("Forwarded message", "labels", "Email")}------`;

  if (isHtml) {
    attributes.body = `<br>${marker}${lines.map((line) => `<br>${line}`).join("")}<br><br>${str(email.body)}`;
  } else {
    const body = `\n\n${marker}${lines.map((line) => `\n${line}`).join("")}\n\n${str(email.body) || str(email.bodyPlain)}`;

    attributes.body = body;
    attributes.bodyPlain = body;
  }

  return attributes;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * HTML → văn bản thuần (`htmlToPlain` của compose): xuống dòng theo `<br>`/`</p>`, bỏ thẻ và style.
 * Kết quả chỉ dùng làm văn bản (không chèn lại vào HTML).
 */
export function htmlToPlain(html: string): string {
  return (html || "")
    .replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code: string) => {
      if (code.startsWith("#")) {
        const value = code[1] === "x" || code[1] === "X" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);

        return Number.isFinite(value) ? String.fromCodePoint(value) : match;
      }

      return ENTITIES[code.toLowerCase()] ?? match;
    });
}

export const plainToHtml = (text: string) => (text || "").replace(/\n/g, "<br>");

/**
 * Chèn chữ ký (`preferences.signature`, HTML) vào thân email mới: đặt trước thư trích dẫn
 * (`prependSignature`) hoặc nối cuối (`appendSignature`, khi chèn mẫu).
 */
export function withSignature(body: string, isHtml: boolean, signature: string, mode: "prepend" | "append"): string {
  if (!signature) {
    return body;
  }

  if (isHtml) {
    return mode === "prepend" ? `<p><br></p>${signature}${body}` : `${body}${signature}`;
  }

  const plain = htmlToPlain(signature.replace(/<br\s*\/?>/gm, "\n")).trim();

  return mode === "prepend" ? `\n\n${plain}${body ? "\n" : ""}${body}` : `${body}\n\n${plain}`;
}

/** Tên người gửi tách thành họ/tên (Create Lead/Contact từ email). */
export function personAttributesFromEmail(email: EmailValues): EmailValues {
  const attributes: EmailValues = {};
  const setName = (name: string | null) => {
    if (!name) {
      return;
    }

    const parts = name.split(" ");

    attributes.firstName = parts.slice(0, -1).join(" ");
    attributes.lastName = parts.slice(-1).join(" ");
  };
  const fromString = str(email.fromString) || str(email.fromName);

  if (fromString) {
    setName(parseNameFromStringAddress(fromString));
  }

  const replyTo = str(email.replyToString);

  if (replyTo) {
    const first = replyTo.split(";")[0];

    attributes.emailAddress = parseAddressFromStringAddress(first);
    setName(parseNameFromStringAddress(first));
  }

  if (!attributes.emailAddress) {
    attributes.emailAddress = email.from;
  }

  attributes.originalEmailId = email.id;

  return attributes;
}

/** Create Case từ email (`actionCreateCase`): parent → account/contact/lead, mô tả = thân thuần. */
export function caseAttributesFromEmail(email: EmailValues): EmailValues {
  const attributes: EmailValues = { originalEmailId: email.id, name: email.name, description: str(email.bodyPlain) };
  const parentId = str(email.parentId);
  const parentName = email.parentName;

  if (parentId) {
    if (email.parentType === "Account") {
      attributes.accountId = parentId;
      attributes.accountName = parentName;
    } else if (email.parentType === "Contact") {
      attributes.contactId = parentId;
      attributes.contactName = parentName;
      attributes.contactsIds = [parentId];
      attributes.contactsNames = { [parentId]: parentName };

      if (email.accountId) {
        attributes.accountId = email.accountId;
        attributes.accountName = email.accountName ?? email.accountId;
      }
    } else if (email.parentType === "Lead") {
      attributes.leadId = parentId;
      attributes.leadName = parentName;
    }
  }

  return attributes;
}

/** Create Task từ email: cùng parent, mô tả có link về email (Markdown). */
export function taskAttributesFromEmail(email: EmailValues, emailHref: string, t: Translator): EmailValues {
  return {
    parentId: email.parentId ?? null,
    parentName: email.parentName ?? null,
    parentType: email.parentType ?? null,
    originalEmailId: email.id,
    description: `[${t("Email", "scopeNames")}: ${str(email.name)}](${emailHref})\n`,
  };
}

type ParentContext = {
  metadata: Metadata;
  settings: Settings;
  user: ReplyUser & { name?: unknown };
  canAssignTeam?: (teamId: string) => boolean;
};

/** Parent của email soạn/lưu từ panel của bản ghi (Contact → Account của contact, Lead → chính lead…). */
function parentAttributes(parentScope: string, parent: EmailValues, ctx: ParentContext): EmailValues {
  const attributes: EmailValues = {};

  if (parentScope === "Contact") {
    if (ctx.settings.b2cMode) {
      Object.assign(attributes, { parentType: "Contact", parentId: parent.id, parentName: parent.name });
    } else if (parent.accountId) {
      Object.assign(attributes, { parentType: "Account", parentId: parent.accountId, parentName: parent.accountName });
    }
  } else if (parentScope === "Lead") {
    Object.assign(attributes, { parentType: "Lead", parentId: parent.id, parentName: parent.name });
  }

  if (!attributes.parentId) {
    if (checkParentTypeAvailability(ctx.metadata, "Email", parentScope)) {
      Object.assign(attributes, { parentType: parentScope, parentId: parent.id, parentName: parent.name });
    }
  } else if (typeof attributes.parentType === "string" && !checkParentTypeAvailability(ctx.metadata, "Email", attributes.parentType)) {
    Object.assign(attributes, { parentType: null, parentId: null, parentName: null });
  }

  return attributes;
}

/**
 * Email soạn từ panel Activities (`getComposeEmailAttributes`): gửi tới địa chỉ của bản ghi, parent theo loại bản ghi,
 * giữ team của parent nếu nằm trong `emailKeepParentTeamsEntityList`, kèm account của bản ghi.
 */
export function composeEmailAttributes(parentScope: string, parent: EmailValues, ctx: ParentContext): EmailValues {
  const attributes: EmailValues = { status: "Draft", to: parent.emailAddress ?? null, ...parentAttributes(parentScope, parent, ctx) };

  if (["Contact", "Lead", "Account"].includes(parentScope) && str(parent.emailAddress)) {
    attributes.nameHash = { [str(parent.emailAddress)]: parent.name };
  }

  const keepTeams = stringList(ctx.settings.emailKeepParentTeamsEntityList);
  const teamsIds = stringList(parent.teamsIds);

  if (attributes.parentType === parentScope && keepTeams.includes(parentScope) && teamsIds.length) {
    const teamsNames: Record<string, string> = { ...((parent.teamsNames as Record<string, string> | undefined) ?? {}) };
    const defaultTeamId = str(ctx.user.defaultTeamId);

    if (defaultTeamId && !teamsIds.includes(defaultTeamId)) {
      teamsIds.push(defaultTeamId);
      teamsNames[defaultTeamId] = str(ctx.user.defaultTeamName);
    }

    attributes.teamsIds = teamsIds.filter((id) => ctx.canAssignTeam?.(id) ?? true);
    attributes.teamsNames = teamsNames;
  }

  const accountDefs = getFieldDefs(ctx.metadata, parentScope, "account");

  if (parent.accountId && accountDefs?.type === "link" && getEntityDefs(ctx.metadata, parentScope).links?.account?.entity === "Account") {
    attributes.accountId = parent.accountId;
    attributes.accountName = parent.accountName;
  }

  return attributes;
}

/** Email lưu từ panel History (`getArchiveEmailAttributes`): từ địa chỉ của bản ghi tới mình, ngày gửi = bây giờ. */
export function archiveEmailAttributes(parentScope: string, parent: EmailValues, ctx: ParentContext & { now: string }): EmailValues {
  return {
    dateSent: ctx.now,
    status: "Archived",
    from: parent.emailAddress ?? null,
    to: ctx.user.emailAddress ?? null,
    nameHash: { [str(parent.emailAddress)]: parent.name },
    ...parentAttributes(parentScope, parent, ctx),
  };
}

/**
 * Nguồn danh sách người nhận khi soạn email từ panel: Opportunity/Case có view panel riêng lấy địa chỉ của
 * contact liên quan; entity loại BasePlus không có email thì hỏi `composeEmailAddressList`.
 */
export function composeAddressSource(
  parentScope: string,
  parent: EmailValues,
  metadata: Metadata,
  panelView: string | undefined,
): "opportunity" | "case" | "basePlus" | null {
  if (panelView?.includes("opportunity/record/panels/activities")) {
    return "opportunity";
  }

  if (panelView?.includes("case/record/panels/activities")) {
    return "case";
  }

  return !str(parent.emailAddress) && metadata.scopes?.[parentScope]?.type === "BasePlus" ? "basePlus" : null;
}

/** Điền người nhận theo nguồn ở trên. Case: người đầu là To, còn lại CC; tiêu đề `[#số] tên`. */
export async function loadComposeAddresses(
  source: "opportunity" | "case" | "basePlus",
  parentScope: string,
  parent: EmailValues,
  attributes: EmailValues,
): Promise<EmailValues> {
  const url =
    source === "basePlus"
      ? `Activities/${encodeURIComponent(parentScope)}/${encodeURIComponent(parent.id as string)}/composeEmailAddressList`
      : `${source === "case" ? "Case" : "Opportunity"}/action/emailAddressList?id=${encodeURIComponent(parent.id as string)}`;
  const list = await espoGet<{ emailAddress: string; name?: string }[]>(url);

  if (!list.length && source === "basePlus") {
    return attributes;
  }

  const next: EmailValues = { ...attributes, nameHash: {} };
  const nameHash = next.nameHash as Record<string, string>;
  const to: string[] = [];
  const cc: string[] = [];

  list.forEach((item, index) => {
    (source === "case" && index > 0 ? cc : to).push(item.emailAddress);
    nameHash[item.emailAddress] = item.name ?? item.emailAddress;
  });

  next.to = to.join(";");

  if (source !== "basePlus") {
    next.cc = cc.join(";");
  }

  if (source === "case") {
    next.name = `[#${String(parent.number ?? "")}] ${str(parent.name)}`;
  }

  return next;
}

/** Lỗi gửi email (`errorHandlerSendingFail`): "Email sending failed: <lý do đã dịch>". */
export function sendingFailedMessage(message: string | null | undefined, t: Translator): string {
  let text = t("sendingFailed", "strings", "Email");

  if (message) {
    const translated = t(message, "messages", "Email");

    text += `: ${translated}`;
  }

  return text;
}

// ===== API =====

export async function listEmailFolders(): Promise<FolderItem[]> {
  const result = await espoGet<{ list: FolderItem[] }>("EmailFolder/action/listAll");

  return result.list ?? [];
}

export function getNotReadCounts(): Promise<Record<string, number>> {
  return espoGet<Record<string, number>>("Email/inbox/notReadCounts");
}

type Target = { ids: string[] } | { id: string } | { all: true };

export const markRead = (target: Target, read: boolean) => sendRequest(read ? "POST" : "DELETE", "Email/inbox/read", target);

export const markImportant = (target: Target, important: boolean) =>
  sendRequest(important ? "POST" : "DELETE", "Email/inbox/important", target);

export const setInTrash = (target: Target, inTrash: boolean) => sendRequest(inTrash ? "POST" : "DELETE", "Email/inbox/inTrash", target);

export const moveToFolder = (target: Target, folderId: string) =>
  sendRequest("POST", `Email/inbox/folders/${encodeURIComponent(folderId)}`, target);

/** Chuyển thư mục hàng loạt qua `MassAction` (`massMoveToFolder`): trả về số email đã chuyển. */
export function massMoveToFolder(ids: string[], folderId: string): Promise<{ count?: number; id?: string }> {
  return sendRequest("POST", "MassAction", { entityType: "Email", action: "moveToFolder", params: { ids }, idle: false, data: { folderId } });
}

/** Attribute để chuyển tiếp: thân + đính kèm đã copy (`Email/action/getDuplicateAttributes`). */
export function getDuplicateAttributes(id: string): Promise<EmailValues> {
  return postAction<EmailValues>("Email", "getDuplicateAttributes", { id });
}

export type AddressSuggestion = { emailAddress: string; name?: string; entityType?: string; entityId?: string };

/** Gợi ý địa chỉ khi gõ To/CC/BCC (`EmailAddress/search`). */
export function searchEmailAddresses(q: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  return espoGet<AddressSuggestion[]>(`EmailAddress/search?q=${encodeURIComponent(q)}&maxSize=7`, { signal });
}

export type PreparedTemplate = {
  subject?: string | null;
  body?: string | null;
  isHtml?: boolean;
  attachmentsIds?: string[];
  attachmentsNames?: Record<string, string>;
};

/** Điền mẫu email theo người nhận/parent (`EmailTemplate/:id/prepare`). */
export function prepareEmailTemplate(id: string, email: EmailValues): Promise<PreparedTemplate> {
  const to = str(email.to).trim();

  return sendRequest("POST", `EmailTemplate/${encodeURIComponent(id)}/prepare`, {
    emailAddress: to ? to.split(";")[0].trim() : null,
    parentType: email.parentType ?? null,
    parentId: email.parentId ?? null,
    relatedType: email.relatedType ?? null,
    relatedId: email.relatedId ?? null,
  });
}

/** Copy đính kèm của email sang bản ghi khác (Create Case). */
export function copyEmailAttachments(id: string, parentType: string, field: string): Promise<{ ids: string[]; names: Record<string, string> }> {
  return sendRequest("POST", `Email/${encodeURIComponent(id)}/attachments/copy`, { parentType, field });
}

export type EmailRecord = EspoRecord;
