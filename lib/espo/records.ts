// Gọi REST API bản ghi của Espo qua BFF (chỉ phía trình duyệt).
import { espoFetch, espoGet } from "./client";
import { EspoApiError } from "./errors";
import { searchParamsQuery, type SearchParams } from "./search";

export type EspoRecord = Record<string, unknown> & { id: string };

export type ListResult = { total: number; list: EspoRecord[] };

const path = (...parts: string[]) => parts.map(encodeURIComponent).join("/");

async function send<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await espoFetch(url, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await EspoApiError.fromResponse(response);
  }

  const text = await response.text();

  return (text ? JSON.parse(text) : null) as T;
}

export function listRecords(scope: string, params: SearchParams, signal?: AbortSignal): Promise<ListResult> {
  return espoGet<ListResult>(`${path(scope)}?${searchParamsQuery(params)}`, { signal });
}

export function listLinked(
  scope: string,
  id: string,
  link: string,
  params: SearchParams,
  signal?: AbortSignal,
): Promise<ListResult> {
  return espoGet<ListResult>(`${path(scope, id, link)}?${searchParamsQuery(params)}`, { signal });
}

export function getRecord(scope: string, id: string, signal?: AbortSignal): Promise<EspoRecord> {
  return espoGet<EspoRecord>(path(scope, id), { signal });
}

export type SaveOptions = { skipDuplicateCheck?: boolean };

const saveHeaders = (options: SaveOptions): Record<string, string> =>
  options.skipDuplicateCheck ? { "X-Skip-Duplicate-Check": "true" } : {};

/** Tạo bản ghi. Trùng → `EspoApiError` có `isDuplicate` và `list` (bản ghi trùng). */
export function createRecord(scope: string, data: Record<string, unknown>, options: SaveOptions = {}): Promise<EspoRecord> {
  return send<EspoRecord>("POST", path(scope), data, saveHeaders(options));
}

/** Cập nhật một phần (PATCH): chỉ gửi attribute đã đổi. */
export function updateRecord(
  scope: string,
  id: string,
  data: Record<string, unknown>,
  options: SaveOptions = {},
): Promise<EspoRecord> {
  return send<EspoRecord>("PATCH", path(scope, id), data, saveHeaders(options));
}

export function deleteRecord(scope: string, id: string): Promise<unknown> {
  return send("DELETE", path(scope, id));
}

/** `POST MassAction` theo danh sách id (action `delete`, `update`…). */
export function massAction(
  scope: string,
  action: "delete" | "update" | string,
  ids: string[],
  data?: Record<string, unknown>,
): Promise<{ count?: number; ids?: string[] }> {
  return send("POST", "MassAction", { entityType: scope, action, params: { ids }, data: data ?? {} });
}

export function linkRecords(scope: string, id: string, link: string, ids: string[]): Promise<unknown> {
  return send("POST", path(scope, id, link), { ids });
}

export function unlinkRecord(scope: string, id: string, link: string, foreignId: string): Promise<unknown> {
  return send("DELETE", path(scope, id, link), { id: foreignId });
}

export function setFollowed(scope: string, id: string, followed: boolean): Promise<unknown> {
  return send(followed ? "PUT" : "DELETE", path(scope, id, "subscription"));
}

export function setStarred(scope: string, id: string, starred: boolean): Promise<unknown> {
  return send(starred ? "PUT" : "DELETE", path(scope, id, "starSubscription"));
}

export type AttachmentTarget =
  /** Field `file`/`image`: gắn qua `relatedType`. */
  | { relatedType: string; field: string }
  /** Field `attachmentMultiple`: gắn qua `parentType`. */
  | { parentType: string; field: string };

export type UploadedAttachment = { id: string; name: string; type: string };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Tải file lên như classic (`helpers/file-upload`): `POST Attachment` với nội dung dạng data URL. */
export async function uploadAttachment(file: File, target: AttachmentTarget): Promise<UploadedAttachment> {
  const result = await send<{ id: string; name?: string; type?: string }>("POST", "Attachment", {
    name: file.name,
    type: file.type || "text/plain",
    size: file.size,
    role: "Attachment",
    ...target,
    file: await readAsDataUrl(file),
  });

  return { id: result.id, name: result.name ?? file.name, type: result.type ?? file.type };
}

/** Các attribute đã đổi so với bản đã lưu (để PATCH gọn). */
export function changedAttributes(saved: Record<string, unknown>, current: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(current)) {
    if (JSON.stringify(saved[key] ?? null) !== JSON.stringify(value ?? null)) {
      result[key] = value;
    }
  }

  return result;
}
