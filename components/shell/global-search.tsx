"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useMetadata, useTranslator } from "@/components/providers/app-context";
import { espoGet } from "@/lib/espo/client";
import { recordViewHref } from "@/lib/espo/routes";
import { ScopeIcon } from "./scope-icon";

type SearchResult = { id: string; name?: string | null; _scope: string };

const MIN_LENGTH = 2;
const MAX_SIZE = 10;
const DEBOUNCE_MS = 250;

function useDebounced(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Tìm kiếm chung (`GET GlobalSearch`) trên các entity trong `globalSearchEntityList`. */
export function GlobalSearch() {
  const t = useTranslator();
  const metadata = useMetadata();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = useDebounced(text.trim(), DEBOUNCE_MS);
  const enabled = query.length >= MIN_LENGTH;

  const results = useQuery({
    queryKey: ["globalSearch", query],
    queryFn: ({ signal }) =>
      espoGet<{ list: SearchResult[] }>(`GlobalSearch?q=${encodeURIComponent(query)}&maxSize=${MAX_SIZE}`, { signal }),
    enabled,
    staleTime: 30_000,
  });

  const list = enabled ? (results.data?.list ?? []) : [];
  const showPanel = open && text.trim().length >= MIN_LENGTH;
  const waiting = text.trim() !== query || results.isFetching;

  // Ctrl+K / Cmd+K: nhảy vào ô tìm kiếm.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(result: SearchResult) {
    setOpen(false);
    window.location.assign(recordViewHref(result._scope, result.id, metadata.data));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();

      return;
    }

    if (!list.length) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => {
        const step = event.key === "ArrowDown" ? 1 : -1;

        return (index + step + list.length) % list.length;
      });
    } else if (event.key === "Enter" && activeIndex >= 0 && list[activeIndex]) {
      event.preventDefault();
      go(list[activeIndex]);
    }
  }

  const optionId = (index: number) => `${listId}-option-${index}`;

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-label={t("Global Search")}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          placeholder={t("Search")}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pr-16 pl-9 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/15"
        />
        {!text && (
          <kbd className="pointer-events-none absolute inset-y-0 right-2.5 my-auto hidden h-5 items-center rounded border border-slate-200 bg-white px-1.5 font-sans text-[11px] text-slate-500 sm:flex">
            Ctrl K
          </kbd>
        )}
      </div>

      {showPanel && (
        <div className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <ul id={listId} role="listbox" aria-label={t("Global Search")} className="max-h-96 overflow-y-auto py-1">
            {list.map((result, index) => {
              const clientDefs = metadata.data?.clientDefs?.[result._scope];
              const scopeLabel = t(result._scope, "scopeNames");

              return (
                <li
                  key={`${result._scope}-${result.id}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${
                    index === activeIndex ? "bg-blue-50" : ""
                  }`}
                >
                  <ScopeIcon
                    iconClass={clientDefs?.iconClass ?? null}
                    color={clientDefs?.color ?? null}
                    label={scopeLabel}
                    className="text-slate-500"
                  />
                  <span className="min-w-0 flex-1 truncate text-slate-900">{result.name || result.id}</span>
                  <span className="shrink-0 text-xs text-slate-500">{scopeLabel}</span>
                </li>
              );
            })}
          </ul>
          {!list.length && (
            <p className="px-3 py-3 text-sm text-slate-500">{waiting ? t("Loading...") : t("No Data")}</p>
          )}
        </div>
      )}
    </div>
  );
}
