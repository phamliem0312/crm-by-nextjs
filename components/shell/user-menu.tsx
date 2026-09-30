"use client";

import { useEffect, useRef, useState } from "react";
import { useAppUser, useClassicBasePath, useTranslator } from "@/components/providers/app-context";
import { requestLogout } from "@/lib/espo/login-api";
import { classicHref } from "@/lib/espo/routes";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const menuItemClass =
  "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none";

export function UserMenu() {
  const { user } = useAppUser();
  const t = useTranslator();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const classicBasePath = useClassicBasePath();
  const isAdmin = user.type === "admin" || user.type === "super-admin";
  const displayName = user.name || user.userName;
  const avatarId = typeof user.avatarId === "string" ? user.avatarId : null;

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);

    try {
      await requestLogout();
    } finally {
      // Tải lại hẳn trang (không dùng router) để bỏ mọi dữ liệu của user cũ còn trong bộ nhớ client.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        {avatarId ? (
          // Avatar lấy qua entry point của Espo (cookie auth-token), không qua next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${classicBasePath}/?entryPoint=avatar&size=small&id=${encodeURIComponent(user.id)}`}
            alt=""
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span
            className="flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: typeof user.avatarColor === "string" ? user.avatarColor : "#2563EB" }}
            aria-hidden
          >
            {initials(displayName)}
          </span>
        )}
        <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 md:block">{displayName}</span>
        <svg viewBox="0 0 24 24" className="hidden size-4 text-slate-400 md:block" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-60 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user.userName}</p>
          </div>
          <a role="menuitem" href={classicHref(`#User/view/${user.id}`)} className={menuItemClass}>
            <i className="fas fa-user w-4 text-center text-slate-400" aria-hidden />
            {t("User", "scopeNames")}
          </a>
          <a role="menuitem" href={classicHref("#Preferences")} className={menuItemClass}>
            <i className="fas fa-sliders-h w-4 text-center text-slate-400" aria-hidden />
            {t("Preferences")}
          </a>
          {isAdmin && (
            <a role="menuitem" href={classicHref("#Admin")} className={menuItemClass}>
              <i className="fas fa-cog w-4 text-center text-slate-400" aria-hidden />
              {t("Administration")}
            </a>
          )}
          <a role="menuitem" href={classicHref("#")} className={menuItemClass}>
            <i className="fas fa-window-maximize w-4 text-center text-slate-400" aria-hidden />
            EspoCRM Classic
          </a>
          <div className="my-1 border-t border-slate-100" />
          <button role="menuitem" type="button" onClick={logout} disabled={loggingOut} className={`${menuItemClass} disabled:opacity-60`}>
            <i className="fas fa-sign-out-alt w-4 text-center text-slate-400" aria-hidden />
            {t("Log Out")}
          </button>
        </div>
      )}
    </div>
  );
}
