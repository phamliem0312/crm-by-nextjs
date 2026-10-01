"use client";

// Chuông thông báo trên thanh đầu trang: hỏi số chưa đọc định kỳ (`notificationsCheckInterval`, như classic khi
// không bật WebSocket), bấm để xem các thông báo mới nhất, đánh dấu tất cả đã đọc, mở trang thông báo.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useFieldContext } from "@/components/fields/use-field-context";
import { toast } from "@/components/ui/toaster";
import { getNotReadCount, listNotifications, markAllNotificationsRead, type Notification } from "@/lib/espo/notifications";
import { NotificationItem } from "./notification-item";

/** Hỏi lại khi tab đang mở; tab ẩn thì tạm dừng để đỡ tải server. */
function useVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export function NotificationBell() {
  const ctx = useFieldContext();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const visible = useVisible();
  const interval = ctx && typeof ctx.settings.notificationsCheckInterval === "number" ? ctx.settings.notificationsCheckInterval : 10;
  const maxSize = ctx && typeof ctx.settings.notificationsMaxSize === "number" ? ctx.settings.notificationsMaxSize : 5;

  const count = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: getNotReadCount,
    refetchInterval: visible ? interval * 1000 : false,
    meta: { silent: true },
    enabled: !!ctx,
  });
  const list = useQuery({
    queryKey: ["notifications", "list", maxSize],
    queryFn: ({ signal }) => listNotifications({ maxSize }, signal),
    enabled: open,
    staleTime: 0,
  });

  // Mở danh sách thì server đánh dấu đã đọc → cập nhật lại số đếm.
  useEffect(() => {
    if (list.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
    }
  }, [list.isSuccess, list.dataUpdatedAt, queryClient]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointer = (event: PointerEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);

    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!ctx) {
    return null;
  }

  const { t } = ctx;
  const unread = count.data ?? 0;
  const label = unread ? `${t("Notifications")}: ${unread}` : t("Notifications");

  async function markAll() {
    try {
      await markAllNotificationsRead();
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      toast.error(error);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(!open)}
        className="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <i className="far fa-bell text-base" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 rounded-full bg-red-600 px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("Notifications")}
          className="absolute right-0 z-40 mt-2 flex max-h-[70dvh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-800">{t("Notifications")}</h2>
            <button type="button" onClick={() => void markAll()} className="text-xs font-medium text-blue-600 hover:underline">
              {t("Mark all read")}
            </button>
          </div>
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {list.isLoading && <p className="px-4 py-6 text-center text-sm text-slate-500">{t("Loading...")}</p>}
            {list.data && !list.data.list.length && <p className="px-4 py-6 text-center text-sm text-slate-500">{t("No Data")}</p>}
            {(list.data?.list ?? []).map((item) => (
              <NotificationItem key={item.id} ctx={ctx} notification={item as Notification} />
            ))}
          </div>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-blue-600 hover:bg-slate-50"
          >
            {t("View List")}
          </Link>
        </div>
      )}
    </div>
  );
}
