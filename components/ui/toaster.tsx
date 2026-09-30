"use client";

import { useSyncExternalStore } from "react";
import { describeEspoError } from "@/lib/espo/errors";
import type { Translator } from "@/lib/espo/i18n";

type ToastInput = { kind: "error"; error: unknown } | { kind: "error-text" | "success" | "info"; text: string };

type ToastItem = ToastInput & { id: number };

const AUTO_CLOSE_MS = 6000;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function push(item: ToastInput) {
  const id = nextId++;

  items = [...items.slice(-4), { ...item, id }];
  emit();
  window.setTimeout(() => dismiss(id), AUTO_CLOSE_MS);
}

function dismiss(id: number) {
  items = items.filter((item) => item.id !== id);
  emit();
}

/** Hiện thông báo góc màn hình. `toast.error(e)` dịch lỗi API theo quy tắc của classic. */
export const toast = {
  error: (error: unknown) => push({ kind: "error", error }),
  errorText: (text: string) => push({ kind: "error-text", text }),
  success: (text: string) => push({ kind: "success", text }),
  info: (text: string) => push({ kind: "info", text }),
};

const EMPTY: ToastItem[] = [];

export function Toaster({ t }: { t: Translator }) {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    () => items,
    () => EMPTY,
  );

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
    >
      {current.map((item) => {
        const isError = item.kind === "error" || item.kind === "error-text";
        let title: string;
        let detail: string | null = null;

        if (item.kind === "error") {
          ({ title, detail } = describeEspoError(item.error, t));
        } else {
          title = item.text;
        }

        return (
          <div
            key={item.id}
            role={isError ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${
              isError ? "border-red-200" : item.kind === "success" ? "border-emerald-200" : "border-slate-200"
            }`}
          >
            <span
              aria-hidden
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                isError ? "bg-red-500" : item.kind === "success" ? "bg-emerald-500" : "bg-blue-500"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{title}</p>
              {detail && <p className="mt-0.5 break-words text-slate-600">{detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label={t("Close")}
              className="-mr-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
