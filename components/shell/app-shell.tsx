"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { EspoFooter } from "@/components/espo-footer";
import { useAppUser, useTranslator } from "@/components/providers/app-context";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { PopupReminders } from "@/components/notifications/popup-reminders";
import { AppUpdateBanner } from "./app-update-banner";
import { GlobalSearch } from "./global-search";
import { SidebarNav } from "./sidebar-nav";
import { UserMenu } from "./user-menu";

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  const { settings } = useAppUser();

  return (
    <Link href="/" onClick={onNavigate} className="flex h-14 shrink-0 items-center gap-2.5 px-5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-900/40">
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M6 17v-4M12 17V7M18 17v-7" />
        </svg>
      </span>
      <span className="truncate text-[15px] font-semibold tracking-tight text-white">
        {settings.applicationName || "EspoCRM"}
      </span>
    </Link>
  );
}

/** Khung ứng dụng: menu bên (drawer trên màn hình nhỏ), thanh trên có tìm kiếm và menu người dùng. */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTranslator();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPath, setDrawerPath] = useState(pathname);

  // Đổi trang thì đóng drawer (so sánh trong lúc render thay vì effect).
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setDrawerOpen(false);

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div className="flex min-h-dvh flex-1 bg-slate-50 text-slate-900">
      {/* Menu bên cố định (màn hình lớn) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col bg-slate-900 lg:flex">
        <Brand />
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <SidebarNav />
        </div>
      </aside>

      {/* Drawer (màn hình nhỏ) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label={t("Close")} className="absolute inset-0 bg-slate-900/50" onClick={closeDrawer} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-slate-900 shadow-xl">
            <Brand onNavigate={closeDrawer} />
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <SidebarNav onNavigate={closeDrawer} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
            <button
              type="button"
              aria-label={t("Menu")}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <GlobalSearch />
            <div className="ml-auto flex items-center gap-1">
              <NotificationBell />
              <UserMenu />
            </div>
          </div>
          <AppUpdateBanner />
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        <EspoFooter />
      </div>
      <PopupReminders />
    </div>
  );
}
