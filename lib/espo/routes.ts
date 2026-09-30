// Đường dẫn cho scope/bản ghi. Scope nào chưa làm trên UI mới thì trỏ sang UI classic qua /classic.

/** Scope đã có trang trên UI mới (giai đoạn 2 thêm dần vào đây). */
const IMPLEMENTED_SCOPES = new Set<string>();

/** Mở một route của UI classic (dạng hash, ví dụ `#Admin`, `#Account/view/<id>`). */
export function classicHref(hash = "#"): string {
  return `/classic?to=${encodeURIComponent(hash.startsWith("#") ? hash : `#${hash}`)}`;
}

export function scopeListHref(scope: string): string {
  return IMPLEMENTED_SCOPES.has(scope) ? `/${scope}` : classicHref(`#${scope}`);
}

export function recordViewHref(scope: string, id: string): string {
  return IMPLEMENTED_SCOPES.has(scope)
    ? `/${scope}/${encodeURIComponent(id)}`
    : classicHref(`#${scope}/view/${encodeURIComponent(id)}`);
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
