// Đường dẫn cho scope/bản ghi. Scope nào chưa làm trên UI mới thì trỏ sang UI classic qua /classic.
import type { Metadata } from "./types";

/**
 * Entity vẫn mở ở classic: có giao diện riêng (Email, Campaign…), là phần quản trị (User, Team),
 * hoặc cần hành vi riêng của giai đoạn 3 (Meeting/Call: nhắc nhở, người tham dự, Set Held).
 */
const CLASSIC_SCOPES = new Set([
  "Email",
  "EmailTemplate",
  "EmailFolder",
  "EmailAccount",
  "InboundEmail",
  "User",
  "Team",
  "Role",
  "Portal",
  "PortalUser",
  "Import",
  "Campaign",
  "TargetList",
  "MassEmail",
  "Meeting",
  "Call",
]);

const SCOPE_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

/**
 * Scope được mở bằng engine bản ghi của UI mới: entity nghiệp vụ (`entity` + `object`), không tắt,
 * không nằm trong danh sách classic. Entity tự tạo trong Entity Manager cũng thuộc nhóm này.
 */
export function isNewUiScope(scope: string, metadata: Metadata | null | undefined): boolean {
  if (!metadata || !SCOPE_PATTERN.test(scope) || CLASSIC_SCOPES.has(scope)) {
    return false;
  }

  const defs = metadata.scopes?.[scope];

  return !!defs?.entity && !!defs.object && !defs.disabled;
}

/** Mở một route của UI classic (dạng hash, ví dụ `#Admin`, `#Account/view/<id>`). */
export function classicHref(hash = "#"): string {
  return `/classic?to=${encodeURIComponent(hash.startsWith("#") ? hash : `#${hash}`)}`;
}

export function scopeListHref(scope: string, metadata?: Metadata | null): string {
  return isNewUiScope(scope, metadata) ? `/${scope}` : classicHref(`#${scope}`);
}

export function recordViewHref(scope: string, id: string, metadata?: Metadata | null): string {
  return isNewUiScope(scope, metadata)
    ? `/${scope}/${encodeURIComponent(id)}`
    : classicHref(`#${scope}/view/${encodeURIComponent(id)}`);
}

export function recordEditHref(scope: string, id: string, metadata?: Metadata | null): string {
  return isNewUiScope(scope, metadata)
    ? `/${scope}/${encodeURIComponent(id)}/edit`
    : classicHref(`#${scope}/edit/${encodeURIComponent(id)}`);
}

export function recordCreateHref(scope: string, metadata?: Metadata | null): string {
  return isNewUiScope(scope, metadata) ? `/${scope}/create` : classicHref(`#${scope}/create`);
}

/**
 * Chỉ nhận hash route của classic: bắt đầu bằng `#`, không có ký tự điều khiển.
 * Giá trị không hợp lệ → `#` (trang chủ classic).
 */
export function safeClassicHash(value: string | null | undefined): string {
  if (!value || !value.startsWith("#") || value.length > 2000 || /[\u0000-\u001f\u007f\\]/.test(value)) {
    return "#";
  }

  return value;
}
