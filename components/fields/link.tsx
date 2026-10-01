"use client";

// Field liên kết: link, linkOne, linkMultiple, linkParent. Port hành vi từ `views/fields/link`,
// `link-multiple`, `link-parent` của UI classic; chọn bản ghi bằng ô gợi ý (autocomplete) thay cho modal.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { getLinkEntity } from "@/lib/espo/entity";
import { listRecords } from "@/lib/espo/records";
import { recordViewHref } from "@/lib/espo/routes";
import type { AdvancedFilter } from "@/lib/espo/search";
import { OperatorSelect } from "./search-ui";
import type { FieldContext, FieldDisplayProps, FieldEditProps, FieldSearchProps, FieldType } from "./types";
import { IconButton, Select, TextInput, XIcon } from "./ui";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

export type Option = { id: string; name: string };

function foreignScopeOf(ctx: FieldContext, scope: string, name: string): string | undefined {
  return getLinkEntity(ctx.metadata, scope, name);
}

export function RecordLink({ ctx, scope, id, name }: { ctx: FieldContext; scope: string | undefined; id: string; name: string }) {
  if (!scope) {
    return <span>{name || id}</span>;
  }

  return (
    <a href={recordViewHref(scope, id, ctx.metadata)} className="text-blue-600 hover:underline">
      {name || id}
    </a>
  );
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);

    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Ô chọn bản ghi có gợi ý: gõ để tìm (`textFilter`), mũi tên để chọn, Enter để xác nhận.
 * `exclude`: id đã chọn (linkMultiple) để không gợi ý lại.
 */
