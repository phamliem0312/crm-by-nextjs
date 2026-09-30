"use client";

import type { ReactNode } from "react";
import { useTranslator } from "@/components/providers/app-context";
import { classicHref } from "@/lib/espo/routes";
import { useScopeStatus } from "./hooks";

export function PageMessage({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <i className={`${icon} text-lg`} aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      {children && <div className="text-sm text-slate-600">{children}</div>}
    </div>
  );
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16" aria-busy>
      <svg viewBox="0 0 24 24" className="size-6 animate-spin text-blue-600" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Chỉ render trang bản ghi khi scope mở được bằng UI mới và người dùng có quyền đọc.
 * `classicHash`: route classic tương ứng (ví dụ `#Account/view/<id>`) cho scope chưa hỗ trợ.
 */
export function ScopeGate({ scope, classicHash, children }: { scope: string; classicHash: string; children: ReactNode }) {
  const status = useScopeStatus(scope);
  const t = useTranslator();

  switch (status) {
    case "loading":
      return <LoadingBlock />;
    case "notFound":
      return <PageMessage icon="fas fa-question" title={t("Not found")} />;
    case "forbidden":
      return <PageMessage icon="fas fa-lock" title={t("Access denied")} />;
    case "classic":
      return (
        <PageMessage icon="fas fa-window-maximize" title={t(scope, "scopeNamesPlural")}>
          <a href={classicHref(classicHash)} className="font-medium text-blue-600 hover:underline">
            EspoCRM Classic
          </a>
        </PageMessage>
      );
    default:
      return <>{children}</>;
  }
}
