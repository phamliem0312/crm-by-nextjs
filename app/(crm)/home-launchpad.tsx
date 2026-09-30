"use client";

import { useMemo } from "react";
import { useAcl, useAppUser, useMetadata, useTranslator } from "@/components/providers/app-context";
import { ScopeIcon } from "@/components/shell/scope-icon";
import { classicHref, scopeListHref } from "@/lib/espo/routes";
import { buildNavTabs, type NavEntry } from "@/lib/espo/tabs";

/** Các mục có link (bỏ divider, mở group ra). */
function flatten(entries: NavEntry[]): Exclude<NavEntry, { kind: "divider" | "group" }>[] {
  return entries.flatMap((entry) => {
    if (entry.kind === "divider") {
      return [];
    }

    return entry.kind === "group" ? flatten(entry.items) : [entry];
  });
}

export function HomeLaunchpad() {
  const { settings, preferences, user } = useAppUser();
  const acl = useAcl();
  const t = useTranslator();
  const metadata = useMetadata();

  const entries = useMemo(() => {
    if (!metadata.data) {
      return null;
    }

    const tabs = buildNavTabs({
      settings,
      preferences,
      user,
      acl,
      metadata: metadata.data,
      t,
      scopeHref: (scope) => scopeListHref(scope, metadata.data),
    });

    return flatten([...tabs.main, ...tabs.more]);
  }, [metadata.data, settings, preferences, user, acl, t]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Home")}</h1>
          <p className="mt-1 text-sm text-slate-500">{user.name || user.userName}</p>
        </div>
        <a
          href={classicHref("#")}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <i className="fas fa-th-large text-slate-400" aria-hidden />
          EspoCRM Classic
        </a>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {entries === null
          ? Array.from({ length: 10 }, (_, i) => (
              <li key={i} className="h-[88px] animate-pulse rounded-xl border border-slate-200 bg-white" aria-hidden />
            ))
          : entries.map((entry) => (
              <li key={entry.key}>
                <a
                  href={entry.href}
                  target={entry.kind === "url" && entry.openInNewTab ? "_blank" : undefined}
                  rel={entry.kind === "url" && entry.openInNewTab ? "noopener noreferrer" : undefined}
                  className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <ScopeIcon iconClass={entry.iconClass} color={entry.color} label={entry.label} />
                  </span>
                  <span className="truncate text-sm font-medium text-slate-800">{entry.label}</span>
                </a>
              </li>
            ))}
      </ul>
    </div>
  );
}
