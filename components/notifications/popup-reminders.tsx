"use client";

// Popup nhắc lịch (Meeting/Call/Task tới giờ theo nhắc nhở loại "Popup"): hỏi định kỳ
// `PopupNotification/action/grouped` (`popupNotificationsCheckInterval`), đóng → `removePopupNotification`.
// Port từ `views/notification/badge` (popup) + `crm:views/meeting/popup-notification` của classic.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFieldContext } from "@/components/fields/use-field-context";
import { toast } from "@/components/ui/toaster";
import { dismissPopupReminder, getPopupReminders, type PopupReminder } from "@/lib/espo/notifications";
import { recordViewHref } from "@/lib/espo/routes";

export function PopupReminders() {
  const ctx = useFieldContext();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(true);
  const enabled = !!ctx && ctx.user.type !== "portal" && !!(ctx.metadata.app as Record<string, unknown> | undefined)?.popupNotifications;
  const interval = ctx && typeof ctx.settings.popupNotificationsCheckInterval === "number" ? ctx.settings.popupNotificationsCheckInterval : 15;

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");

    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const reminders = useQuery({
    queryKey: ["popupReminders"],
    queryFn: getPopupReminders,
    refetchInterval: visible ? interval * 1000 : false,
    enabled,
    meta: { silent: true },
  });

  if (!ctx || !reminders.data) {
    return null;
  }

  const { t } = ctx;
  const items: PopupReminder[] = Object.values(reminders.data).flat();

  if (!items.length) {
    return null;
  }

  async function dismiss(id: string) {
    try {
      await dismissPopupReminder(id);
      queryClient.setQueryData<Record<string, PopupReminder[]>>(["popupReminders"], (data) =>
        data ? Object.fromEntries(Object.entries(data).map(([key, list]) => [key, list.filter((item) => item.id !== id)])) : data,
      );
    } catch (error) {
      toast.error(error);
    }
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="region" aria-label={t("Reminders", "labels", "Meeting")}>
      {items.map((item) => {
        const { entityType, id, name, dateField, attributes } = item.data;
        const date = dateField ? attributes?.[dateField] : null;
        const dateOnly = dateField ? attributes?.[`${dateField}Date`] : null;

        return (
          <div key={item.id} role="alert" className="rounded-xl border border-amber-200 bg-white p-4 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-amber-500">
                <i className={ctx.metadata.clientDefs?.[entityType]?.iconClass ?? "fas fa-bell"} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{t(entityType, "scopeNames")}</p>
                <Link href={recordViewHref(entityType, id, ctx.metadata)} className="block truncate font-medium text-blue-700 hover:underline">
                  {name || id}
                </Link>
                {typeof date === "string" && date ? (
                  <p className="text-sm text-slate-600">{ctx.dateTime.toDisplay(date)}</p>
                ) : typeof dateOnly === "string" && dateOnly ? (
                  <p className="text-sm text-slate-600">{ctx.dateTime.toDisplayDate(dateOnly)}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void dismiss(item.id)}
                aria-label={`${t("Close")}: ${name ?? ""}`}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <i className="fas fa-times text-xs" aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
