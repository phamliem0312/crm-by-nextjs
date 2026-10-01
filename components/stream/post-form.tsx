"use client";

// Ô viết post của Stream: Markdown, gợi ý `@username` (quyền `mention`), đính kèm, ghi chú nội bộ, Ctrl+Enter để đăng.
// Port từ `views/stream/panel` (post) + `views/note/fields/post` (textcomplete) của classic.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { attachmentMultipleField } from "@/components/fields/extra";
import type { FieldContext, Values } from "@/components/fields/types";
import { inputClass } from "@/components/fields/ui";
import { Button } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { listRecords } from "@/lib/espo/records";

const AttachmentsEdit = attachmentMultipleField.Edit!;

const MENTION_PATTERN = /(^|\s)@(\w[\w@.-]*)$/;

function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/** Từ khoá `@…` ngay trước con trỏ (null nếu không gõ mention). */
export function mentionTerm(text: string, caret: number): string | null {
  const match = MENTION_PATTERN.exec(text.slice(0, caret));

  return match ? match[2] : null;
}

export function PostForm({
  ctx,
  placeholder,
  allowInternal = false,
  storageKey,
  onSubmit,
  value,
  onValueChange,
  extra,
}: {
  ctx: FieldContext;
  placeholder: string;
  allowInternal?: boolean;
  /** Giữ bản nháp trong sessionStorage (như classic) theo key này. */
  storageKey?: string;
  onSubmit: (data: { post: string | null; attachmentsIds: string[]; isInternal: boolean }) => Promise<boolean>;
  /** Điều khiển nội dung từ ngoài (trích dẫn trả lời). */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Phần chọn đối tượng nhận (stream người dùng). */
  extra?: React.ReactNode;
}) {
  const { t } = ctx;
  const inputId = useId();
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [ownText, setOwnText] = useState(() => {
    try {
      return (storageKey && sessionStorage.getItem(storageKey)) || "";
    } catch {
      return "";
    }
  });
  const text = value ?? ownText;
  const setText = (next: string) => {
    onValueChange?.(next);

    if (value === undefined) {
      setOwnText(next);
    }

    try {
      if (storageKey) {
        if (next) {
          sessionStorage.setItem(storageKey, next);
        } else {
          sessionStorage.removeItem(storageKey);
        }
      }
    } catch {
      // Không lưu được nháp (chế độ riêng tư) thì thôi.
    }
  };
  const [attachments, setAttachments] = useState<Values>({});
  const [internal, setInternal] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [term, setTerm] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const debouncedTerm = useDebounced(term);
  const mentionLevel = ctx.acl.getPermissionLevel("mention");
  const attachmentIds = (attachments.attachmentsIds as string[] | undefined) ?? [];
  const expanded = focused || !!text || attachmentIds.length > 0;

  const users = useQuery({
    queryKey: ["mentionUsers", debouncedTerm, mentionLevel],
    queryFn: ({ signal }) =>
      listRecords(
        "User",
        {
          select: ["id", "name", "userName"],
          maxSize: 7,
          orderBy: "name",
          order: "asc",
          textFilter: debouncedTerm ?? "",
          primaryFilter: "active",
          ...(mentionLevel === "team" ? { boolFilterList: ["onlyMyTeam"] } : {}),
        },
        signal,
      ),
    enabled: !!debouncedTerm && mentionLevel !== "no",
    staleTime: 60_000,
  });

  const options = term ? (users.data?.list ?? []) : [];

  // Khi nội dung được đặt từ ngoài (trích dẫn), focus và đưa con trỏ về cuối.
  useEffect(() => {
    if (value !== undefined && value && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(value.length, value.length);
    }
  }, [value]);

  function insertMention(userName: string) {
    const element = ref.current;
    const caret = element?.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(MENTION_PATTERN, `$1@${userName} `);
    const next = before + text.slice(caret);

    setText(next);
    setTerm(null);
    window.setTimeout(() => {
      element?.focus();
      element?.setSelectionRange(before.length, before.length);
    }, 0);
  }

  async function submit() {
    if (!text.trim() && !attachmentIds.length) {
      toast.errorText(t("Post cannot be empty"));

      return;
    }

    setBusy(true);

    try {
      const ok = await onSubmit({ post: text.trim() ? text : null, attachmentsIds: attachmentIds, isInternal: internal });

      if (ok) {
        setText("");
        setAttachments({});
        setInternal(false);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <textarea
          ref={ref}
          id={inputId}
          value={text}
          rows={expanded ? 3 : 1}
          placeholder={placeholder}
          disabled={busy}
          role="combobox"
          aria-expanded={options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
          className={inputClass(false, "min-h-9 resize-y px-3 py-2 leading-5")}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setTerm(null), 150)}
          onChange={(event) => {
            setText(event.target.value);
            setTerm(mentionLevel === "no" ? null : mentionTerm(event.target.value, event.target.selectionStart));
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (options.length && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              setActive((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);

              return;
            }

            if (options.length && (event.key === "Enter" || event.key === "Tab") && !event.ctrlKey) {
              event.preventDefault();
              insertMention(String(options[active].userName ?? ""));

              return;
            }

            if (event.key === "Escape" && term) {
              setTerm(null);

              return;
            }

            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        {options.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {options.map((user, index) => (
              <li
                key={user.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => insertMention(String(user.userName ?? ""))}
                className={`flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-sm ${index === active ? "bg-blue-50 text-blue-900" : "text-slate-800"}`}
              >
                <span className="truncate">{String(user.name ?? "")}</span>
                <span className="text-xs text-slate-400">@{String(user.userName ?? "")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {expanded && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <AttachmentsEdit
              ctx={ctx}
              scope="Note"
              name="attachments"
              defs={{ type: "attachmentMultiple" }}
              values={attachments}
              onChange={(patch) => setAttachments({ ...attachments, ...patch })}
              inputId={`${inputId}-attachments`}
              invalid={false}
              required={false}
            />
            {extra}
          </div>
          <div className="flex items-center gap-2">
            {allowInternal && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-slate-600">
                <input type="checkbox" className="size-4 accent-blue-600" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                <i className="fas fa-lock text-xs text-slate-400" aria-hidden />
                {t("isInternal", "fields", "Note").replace(/\s*\(.*\)$/, "")}
              </label>
            )}
            <Button variant="primary" onClick={() => void submit()} disabled={busy || (!text.trim() && !attachmentIds.length)} title="Ctrl+Enter">
              {busy && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
              {t("Post")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
