"use client";

// Bộ lọc nâng cao theo loại field. Cách dựng `where` port từ `fetchSearch()` của `views/fields/*` classic:
// varchar (@21711), enum (@22497), link (@29331), int (@29939), date/datetime (@36383, @45568),
// linkMultiple (@45008), bool (@45911), address (@47850). `data.type` lưu lựa chọn của UI để dựng lại.
import type { AdvancedFilter } from "@/lib/espo/search";
import type { FieldSearchProps } from "./types";
import { Checkbox, Select, TextInput } from "./ui";

const filterType = (filter: AdvancedFilter | null, fallback: string) =>
  (filter?.data?.type as string | undefined) ?? filter?.type ?? fallback;

export function OperatorSelect({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <Select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-auto shrink-0">
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

const VARCHAR_TYPES = ["startsWith", "contains", "equals", "endsWith", "notContains", "notEquals", "isEmpty", "isNotEmpty"];

/** Chuỗi (varchar, text, email, phone, url, personName, foreign…). */
export function textSearchFilter(name: string, type: string, value: string, notStorable = false): AdvancedFilter | null {
  if (type === "isEmpty") {
    return {
      type: "or",
      value: [
        { type: "isNull", attribute: name },
        { type: "equals", attribute: name, value: "" },
      ],
      data: { type },
    };
  }

  if (type === "isNotEmpty") {
    return {
      type: "and",
      value: [
        { type: "isNotNull", attribute: name, value: null },
        ...(notStorable ? [] : [{ type: "notEquals", attribute: name, value: "" }]),
      ],
      data: { type },
    };
  }

  const trimmed = value.trim();

  return trimmed ? { type, value: trimmed, data: { type, value: trimmed } } : null;
}

export function TextSearch({ ctx, scope, name, defs, filter, onChange, inputId }: FieldSearchProps) {
  const type = filterType(filter, "startsWith");
  const value = (filter?.data?.value as string | undefined) ?? (typeof filter?.value === "string" ? filter.value : "");
  const noValue = type === "isEmpty" || type === "isNotEmpty";

  return (
    <div className="flex gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={VARCHAR_TYPES.map((item) => ({ value: item, label: ctx.t.option(item, "varcharSearchRanges") }))}
        onChange={(next) => onChange(textSearchFilter(name, next, value, !!defs.notStorable) ?? { type: next, data: { type: next, value: "", incomplete: true } })}
      />
      {!noValue && (
        <TextInput
          id={inputId}
          value={value}
          onChange={(event) =>
            onChange(textSearchFilter(name, type, event.target.value, !!defs.notStorable) ?? { type, data: { type, value: event.target.value, incomplete: true } })
          }
        />
      )}
    </div>
  );
}

/** Enum: chọn nhiều giá trị (anyOf/noneOf) hoặc rỗng/không rỗng. */
export function enumSearchFilter(name: string, type: string, list: string[], notStorable = false): AdvancedFilter {
  if (type === "isEmpty" || type === "isNotEmpty") {
    return textSearchFilter(name, type, "", notStorable)!;
  }

  if (!list.length) {
    return { type: "any", data: { type, valueList: list } };
  }

  if (type === "noneOf") {
    return {
      type: "or",
      value: [
        { type: "notIn", value: list, attribute: name },
        { type: "isNull", attribute: name },
      ],
      data: { type, valueList: list },
    };
  }

  return { type: "in", value: list, data: { type: "anyOf", valueList: list } };
}

export function OptionListPicker({
  options,
  selected,
  onChange,
  translate,
}: {
  options: string[];
  selected: string[];
  onChange: (list: string[]) => void;
  translate: (value: string) => string;
}) {
  return (
    <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
      {options.map((option) => (
        <Checkbox
          key={option || "(empty)"}
          checked={selected.includes(option)}
          onChange={(event) =>
            onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))
          }
          label={option === "" ? <span className="text-slate-400">—</span> : translate(option)}
        />
      ))}
    </div>
  );
}

