/**
 * Icon của scope/tab: class Font Awesome từ `clientDefs.iconClass` (admin chọn trong Entity Manager).
 * Không có icon thì hiện 2 chữ cái đầu của nhãn trên nền màu của scope (giống `shortLabel` của classic).
 */
export function ScopeIcon({
  iconClass,
  color,
  label,
  className = "",
}: {
  iconClass: string | null;
  color: string | null;
  label: string;
  className?: string;
}) {
  if (iconClass) {
    return (
      <span
        aria-hidden
        className={`inline-flex size-5 shrink-0 items-center justify-center text-[15px] ${className}`}
        style={color ? { color } : undefined}
      >
        <i className={iconClass} />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold uppercase text-white ${className}`}
      style={{ backgroundColor: color ?? "#64748B" }}
    >
      {label.slice(0, 2)}
    </span>
  );
}
