"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// Ô nhập dùng chung cho mọi field: cùng kiểu với màn hình login (viền slate, focus xanh, lỗi đỏ).
const base =
  "rounded-lg border bg-white text-sm text-slate-900 shadow-xs outline-none transition " +
  "placeholder:text-slate-400 hover:border-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-50 " +
  "disabled:text-slate-500";

export function inputClass(invalid = false, extra = "") {
  // Mặc định rộng hết chỗ; nếu nơi gọi tự đặt độ rộng (`w-…`) thì dùng độ rộng đó.
  const width = /(^|\s)w-/.test(extra) ? "" : "w-full";

  return `${base} ${width} ${
    invalid
      ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
      : "border-slate-300 focus:border-blue-600 focus:ring-blue-600/15"
  } ${extra}`;
}

export function TextInput({ invalid, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={inputClass(invalid, `h-9 px-3 ${className}`)} />;
}

export function TextArea({ invalid, className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea {...props} aria-invalid={invalid || undefined} className={inputClass(invalid, `min-h-20 px-3 py-2 ${className}`)} />;
}

export function Select({
  invalid,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select {...props} aria-invalid={invalid || undefined} className={inputClass(invalid, `h-9 pr-8 pl-3 ${className}`)}>
      {children}
    </select>
  );
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" {...props} className="size-4 rounded border-slate-300 accent-blue-600" />
      {label}
    </label>
  );
}

/** Nhãn màu cho enum `displayAsLabel` (style: primary/success/danger/warning/info). */
const BADGE_STYLES: Record<string, string> = {
  primary: "bg-blue-50 text-blue-700 ring-blue-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  default: "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function Badge({ style, children }: { style?: string | null; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        BADGE_STYLES[style ?? "default"] ?? BADGE_STYLES.default
      }`}
    >
      {children}
    </span>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