export function EnumSearch({ ctx, scope, name, defs, filter, onChange }: FieldSearchProps) {
  const type = filterType(filter, "anyOf");
  const list = (filter?.data?.valueList as string[] | undefined) ?? [];
  const multiple = defs.type === "multiEnum" || defs.type === "array" || defs.type === "checklist";
  const types = multiple ? ["anyOf", "allOf", "noneOf", "isEmpty", "isNotEmpty"] : ["anyOf", "noneOf", "isEmpty", "isNotEmpty"];

  const build = (nextType: string, nextList: string[]): AdvancedFilter => {
    if (!multiple) {
      return enumSearchFilter(name, nextType, nextList, !!defs.notStorable);
    }

    // multiEnum/array: toán tử mảng của Espo.
    const map: Record<string, string> = {
      anyOf: "arrayAnyOf",
      allOf: "arrayAllOf",
      noneOf: "arrayNoneOf",
      isEmpty: "arrayIsEmpty",
      isNotEmpty: "arrayIsNotEmpty",
    };

    if (!nextList.length && ["anyOf", "allOf", "noneOf"].includes(nextType)) {
      return { type: "any", data: { type: nextType, valueList: nextList } };
    }

    return {
      type: map[nextType],
      ...(["isEmpty", "isNotEmpty"].includes(nextType) ? {} : { value: nextList }),
      data: { type: nextType, valueList: nextList },
    };
  };

  return (
    <div className="flex flex-col gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={types.map((item) => ({ value: item, label: ctx.t.option(item, "searchRanges") }))}
        onChange={(next) => onChange(build(next, list))}
      />
      {!["isEmpty", "isNotEmpty"].includes(type) && (
        <OptionListPicker
          options={defs.options ?? []}
          selected={list}
          onChange={(next) => onChange(build(type, next))}
          translate={(value) => ctx.t.option(value, defs.translation ? name : name, scope)}
        />
      )}
    </div>
  );
}

const INT_TYPES = ["equals", "notEquals", "greaterThan", "lessThan", "greaterThanOrEquals", "lessThanOrEquals", "between", "isEmpty", "isNotEmpty"];

/** Số (int, float, currency, autoincrement). Giá trị nhập theo dấu phân cách của người dùng. */
export function NumberSearch({ ctx, scope, name, filter, onChange, inputId }: FieldSearchProps) {
  const type = (filter?.data?.type as string | undefined) ?? filter?.type ?? "equals";
  const value1 = (filter?.data?.value1 as string | undefined) ?? "";
  const value2 = (filter?.data?.value2 as string | undefined) ?? "";

  const parse = (text: string) => {
    const normalized = text
      .split(ctx.numbers.thousandSeparator || "\u0000")
      .join("")
      .replace(ctx.numbers.decimalMark, ".")
      .trim();

    return normalized === "" ? null : Number(normalized);
  };

  const build = (nextType: string, a: string, b: string): AdvancedFilter | null => {
    if (nextType === "isEmpty") {
      return { type: "isNull", data: { type: nextType } };
    }

    if (nextType === "isNotEmpty") {
      return { type: "isNotNull", data: { type: nextType } };
    }

    const first = parse(a);

    if (nextType === "between") {
      const second = parse(b);

      return first !== null && second !== null && !Number.isNaN(first) && !Number.isNaN(second)
        ? { type: nextType, value: [first, second], data: { type: nextType, value1: a, value2: b } }
        : { type: nextType, value: undefined, data: { type: nextType, value1: a, value2: b, incomplete: true } };
    }

    return first !== null && !Number.isNaN(first)
      ? { type: nextType, value: first, data: { type: nextType, value1: a } }
      : { type: nextType, data: { type: nextType, value1: a, incomplete: true } };
  };

  const noValue = type === "isEmpty" || type === "isNotEmpty";

  return (
    <div className="flex flex-wrap gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={INT_TYPES.map((item) => ({ value: item, label: ctx.t.option(item, "intSearchRanges") }))}
        onChange={(next) => onChange(build(next, value1, value2))}
      />
      {!noValue && (
        <TextInput id={inputId} inputMode="decimal" className="w-28 flex-1" value={value1} onChange={(e) => onChange(build(type, e.target.value, value2))} />
      )}
      {type === "between" && (
        <TextInput inputMode="decimal" className="w-28 flex-1" value={value2} onChange={(e) => onChange(build(type, value1, e.target.value))} />
      )}
    </div>
  );
}

export function BoolSearch({ ctx, scope, name, filter, onChange }: FieldSearchProps) {
  const type = filterType(filter, "isTrue");

  const build = (next: string): AdvancedFilter =>
    next === "any"
      ? { type: "or", value: [{ type: "isTrue", attribute: name }, { type: "isFalse", attribute: name }], data: { type: next } }
      : { type: next, data: { type: next } };

  return (
    <OperatorSelect
      label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
      value={type}
      options={[
        { value: "isTrue", label: ctx.t("Yes") },
        { value: "isFalse", label: ctx.t("No") },
        { value: "any", label: ctx.t.option("any", "searchRanges") },
      ]}
      onChange={(next) => onChange(build(next))}
    />
  );
}

