"use client";

// Ô nhập To/CC/BCC: mỗi địa chỉ là một chip, gõ để gợi ý (`EmailAddress/search`), Enter/dấu phẩy/chấm phẩy
// để thêm, Backspace ở ô trống để xoá chip cuối. Giá trị lưu dạng chuỗi `a@b.c;d@e.f` như classic
// (`views/email/fields/email-address-varchar`); tên hiển thị lấy từ `nameHash`.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { XIcon } from "@/components/fields/ui";
import {
  isValidEmailAddress,
  joinAddresses,
  parseAddressInput,
  searchEmailAddresses,
  splitAddresses,
  type AddressSuggestion,
} from "@/lib/espo/email";

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function AddressInput({
  ctx,
  inputId,
  value,
  nameHash,
  onChange,
  invalid,
  describedBy,
  single = false,
}: {
  ctx: FieldContext;
  inputId: string;
  /** Chuỗi địa chỉ phân cách `;`. */
  value: string;
  nameHash: Record<string, string>;
  /** Giá trị mới + tên của các địa chỉ vừa thêm (gộp vào `nameHash`). */
  onChange: (value: string, names: Record<string, string>) => void;
  invalid?: boolean;
  describedBy?: string;
  /** Chỉ một địa chỉ (From khi lưu email đã có). */
  single?: boolean;
}) {
  const { t } = ctx;
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text.trim());
  const addresses = splitAddresses(value);

  const suggestions = useQuery({
    queryKey: ["emailAddressSearch", query],
    queryFn: ({ signal }) => searchEmailAddresses(query, signal),
    enabled: open && query.length > 0,
    staleTime: 30_000,
  });
  const options = (suggestions.data ?? []).filter(
    (item) => !addresses.some((address) => address.toLowerCase() === item.emailAddress.toLowerCase()),
  );

  function add(items: { address: string; name: string | null }[]) {
    const names: Record<string, string> = {};
    const next = single ? [] : [...addresses];

    for (const item of items) {
      if (!next.some((address) => address.toLowerCase() === item.address.toLowerCase())) {
        next.push(item.address);
      }

      if (item.name) {
        names[item.address] = item.name;
      }
    }

    onChange(joinAddresses(single ? next.slice(-1) : next), names);
    setText("");
    setActive(0);
  }

  function choose(option: AddressSuggestion) {
    add([{ address: option.emailAddress, name: option.name ?? null }]);
    setOpen(false);
  }

  function commitText() {
    const items = parseAddressInput(text);

    if (items.length) {
      add(items);
    }
  }

  return (
    <div className="relative">
      <div
        className={`flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1 shadow-xs focus-within:ring-4 ${
          invalid ? "border-red-500 focus-within:ring-red-500/15" : "border-slate-300 focus-within:border-blue-600 focus-within:ring-blue-600/15"
        }`}
      >
        {addresses.map((address) => {
          const valid = isValidEmailAddress(address);
          const name = nameHash[address];

          return (
            <span
              key={address}
              title={address}
              className={`inline-flex max-w-full items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-sm ${
                valid ? "bg-slate-100 text-slate-800" : "bg-red-50 text-red-700 ring-1 ring-red-600/20 ring-inset"
              }`}
            >
              <span className="truncate">{name ? `${name} <${address}>` : address}</span>
              <button
                type="button"
                aria-label={`${t("Remove")} ${address}`}
                onClick={() => onChange(joinAddresses(addresses.filter((item) => item !== address)), {})}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <XIcon />
              </button>
            </span>
          );
        })}
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={text}
          onChange={(event) => {
            const next = event.target.value;

            // Dán/gõ dấu phân cách → thêm ngay phần đã gõ.
            if (/[;,]\s*$/.test(next)) {
              setText(next);
              add(parseAddressInput(next));

              return;
            }

            setText(next);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
            commitText();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) => (options.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : 0));
            } else if (event.key === "Enter") {
              if (open && options[active]) {
                event.preventDefault();
                choose(options[active]);
              } else if (text.trim()) {
                event.preventDefault();
                commitText();
              }
            } else if (event.key === "Backspace" && !text && addresses.length) {
              onChange(joinAddresses(addresses.slice(0, -1)), {});
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className="h-7 min-w-32 flex-1 border-0 bg-transparent px-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
      </div>
      {open && options.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={`${option.emailAddress}-${option.entityId ?? index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
              className={`cursor-pointer px-3 py-1.5 text-sm ${index === active ? "bg-blue-50 text-blue-900" : "text-slate-800"}`}
            >
              <span className="font-medium">{option.name || option.emailAddress}</span>
              {option.name && <span className="ml-2 text-slate-500">{option.emailAddress}</span>}
              {option.entityType && <span className="ml-2 text-xs text-slate-400">{t(option.entityType, "scopeNames")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Hiển thị danh sách địa chỉ: tên (link tới bản ghi nếu biết) + địa chỉ, như `getDetailAddressHtml`. */
export function AddressList({
  value,
  nameHash,
  typeHash,
  idHash,
  renderLink,
}: {
  value: unknown;
  nameHash: Record<string, string>;
  typeHash: Record<string, string>;
  idHash: Record<string, string>;
  renderLink: (scope: string, id: string, name: string) => React.ReactNode;
}) {
  const addresses = splitAddresses(value);

  if (!addresses.length) {
    return null;
  }

  return (
    <span className="flex flex-col gap-0.5">
      {addresses.map((address) => {
        const name = nameHash[address];
        const scope = typeHash[address];
        const id = idHash[address];

        return (
          <span key={address} className="break-all">
            {name ? (
              <>
                {scope && id ? renderLink(scope, id, name) : <span className="font-medium text-slate-800">{name}</span>}
                <span className="ml-1.5 text-slate-500">&lt;{address}&gt;</span>
              </>
            ) : (
              address
            )}
          </span>
        );
      })}
    </span>
  );
}
