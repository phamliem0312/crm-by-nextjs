// Hành động riêng theo entity ở đầu trang chi tiết, suy ra từ metadata thay vì viết theo từng scope:
// - Set Held / Set Not Held (Meeting, Call…: `crm:views/meeting/record/detail`)
// - Trạng thái tham dự của người dùng hiện tại (`crm:views/meeting/detail` → setAcceptanceStatus)
// - Chuyển đổi Lead (`crm:views/lead/detail` → `#Lead/convert`)
import type { Acl } from "./acl";
import { getEntityDefs, getFieldDefs } from "./entity";
import type { Metadata } from "./types";

type Rec = Record<string, unknown>;

function scopeList(metadata: Metadata, scope: string, key: string): string[] {
  const value = (metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.[key];

  return Array.isArray(value) ? value.map(String) : [];
}

export function statusFieldOf(metadata: Metadata, scope: string): string | null {
  const field = (metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.statusField;

  return typeof field === "string" && getFieldDefs(metadata, scope, field) ? field : null;
}

/** Hiện "Set Held"/"Set Not Held" khi sự kiện còn chưa diễn ra và người dùng sửa được trạng thái. */
export function canSetHeld(metadata: Metadata, acl: Acl, scope: string, record: Rec, canEdit: boolean): boolean {
  const history = scopeList(metadata, scope, "historyStatusList");
  const field = statusFieldOf(metadata, scope);

  return (
    !!field &&
    canEdit &&
    history.includes("Held") &&
    history.includes("Not Held") &&
    !history.includes(String(record[field] ?? "")) &&
    acl.checkField(scope, field, "edit")
  );
}

/**
 * Trạng thái tham dự của người dùng hiện tại, nếu được mời và sự kiện chưa kết thúc/huỷ.
 * `undefined` = không hiện nút; "None" = chưa trả lời.
 */
export function myAcceptanceStatus(metadata: Metadata, scope: string, record: Rec, userId: string): string | undefined {
  const usersDefs = getFieldDefs(metadata, scope, "users");

  if (!usersDefs || !(usersDefs.columns as Record<string, string> | undefined)?.status || !getFieldDefs(metadata, scope, "acceptanceStatus")) {
    return undefined;
  }

  const field = statusFieldOf(metadata, scope);
  const notActual = [...scopeList(metadata, scope, "completedStatusList"), ...scopeList(metadata, scope, "canceledStatusList")];

  if (field && notActual.includes(String(record[field] ?? ""))) {
    return undefined;
  }

  const ids = Array.isArray(record.usersIds) ? (record.usersIds as string[]) : [];

  if (!ids.includes(userId)) {
    return undefined;
  }

  const columns = record.usersColumns as Record<string, { status?: string } | undefined> | undefined;

  return columns?.[userId]?.status ?? "None";
}

export function acceptanceOptions(metadata: Metadata, scope: string): string[] {
  return (getFieldDefs(metadata, scope, "acceptanceStatus")?.options ?? []).filter((option) => option !== "None");
}

/** Entity chuyển đổi được (Lead → Account/Contact/Opportunity) khi trạng thái còn "actual". */
export function canConvert(metadata: Metadata, scope: string, record: Rec, canEdit: boolean): boolean {
  const list = getEntityDefs(metadata, scope).convertEntityList;

  if (!Array.isArray(list) || !list.length || !canEdit || !("status" in record)) {
    return false;
  }

  const notActual = [...((getFieldDefs(metadata, scope, "status")?.notActualOptions as string[] | undefined) ?? []), "Converted"];

  return !notActual.includes(String(record.status ?? ""));
}

/** Entity sẽ tạo khi chuyển đổi: theo `convertEntityList`, bỏ entity tắt/không có quyền tạo, Account ở chế độ B2C. */
export function convertScopes(metadata: Metadata, acl: Acl, scope: string, b2cMode: boolean): string[] {
  const list = getEntityDefs(metadata, scope).convertEntityList;

  return (Array.isArray(list) ? list.map(String) : []).filter(
    (item) =>
      !(item === "Account" && b2cMode) && !metadata.scopes?.[item]?.disabled && acl.checkScope(item, "create"),
  );
}