const DATE_TYPES = [
  "lastSevenDays",
  "ever",
  "isEmpty",
  "currentMonth",
  "lastMonth",
  "nextMonth",
  "currentQuarter",
  "lastQuarter",
  "currentYear",
  "lastYear",
  "today",
  "past",
  "future",
  "lastXDays",
  "nextXDays",
  "olderThanXDays",
  "afterXDays",
  "on",
  "after",
  "before",
  "between",
];
const DATE_WITH_VALUE = ["on", "notOn", "after", "before"];
const DATE_WITH_NUMBER = ["lastXDays", "nextXDays", "olderThanXDays", "afterXDays"];

/** Ngày (date, datetime, datetimeOptional). Datetime gửi `dateTime: true` để server áp múi giờ. */
export function DateSearch({ ctx, scope, name, defs, filter, onChange, inputId }: FieldSearchProps) {
  const isDateTime = defs.type === "datetime" || defs.type === "datetimeOptional";
  const type = filterType(filter, "lastSevenDays");
  const value = (filter?.data?.value as string | undefined) ?? "";
  const valueTo = (filter?.data?.valueTo as string | undefined) ?? "";
  const flag = isDateTime ? { dateTime: true } : { date: true };

  const build = (nextType: string, a: string, b: string): AdvancedFilter => {
    if (nextType === "between") {
      return a && b
        ? { type: nextType, value: [a, b], ...(isDateTime ? { dateTime: true } : {}), data: { type: nextType, value: a, valueTo: b } }
        : { type: nextType, data: { type: nextType, value: a, valueTo: b, incomplete: true } };
    }

    if (DATE_WITH_VALUE.includes(nextType)) {
      return a
        ? { type: nextType, value: a, ...(isDateTime ? { dateTime: true } : {}), data: { type: nextType, value: a } }
        : { type: nextType, data: { type: nextType, value: a, incomplete: true } };
    }

    if (DATE_WITH_NUMBER.includes(nextType)) {
      return /^\d+$/.test(a)
        ? { type: nextType, value: a, ...flag, data: { type: nextType, value: a } }
        : { type: nextType, data: { type: nextType, value: a, incomplete: true } };
    }

    if (nextType === "isEmpty") {
      return { type: "isNull", data: { type: nextType } };
    }

    return { type: nextType, ...flag, data: { type: nextType } };
  };

  return (
    <div className="flex flex-wrap gap-2">
      <OperatorSelect
        label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
        value={type}
        options={DATE_TYPES.map((item) => ({ value: item, label: ctx.t.option(item, "dateSearchRanges") }))}
        onChange={(next) => onChange(build(next, "", ""))}
      />
      {(DATE_WITH_VALUE.includes(type) || type === "between") && (
        <TextInput id={inputId} type="date" className="w-40 flex-1" value={value} onChange={(e) => onChange(build(type, e.target.value, valueTo))} />
      )}
      {type === "between" && (
        <TextInput type="date" className="w-40 flex-1" value={valueTo} onChange={(e) => onChange(build(type, value, e.target.value))} />
      )}
      {DATE_WITH_NUMBER.includes(type) && (
        <TextInput id={inputId} inputMode="numeric" className="w-24" value={value} onChange={(e) => onChange(build(type, e.target.value, ""))} />
      )}
    </div>
  );
}

/** Địa chỉ: tìm theo đầu chuỗi của mọi phần. */
export function AddressSearch({ name, filter, onChange, inputId }: FieldSearchProps) {
  const value = (filter?.data?.value as string | undefined) ?? "";

  return (
    <TextInput
      id={inputId}
      value={value}
      onChange={(event) => {
        const text = event.target.value;
        const trimmed = text.trim();

        onChange(
          trimmed
            ? {
                type: "or",
                value: ["PostalCode", "Street", "City", "State", "Country"].map((part) => ({
                  type: "like",
                  attribute: name + part,
                  value: `${trimmed}%`,
                })),
                data: { value: text },
              }
            : { type: "or", value: [], data: { value: text, incomplete: true } },
        );
      }}
    />
  );
}
