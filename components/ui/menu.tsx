"use client";

// Menu thả xuống nhỏ (nút "…" của note, hành động phụ của list): đóng khi bấm ra ngoài hoặc Esc,
// di chuyển bằng phím mũi tên giữa các mục.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export type MenuItem =
  | { kind?: "item"; label: string; icon?: string; onSelect: () => void; danger?: boolean; checked?: boolean; disabled?: boolean }
  | { kind: "divider" };

export function Menu({
  label,
  items,
  trigger,
  align = "right",
  triggerClassName,
}: {
  /** Nhãn cho trình đọc màn hình (nút chỉ có icon). */
  label: string;
  items: MenuItem[];
  trigger?: ReactNode;
  align?: "left" | "right";
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointer);
    // Focus mục đầu tiên khi mở.
    ref.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled), [role="menuitemcheckbox"]:not(:disabled)')?.focus();

    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  if (!items.some((item) => item.kind !== "divider")) {
    return null;
  }

  return (
    <div
      ref={ref}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          ref.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
        }

        if ((event.key === "ArrowDown" || event.key === "ArrowUp") && open) {
          event.preventDefault();

          const list = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role^="menuitem"]:not(:disabled)') ?? [])];
          const index = list.indexOf(document.activeElement as HTMLButtonElement);
          const next = list[(index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length];

          next?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen(!open)}
        className={
          triggerClassName ??
          "inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        }
      >
        {trigger ?? <i className="fas fa-ellipsis-h text-xs" aria-hidden />}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={`absolute top-full z-40 mt-1 min-w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, index) =>
            item.kind === "divider" ? (
              <div key={`d${index}`} role="separator" className="my-1 border-t border-slate-100" />
            ) : (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={item.checked}
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm outline-none hover:bg-slate-50 focus-visible:bg-slate-100 disabled:opacity-50 ${
                  item.danger ? "text-red-600" : "text-slate-700"
                }`}
              >
                <span className="w-4 text-center text-xs text-slate-400">
                  {item.checked ? <i className="fas fa-check text-blue-600" aria-hidden /> : item.icon ? <i className={item.icon} aria-hidden /> : null}
                </span>
                <span className="flex-1">{item.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
