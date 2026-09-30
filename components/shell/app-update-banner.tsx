"use client";

import { useEffect, useState } from "react";
import { useAppUser, useTranslator } from "@/components/providers/app-context";
import { onAppTimestamp } from "@/lib/espo/client";

/**
 * Espo trả `X-App-Timestamp` lớn hơn lúc tải trang → hệ thống vừa được cập nhật (rebuild, đổi metadata…).
 * Giống classic: gợi ý tải lại trang.
 */
export function AppUpdateBanner() {
  const { settings } = useAppUser();
  const t = useTranslator();
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    const loaded = settings.appTimestamp ?? 0;

    return onAppTimestamp((timestamp) => {
      if (loaded && timestamp > loaded) {
        setOutdated(true);
      }
    });
  }, [settings.appTimestamp]);

  if (!outdated) {
    return null;
  }

  return (
    <div role="status" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 lg:px-6">
      <span className="flex-1">{t("confirmAppRefresh", "messages")}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
      >
        {t("Refresh")}
      </button>
    </div>
  );
}