export function RecordPicker({
  ctx,
  foreignScope,
  onSelect,
  inputId,
  invalid,
  exclude = [],
  placeholder,
  describedBy,
}: {
  ctx: FieldContext;
  foreignScope: string;
  onSelect: (option: Option) => void;
  inputId?: string;
  invalid?: boolean;
  exclude?: string[];
  placeholder?: string;
  describedBy?: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = useDebounced(text.trim());
  const canRead = ctx.acl.checkScope(foreignScope, "read");

  const results = useQuery({
    queryKey: ["recordPicker", foreignScope, query],
    queryFn: ({ signal }) =>
      listRecords(
        foreignScope,
        { select: ["id", "name"], maxSize: 10, orderBy: "name", order: "asc", ...(query ? { textFilter: query } : {}) },
        signal,
      ),
    enabled: open && canRead,
    staleTime: 30_000,
  });

  const options = (results.data?.list ?? [])
    .map((record) => ({ id: record.id, name: str(record.name) || record.id }))
    .filter((option) => !exclude.includes(option.id));

  function choose(option: Option) {
    onSelect(option);
    setText("");
    setOpen(false);
  }

  return (
    <div className="relative w-full">
      <TextInput
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-describedby={describedBy}
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        invalid={invalid}
        disabled={!canRead}
        placeholder={placeholder ?? ctx.t("Select")}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => (options.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : 0));
          } else if (event.key === "Enter" && open && options[active]) {
            event.preventDefault();
            choose(options[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
              className={`cursor-pointer truncate px-3 py-1.5 text-sm ${index === active ? "bg-blue-50 text-blue-900" : "text-slate-800"}`}
            >
              {option.name}
            </li>
          ))}
          {!options.length && (
            <li className="px-3 py-2 text-sm text-slate-500">{results.isFetching ? ctx.t("Loading...") : ctx.t("No Data")}</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ——— link / linkOne ———

function LinkDisplay({ ctx, scope, name, values }: FieldDisplayProps) {
  const id = str(values[`${name}Id`]);

  return id ? <RecordLink ctx={ctx} scope={foreignScopeOf(ctx, scope, name)} id={id} name={str(values[`${name}Name`])} /> : null;
}

function LinkEdit({ ctx, scope, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const foreignScope = foreignScopeOf(ctx, scope, name);
  const id = str(values[`${name}Id`]);

  if (!foreignScope) {
    return <LinkDisplay ctx={ctx} scope={scope} name={name} values={values} defs={{ type: "link" }} mode="detail" />;
  }

  if (id) {
    return (
      <div className="flex h-9 max-w-md items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 pr-1 pl-3 text-sm">
        <span className="min-w-0 flex-1 truncate">{str(values[`${name}Name`]) || id}</span>
        <IconButton label={ctx.t("Remove")} onClick={() => onChange({ [`${name}Id`]: null, [`${name}Name`]: null })}>
          <XIcon />
        </IconButton>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <RecordPicker
        ctx={ctx}
        foreignScope={foreignScope}
        inputId={inputId}
        invalid={invalid}
        describedBy={describedBy}
        onSelect={(option) => onChange({ [`${name}Id`]: option.id, [`${name}Name`]: option.name })}
      />
    </div>
  );
}

/** Chọn nhiều bản ghi (dạng chip). */
export function MultiPicker({
  ctx,
  foreignScope,
  selected,
  onChange,
  inputId,
  invalid,
  describedBy,
}: {
  ctx: FieldContext;
  foreignScope: string;
  selected: Option[];
  onChange: (next: Option[]) => void;
  inputId?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2">
      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li key={option.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 py-0.5 pr-0.5 pl-2 text-sm text-slate-800">
              <span className="max-w-48 truncate">{option.name}</span>
              <button
                type="button"
                aria-label={`${ctx.t("Remove")} ${option.name}`}
                onClick={() => onChange(selected.filter((item) => item.id !== option.id))}
                className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              >
                <XIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
      <RecordPicker
        ctx={ctx}
        foreignScope={foreignScope}
        inputId={inputId}
        invalid={invalid}
        describedBy={describedBy}
        exclude={selected.map((item) => item.id)}
        onSelect={(option) => onChange([...selected, option])}
      />
    </div>
  );
}

function LinkSearch({ ctx, scope, name, filter, onChange, inputId }: FieldSearchProps) {
  const foreignScope = foreignScopeOf(ctx, scope, name);
  const type = (filter?.data?.type as string | undefined) ?? "is";
  const idName = `${name}Id`;
  const oneOf = ((filter?.data?.oneOf as Option[] | undefined) ?? []) as Option[];
  const single = filter?.data?.option as Option | undefined;

  const build = (nextType: string, option: Option | undefined, list: Option[]): AdvancedFilter => {
    const data = { type: nextType, option, oneOf: list };

    switch (nextType) {
      case "isEmpty":
        return { type: "isNull", attribute: idName, data };
      case "isNotEmpty":
        return { type: "isNotNull", attribute: idName, data };
      case "is":
        return option ? { type: "equals", attribute: idName, value: option.id, data } : { type: "equals", data: { ...data, incomplete: true } };
      case "isNot":
        return option
          ? {
              type: "or",
              value: [
                { type: "notEquals", attribute: idName, value: option.id },
                { type: "isNull", attribute: idName },
              ],
              data,
            }
          : { type: "or", data: { ...data, incomplete: true } };
      case "isOneOf":
        return list.length
          ? { type: "in", attribute: idName, value: list.map((item) => item.id), data }
          : { type: "isNotNull", attribute: "id", data };
      default:
        return list.length
          ? {
              type: "or",
              value: [
                { type: "notIn", attribute: idName, value: list.map((item) => item.id) },
                { type: "isNull", attribute: idName },
              ],
              data,
            }
          : { type: "isNotNull", attribute: "id", data };
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={["is", "isNot", "isOneOf", "isNotOneOf", "isEmpty", "isNotEmpty"].map((item) => ({
          value: item,
          label: ctx.t.option(item, "searchRanges"),
        }))}
        onChange={(next) => onChange(build(next, single, oneOf))}
      />
      {foreignScope && (type === "is" || type === "isNot") && (
        single ? (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 pr-1 pl-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{single.name}</span>
            <IconButton label={ctx.t("Remove")} onClick={() => onChange(build(type, undefined, oneOf))}>
              <XIcon />
            </IconButton>
          </div>
        ) : (
          <RecordPicker ctx={ctx} foreignScope={foreignScope} inputId={inputId} onSelect={(option) => onChange(build(type, option, oneOf))} />
        )
      )}
      {foreignScope && (type === "isOneOf" || type === "isNotOneOf") && (
        <MultiPicker ctx={ctx} foreignScope={foreignScope} selected={oneOf} inputId={inputId} onChange={(list) => onChange(build(type, single, list))} />
      )}
    </div>
  );
}

export const linkField: FieldType = {
  Display: LinkDisplay,
  Edit: LinkEdit,
  Search: LinkSearch,
  hasValue: (name, values) => !!values[`${name}Id`],
};

// ——— linkMultiple ———

export function selectedOptions(name: string, values: Record<string, unknown>): Option[] {
  const ids = Array.isArray(values[`${name}Ids`]) ? (values[`${name}Ids`] as string[]) : [];
  const names = (values[`${name}Names`] ?? {}) as Record<string, string>;

  return ids.map((id) => ({ id, name: names[id] ?? id }));
}

function LinkMultipleDisplay({ ctx, scope, name, values, mode }: FieldDisplayProps) {
  const list = selectedOptions(name, values);
  const foreignScope = foreignScopeOf(ctx, scope, name);

  if (!list.length) {
    return null;
  }

  return (
    <span className={mode === "list" ? "line-clamp-2" : "flex flex-col gap-0.5"}>
      {list.map((item, index) => (
        <span key={item.id}>
          <RecordLink ctx={ctx} scope={foreignScope} id={item.id} name={item.name} />
          {mode === "list" && index < list.length - 1 ? ", " : ""}
        </span>
      ))}
    </span>
  );
}

function LinkMultipleEdit({ ctx, scope, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const foreignScope = foreignScopeOf(ctx, scope, name);

  if (!foreignScope) {
    return null;
  }

  return (
    <MultiPicker
      ctx={ctx}
      foreignScope={foreignScope}
      selected={selectedOptions(name, values)}
      inputId={inputId}
      invalid={invalid}
      describedBy={describedBy}
      onChange={(list) =>
        onChange({
          [`${name}Ids`]: list.map((item) => item.id),
          [`${name}Names`]: Object.fromEntries(list.map((item) => [item.id, item.name])),
        })
      }
    />
  );
}

function LinkMultipleSearch({ ctx, scope, name, filter, onChange, inputId }: FieldSearchProps) {
  const foreignScope = foreignScopeOf(ctx, scope, name);
  const type = (filter?.data?.type as string | undefined) ?? "anyOf";
  const list = ((filter?.data?.list as Option[] | undefined) ?? []) as Option[];
  const map: Record<string, string> = { anyOf: "linkedWith", allOf: "linkedWithAll", noneOf: "notLinkedWith" };

  const build = (nextType: string, next: Option[]): AdvancedFilter => {
    const data = { type: nextType, list: next };

    if (nextType === "isEmpty") {
      return { type: "isNotLinked", data };
    }

    if (nextType === "isNotEmpty") {
      return { type: "isLinked", data };
    }

    return next.length
      ? { type: map[nextType], value: next.map((item) => item.id), data }
      : { type: "isNotNull", attribute: "id", data };
  };

  return (
    <div className="flex flex-col gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={["anyOf", "allOf", "noneOf", "isEmpty", "isNotEmpty"].map((item) => ({ value: item, label: ctx.t.option(item, "searchRanges") }))}
        onChange={(next) => onChange(build(next, list))}
      />
      {foreignScope && !["isEmpty", "isNotEmpty"].includes(type) && (
        <MultiPicker ctx={ctx} foreignScope={foreignScope} selected={list} inputId={inputId} onChange={(next) => onChange(build(type, next))} />
      )}
    </div>
  );
}

export const linkMultipleField: FieldType = {
  Display: LinkMultipleDisplay,
  Edit: LinkMultipleEdit,
  Search: LinkMultipleSearch,
  hasValue: (name, values) => Array.isArray(values[`${name}Ids`]) && (values[`${name}Ids`] as unknown[]).length > 0,
};

// ——— linkParent ———

function LinkParentDisplay({ ctx, name, values }: FieldDisplayProps) {
  const id = str(values[`${name}Id`]);
  const type = str(values[`${name}Type`]);

  if (!id || !type) {
    return null;
  }

  return (
    <span>
      <span className="mr-1.5 text-slate-500">{ctx.t(type, "scopeNames")}</span>
      <RecordLink ctx={ctx} scope={type} id={id} name={str(values[`${name}Name`])} />
    </span>
  );
}

function LinkParentEdit({ ctx, name, defs, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const entityList = (defs.entityList ?? []).filter((scope) => ctx.acl.checkScope(scope, "read"));
  const type = str(values[`${name}Type`]) || entityList[0] || "";
  const id = str(values[`${name}Id`]);

  return (
    <div className="flex max-w-lg gap-2">
      <Select
        aria-label={ctx.t(`${name}Type`, "fields")}
        className="w-40 shrink-0"
        value={type}
        onChange={(event) => onChange({ [`${name}Type`]: event.target.value, [`${name}Id`]: null, [`${name}Name`]: null })}
      >
        {entityList.map((scope) => (
          <option key={scope} value={scope}>
            {ctx.t(scope, "scopeNames")}
          </option>
        ))}
      </Select>
      {id ? (
        <div className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 pr-1 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate">{str(values[`${name}Name`]) || id}</span>
          <IconButton label={ctx.t("Remove")} onClick={() => onChange({ [`${name}Id`]: null, [`${name}Name`]: null })}>
            <XIcon />
          </IconButton>
        </div>
      ) : type ? (
        <RecordPicker
          key={type}
          ctx={ctx}
          foreignScope={type}
          inputId={inputId}
          invalid={invalid}
          describedBy={describedBy}
          onSelect={(option) => onChange({ [`${name}Type`]: type, [`${name}Id`]: option.id, [`${name}Name`]: option.name })}
        />
      ) : null}
    </div>
  );
}

export const linkParentField: FieldType = {
  Display: LinkParentDisplay,
  Edit: LinkParentEdit,
  hasValue: (name, values) => !!values[`${name}Id`],
};
