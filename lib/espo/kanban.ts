// Kanban: nhóm bản ghi theo trường trạng thái (`scopes.<Scope>.statusField`), kéo thả đổi nhóm/thứ tự.
// Port từ `views/record/kanban` của classic (không gồm pipeline của Espo 10).
import type { Acl } from "./acl";
import { espoGet } from "./client";
import { getFieldDefs } from "./entity";
import type { EspoRecord } from "./records";
import { sendRequest } from "./records";
import { searchParamsQuery, type SearchParams } from "./search";
import type { Metadata } from "./types";

export type KanbanGroup = { name: string; total: number; list: EspoRecord[]; label?: string | null; style?: string | null };

export type KanbanResult = { total: number; groups: KanbanGroup[] };

/** Trường trạng thái nếu scope bật Kanban (`clientDefs.kanbanViewMode`), không thì `null`. */
export function kanbanStatusField(metadata: Metadata, scope: string): string | null {
  const clientDefs = (metadata.clientDefs?.[scope] ?? {}) as Record<string, unknown>;
  const scopeDefs = (metadata.scopes?.[scope] ?? {}) as Record<string, unknown>;
  const field = typeof scopeDefs.statusField === "string" ? scopeDefs.statusField : null;

  return clientDefs.kanbanViewMode && field && getFieldDefs(metadata, scope, field) ? field : null;
}

/** Kéo thả đổi nhóm được khi sửa được trường trạng thái (như `statusFieldIsEditable`). */
export function kanbanCanMove(metadata: Metadata, acl: Acl, scope: string, statusField: string): boolean {
  const clientDefs = (metadata.clientDefs?.[scope] ?? {}) as Record<string, unknown>;

  return (
    acl.checkScope(scope, "edit") &&
    acl.checkField(scope, statusField, "edit") &&
    !clientDefs.editDisabled &&
    !getFieldDefs(metadata, scope, statusField)?.readOnly
  );
}

/** Sắp xếp thủ công trong nhóm (lưu theo người dùng) trừ khi scope tắt hoặc là portal. */
export function kanbanCanReorder(metadata: Metadata, scope: string, isPortal: boolean): boolean {
  return !isPortal && !(metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.kanbanOrderDisabled;
}

export function getKanban(scope: string, params: SearchParams, signal?: AbortSignal): Promise<KanbanResult> {
  return espoGet<KanbanResult>(`Kanban/${encodeURIComponent(scope)}?${searchParamsQuery(params)}`, { signal });
}

export function saveKanbanOrder(scope: string, group: string, ids: string[]): Promise<unknown> {
  return sendRequest("PUT", "Kanban/order", { entityType: scope, group, ids });
}

/**
 * Chuyển một thẻ sang nhóm/vị trí khác (cập nhật lạc quan trước khi lưu).
 * `index` là vị trí trong nhóm đích sau khi đã bỏ thẻ khỏi nhóm cũ; vượt quá thì thêm cuối.
 */
export function moveKanbanItem(groups: KanbanGroup[], id: string, toGroup: string, index: number, statusField: string): KanbanGroup[] {
  const from = groups.find((group) => group.list.some((item) => item.id === id));
  const item = from?.list.find((record) => record.id === id);

  if (!from || !item) {
    return groups;
  }

  const moved = { ...item, [statusField]: toGroup };

  return groups.map((group) => {
    let list = group.list.filter((record) => record.id !== id);
    let total = group.total;

    if (group.name === from.name && group.name !== toGroup) {
      total -= 1;
    }

    if (group.name === toGroup) {
      list = [...list.slice(0, Math.max(0, index)), moved, ...list.slice(Math.max(0, index))];

      if (group.name !== from.name) {
        total += 1;
      }
    }

    return group.name === from.name || group.name === toGroup ? { ...group, list, total } : group;
  });
}
