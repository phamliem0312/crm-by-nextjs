"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useAcl, useAppUser, useMetadata, useTranslator } from "@/components/providers/app-context";
import { scopeListHref } from "@/lib/espo/routes";
import { buildNavTabs, type NavEntry } from "@/lib/espo/tabs";
import { ScopeIcon } from "./scope-icon";

const MORE_OPEN_KEY = "espo-next-nav-more-open";

function readMoreOpen(): boolean {
  try {
    return localStorage.getItem(MORE_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function isActive(href: string, pathname: string): boolean {
  if (href.startsWith("/classic") || !href.startsWith("/")) {
    return false;
  }

  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const itemClass = (active: boolean) =>
  `group flex h-9 items-center gap-3 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
    active ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
  }`;

function EntryLink({ entry, onNavigate }: { entry: NavEntry & { href: string }; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isActive(entry.href, pathname);
  const content = (
    <>
      <ScopeIcon
        iconClass={entry.iconClass}
        color={active ? null : entry.color}
        label={entry.label}
        className={active ? "text-white" : "text-slate-400 group-hover:text-slate-200"}
      />
      <span className="truncate">{entry.label}</span>
      {entry.kind === "url" && entry.openInNewTab && (
        <svg viewBox="0 0 24 24" className="ml-auto size-3.5 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );

  // Link sang UI classic (/classic) và URL tab là điều hướng thường; trang của UI mới dùng next/link.
  if (entry.href.startsWith("/") && !entry.href.startsWith("/classic")) {
    return (
      <Link href={entry.href} className={itemClass(active)} aria-current={active ? "page" : undefined} onClick={onNavigate}>
        {content}
      </Link>
    );
  }

  return (
    <a
      href={entry.href}
      className={itemClass(false)}
      target={entry.kind === "url" && entry.openInNewTab ? "_blank" : undefined}
      rel={entry.kind === "url" && entry.openInNewTab ? "noopener noreferrer" : undefined}
      onClick={onNavigate}
    >
      {content}
    </a>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`ml-auto size-4 text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GroupEntry({ entry, onNavigate }: { entry: Extract<NavEntry, { kind: "group" }>; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <li>
      <button type="button" className={`${itemClass(false)} w-full`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ScopeIcon iconClass={entry.iconClass} color={entry.color} label={entry.label} className="text-slate-400" />
        <span className="truncate">{entry.label}</span>
        <Chevron open={open} />
      </button>
      {open && <EntryList entries={entry.items} onNavigate={onNavigate} nested />}
    </li>
  );
}

function EntryList({ entries, onNavigate, nested = false }: { entries: NavEntry[]; onNavigate?: () => void; nested?: boolean }) {
  return (
    <ul className={`flex flex-col gap-0.5 ${nested ? "mt-0.5 ml-4 border-l border-white/10 pl-2" : ""}`}>
      {entries.map((entry) => {
        if (entry.kind === "divider") {
          return (
            <li key={entry.key} className="px-2.5 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-slate-500 uppercase first:pt-1">
              {entry.label || <span className="block h-px bg-white/10" />}
            </li>
          );
        }

        if (entry.kind === "group") {
          return <GroupEntry key={entry.key} entry={entry} onNavigate={onNavigate} />;
        }

        return (
          <li key={entry.key}>
            <EntryLink entry={entry} onNavigate={onNavigate} />
          </li>
        );
      })}
    </ul>
  );
}

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2.5" aria-hidden>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex h-9 items-center gap-3">
          <div className="size-5 rounded bg-white/10" />
          <div className="h-2.5 rounded bg-white/10" style={{ width: `${40 + ((i * 17) % 45)}%` }} />
        </div>
      ))}
    </div>
  );
}

function Section({ label, children, defaultOpen }: { label: string; children: ReactNode; defaultOpen: () => boolean }) {
  // Chỉ render sau khi Metadata tải xong ở trình duyệt (server luôn hiện skeleton), nên đọc localStorage ở đây
  // không gây lệch hydration.
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    const value = !open;

    setOpen(value);

    try {
      localStorage.setItem(MORE_OPEN_KEY, value ? "1" : "0");
    } catch {
      // Bỏ qua khi localStorage bị chặn.
    }
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <button type="button" className={`${itemClass(false)} w-full`} aria-expanded={open} onClick={toggle}>
        <span className="inline-flex size-5 items-center justify-center text-slate-400" aria-hidden>
          <i className="fas fa-ellipsis-h" />
        </span>
        <span>{label}</span>
        <Chevron open={open} />
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

/** Menu bên: tabList của settings/preferences, lọc theo quyền, icon từ clientDefs. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { settings, preferences, user } = useAppUser();
  const acl = useAcl();
  const t = useTranslator();
  const metadata = useMetadata();
  const [showHidden, setShowHidden] = useState(false);

  const tabs = useMemo(
    () =>
      metadata.data
        ? buildNavTabs({ settings, preferences, user, acl, metadata: metadata.data, t, scopeHref: scopeListHref })
        : null,
    [metadata.data, settings, preferences, user, acl, t],
  );

  if (!tabs) {
    return <NavSkeleton />;
  }

  const home: NavEntry = { kind: "home", key: "home", label: t("Home"), href: "/", iconClass: "fas fa-house", color: null };

  return (
    <nav aria-label={t("Menu")}>
      <EntryList entries={[home, ...tabs.main]} onNavigate={onNavigate} />
      {(tabs.more.length > 0 || tabs.moreHidden.length > 0) && (
        <Section label={t("More")} defaultOpen={readMoreOpen}>
          <EntryList entries={tabs.more} onNavigate={onNavigate} />
          {tabs.moreHidden.length > 0 &&
            (showHidden ? (
              <div className="mt-0.5">
                <EntryList entries={tabs.moreHidden} onNavigate={onNavigate} />
              </div>
            ) : (
              <button type="button" className={`${itemClass(false)} w-full text-slate-400`} onClick={() => setShowHidden(true)}>
                <span className="size-5" aria-hidden />
                {t("Show more")}
              </button>
            ))}
        </Section>
      )}
    </nav>
  );
}
