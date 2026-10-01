"use client";

// Trang thông báo (tương đương `#Notification` của classic): danh sách đầy đủ, tải thêm, đánh dấu tất cả đã đọc.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock } from "@/components/record/scope-gate";
import { Button } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { listNotifications, markAllNotificationsRead, type Notification } from "@/lib/espo/notifications";
import { NotificationItem } from "./notification-item";

export function NotificationList() {
  const ctx = useFieldContext();
  const queryClient = useQueryClient();
  const pageSize = ctx && typeof ctx.settings.recordsPerPage === "number" ? ctx.settings.recordsPerPage : 20;
  const [maxSize, setMaxSize] = useState(pageSize);
  const list = useQuery({
    queryKey: ["notifications", "page", maxSize],
    queryFn: ({ signal }) => listNotifications({ maxSize }, signal),
    placeholderData: keepPreviousData,
    enabled: !!ctx,
  });

  useEffect(() => {
    if (list.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
    }
  }, [list.isSuccess, list.dataUpdatedAt, queryClient]);

  if (!ctx) {
    return <LoadingBlock />;
  }

  const { t } = ctx;
  const items = (list.data?.list ?? []) as Notification[];
  // Server không đếm tổng (total = -1/-2): còn nữa nếu trang vừa tải đầy.
  const total = list.data?.total ?? 0;
  const hasMore = total < 0 ? items.length >= maxSize : total > items.length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Notifications")}</h1>
        <Button
          onClick={async () => {
            try {
              await markAllNotificationsRead();
              await queryClient.invalidateQueries({ queryKey: ["notifications"] });
            } catch (error) {
              toast.error(error);
            }
          }}
        >
          <i className="fas fa-check-double text-xs" aria-hidden />
          {t("Mark all read")}
        </Button>
      </div>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        {list.isLoading && <LoadingBlock />}
        {list.data && !items.length && <p className="px-4 py-10 text-center text-sm text-slate-500">{t("No Data")}</p>}
        {items.map((item) => (
          <NotificationItem key={item.id} ctx={ctx} notification={item} />
        ))}
      </div>
      {hasMore && (
        <button type="button" onClick={() => setMaxSize(maxSize + pageSize)} className="self-center text-sm font-medium text-blue-600 hover:underline">
          {t("Show more")}
        </button>
      )}
    </div>
  );
}
