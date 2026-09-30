"use client";

// Field cơ bản: chuỗi, số, tiền tệ, bool, enum, mảng, ngày giờ, foreign.
// Hành vi port từ `views/fields/*` của UI classic (varchar, text, url, int, float, currency, bool, enum,
// multi-enum, array, date, datetime, datetime-optional, foreign).
import dayjs from "@/lib/espo/dayjs";
import { useState } from "react";
import { formatCurrency } from "@/lib/espo/field-format";
import { getLinkEntity, type FieldDefs } from "@/lib/espo/entity";
import { BoolSearch, DateSearch, EnumSearch, NumberSearch, TextSearch } from "./search-ui";
import type { FieldContext, FieldDisplayProps, FieldEditProps, FieldType, Values } from "./types";
import { Badge, Checkbox, Select, TextArea, TextInput } from "./ui";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));

// ——— Chuỗi ———

function VarcharDisplay({ name, values }: FieldDisplayProps) {
  const value = str(values[name]);

  return value ? <span className="break-words">{value}</span> : null;
}

function VarcharEdit({ name, defs, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  const listId = `${inputId}-options`;

  return (
    <>
      <TextInput
        id={inputId}
        value={str(values[name])}
        maxLength={typeof defs.maxLength === "number" ? defs.maxLength : undefined}
        list={defs.options?.length ? listId : undefined}
        invalid={invalid}
        required={required}
        aria-describedby={describedBy}
        onChange={(event) => onChange({ [name]: event.target.value })}
      />
      {defs.options?.length ? (
        <datalist id={listId}>
          {defs.options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      ) : null}
    </>
  );
}

export const varcharField: FieldType = { Display: VarcharDisplay, Edit: VarcharEdit, Search: TextSearch };

function TextDisplay({ name, values, mode }: FieldDisplayProps) {
  const value = str(values[name]);

  if (!value) {
    return null;
  }

  // Hiển thị văn bản thô (giữ xuống dòng). Classic render Markdown; để sau khi có sanitize (DOMPurify).
  return mode === "list" ? (
    <span className="line-clamp-2 break-words">{value}</span>
  ) : (
    <span className="break-words whitespace-pre-wrap">{value}</span>
  );
}

function TextEdit({ name, defs, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  return (
    <TextArea
      id={inputId}
      value={str(values[name])}
      rows={typeof defs.rows === "number" ? Math.min(defs.rows, 12) : 4}
      maxLength={typeof defs.maxLength === "number" ? defs.maxLength : undefined}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      onChange={(event) => onChange({ [name]: event.target.value })}
    />
  );
}

export const textField: FieldType = { Display: TextDisplay, Edit: TextEdit, Search: TextSearch, wide: true };

/** Thêm `https://` nếu URL không có giao thức (giống classic). Chỉ cho http(s)/ftp/mailto để tránh `javascript:`. */
export function toHref(url: string): string | null {
  const value = url.trim();

  if (!value) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return /^(https?|ftp|mailto):/i.test(value) ? value : null;
  }

  return `https://${value}`;
}

function UrlDisplay({ name, values }: FieldDisplayProps) {
  const value = str(values[name]);
  const href = toHref(value);

  if (!value) {
    return null;
  }

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:underline">
      {value}
    </a>
  ) : (
    <span className="break-all">{value}</span>
  );
}

function UrlEdit(props: FieldEditProps) {
  return <VarcharEdit {...props} />;
}

export const urlField: FieldType = { Display: UrlDisplay, Edit: UrlEdit, Search: TextSearch };

// ——— Số ———

/** Chuỗi người dùng nhập (theo dấu phân cách của họ) → số; rỗng → null; sai → giữ chuỗi để validate báo lỗi. */
function parseNumber(text: string, ctx: FieldContext, integer: boolean): number | string | null {
  const normalized = text
    .split(ctx.numbers.thousandSeparator || "\u0000")
    .join("")
    .replace(ctx.numbers.decimalMark, ".")
    .trim();

  if (normalized === "") {
    return null;
  }

  const value = Number(normalized);

  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    return text;
  }

  return value;
}

function formatNumberValue(value: unknown, defs: FieldDefs, ctx: FieldContext): string {
  if (typeof value !== "number") {
    return str(value);
  }

  if (defs.type === "int") {
    return defs.disableFormatting ? String(value) : ctx.numbers.formatInt(value);
  }

  return ctx.numbers.formatFloat(value, typeof defs.decimalPlaces === "number" ? defs.decimalPlaces : undefined);
}

function NumberDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const value = values[name];

  return value === null || value === undefined || value === "" ? null : (
    <span className="tabular-nums">{formatNumberValue(value, defs, ctx)}</span>
  );
}

/** Ô nhập số: giữ chuỗi người dùng gõ, chỉ đổi thành số khi hợp lệ. */
function NumberInput({
  ctx,
  value,
  integer,
  onValue,
  ...rest
}: {
  ctx: FieldContext;
  value: unknown;
  integer: boolean;
  onValue: (value: number | string | null) => void;
  id?: string;
  invalid?: boolean;
  required?: boolean;
  "aria-describedby"?: string;
  className?: string;
}) {
  const external = typeof value === "number" ? (integer ? String(value) : String(value).replace(".", ctx.numbers.decimalMark)) : str(value);
  const [text, setText] = useState(external);
  const [last, setLast] = useState(value);

  // Giá trị đổi từ bên ngoài (reset form, dynamic logic) → cập nhật ô nhập.
  if (last !== value && parseNumber(text, ctx, integer) !== value) {
    setLast(value);
    setText(external);
  }

  return (
    <TextInput
      {...rest}
      inputMode={integer ? "numeric" : "decimal"}
      value={text}
      onChange={(event) => {
        const next = parseNumber(event.target.value, ctx, integer);

        setText(event.target.value);
        setLast(next);
        onValue(next);
      }}
    />
  );
}

function NumberEdit({ ctx, name, defs, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  return (
    <NumberInput
      ctx={ctx}
      id={inputId}
      value={values[name]}
      integer={defs.type === "int"}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      className="max-w-xs"
      onValue={(value) => onChange({ [name]: value })}
    />
  );
}

export const intField: FieldType = { Display: NumberDisplay, Edit: NumberEdit, Search: NumberSearch };
export const floatField: FieldType = { Display: NumberDisplay, Edit: NumberEdit, Search: NumberSearch };

function PlainDisplay({ name, values }: FieldDisplayProps) {
  const value = str(values[name]);

  return value ? <span>{value}</span> : null;
}

export const autoincrementField: FieldType = { Display: PlainDisplay, Search: NumberSearch };
export const numberField: FieldType = { Display: PlainDisplay, Search: TextSearch };

function currencyOptions(ctx: FieldContext, defs: FieldDefs) {
  return {
    currencyFormat: typeof ctx.settings.currencyFormat === "number" ? ctx.settings.currencyFormat : 1,
    decimalPlaces:
      typeof defs.decimalPlaces === "number"
        ? defs.decimalPlaces
        : typeof ctx.settings.currencyDecimalPlaces === "number"
          ? ctx.settings.currencyDecimalPlaces
          : null,
    symbolMap: (ctx.metadata.app as { currency?: { symbolMap?: Record<string, string> } } | undefined)?.currency?.symbolMap,
  };
}

function CurrencyDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const value = values[name];

  if (typeof value !== "number") {
    return null;
  }

  const currency = str(values[`${name}Currency`]) || str(ctx.settings.defaultCurrency);

  return <span className="tabular-nums">{formatCurrency(value, currency, ctx.numbers, currencyOptions(ctx, defs))}</span>;
}

function CurrencyEdit({ ctx, name, defs, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  const defaultCurrency = str(ctx.settings.defaultCurrency) || "USD";
  const currency = str(values[`${name}Currency`]) || defaultCurrency;
  let currencyList = defs.onlyDefaultCurrency
    ? [defaultCurrency]
    : ((ctx.settings.currencyList as string[] | undefined) ?? [defaultCurrency]);

  if (!currencyList.includes(currency)) {
    currencyList = [...currencyList, currency];
  }

  return (
    <div className="flex max-w-sm gap-2">
      <NumberInput
        ctx={ctx}
        id={inputId}
        value={values[name]}
        integer={false}
        invalid={invalid}
        required={required}
        aria-describedby={describedBy}
        onValue={(value) => onChange({ [name]: value, [`${name}Currency`]: currency })}
      />
      {currencyList.length > 1 ? (
        <Select
          aria-label={ctx.t("currency", "fields")}
          className="w-24 shrink-0"
          value={currency}
          onChange={(event) => onChange({ [`${name}Currency`]: event.target.value })}
        >
          {currencyList.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      ) : (
        <span className="inline-flex h-9 items-center rounded-lg bg-slate-100 px-3 text-sm text-slate-600">{currency}</span>
      )}
    </div>
  );
}

export const currencyField: FieldType = { Display: CurrencyDisplay, Edit: CurrencyEdit, Search: NumberSearch };

/** Giá trị quy đổi sang tiền tệ gốc (chỉ đọc). */
function CurrencyConvertedDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const value = values[name];

  if (typeof value !== "number") {
    return null;
  }

  const currency = str(ctx.settings.baseCurrency) || str(ctx.settings.defaultCurrency);

  return <span className="tabular-nums">{formatCurrency(value, currency, ctx.numbers, currencyOptions(ctx, defs))}</span>;
}

export const currencyConvertedField: FieldType = { Display: CurrencyConvertedDisplay, Search: NumberSearch };

// ——— Bool ———

function BoolDisplay({ ctx, name, values, mode }: FieldDisplayProps) {
  const value = !!values[name];

  if (mode === "list") {
    return value ? (
      <span className="text-emerald-600" title={ctx.t("Yes")}>
        <i className="fas fa-check" aria-hidden />
        <span className="sr-only">{ctx.t("Yes")}</span>
      </span>
    ) : null;
  }

  return <span className={value ? "text-slate-900" : "text-slate-500"}>{value ? ctx.t("Yes") : ctx.t("No")}</span>;
}

function BoolEdit({ ctx, name, values, onChange, inputId }: FieldEditProps) {
  return (
    <Checkbox
      id={inputId}
      checked={!!values[name]}
      onChange={(event) => onChange({ [name]: event.target.checked })}
      label={<span className="text-slate-500">{values[name] ? ctx.t("Yes") : ctx.t("No")}</span>}
    />
  );
}

export const boolField: FieldType = { Display: BoolDisplay, Edit: BoolEdit, Search: BoolSearch, hasValue: () => true };

// ——— Enum / mảng ———

/** Dịch option: `translation` trỏ tới danh sách khác (ví dụ `Global.options.xxx`), không thì theo field. */
export function translateOption(ctx: FieldContext, scope: string, name: string, defs: FieldDefs, value: string): string {
  if (typeof defs.translation === "string") {
    const [translationScope, category, list] = defs.translation.split(".");
    const map = ctx.t.path([translationScope, category, list]);

    if (map && typeof map === "object" && typeof (map as Record<string, unknown>)[value] === "string") {
      return (map as Record<string, string>)[value];
    }
  }

  return ctx.t.option(value, name, scope);
}

function EnumDisplay({ ctx, scope, name, defs, values }: FieldDisplayProps) {
  const value = str(values[name]);

  if (!value) {
    return null;
  }

  const label = translateOption(ctx, scope, name, defs, value);
  const style = defs.style?.[value];

  return defs.displayAsLabel || style ? <Badge style={style ?? "default"}>{label}</Badge> : <span>{label}</span>;
}

function EnumEdit({ ctx, scope, name, defs, values, onChange, inputId, invalid, required, optionList, describedBy }: FieldEditProps) {
  const current = str(values[name]);
  const options = optionList ?? defs.options ?? [];
  // Giá trị hiện tại không còn trong danh sách (do dynamic logic) vẫn hiện để không mất dữ liệu.
  const list = current && !options.includes(current) ? [...options, current] : options;

  return (
    <Select
      id={inputId}
      value={current}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      className="max-w-sm"
      onChange={(event) => onChange({ [name]: event.target.value === "" ? (list.includes("") ? "" : null) : event.target.value })}
    >
      {!list.includes("") && <option value="" />}
      {list.map((option) => (
        <option key={option || "(empty)"} value={option}>
          {option === "" ? "" : translateOption(ctx, scope, name, defs, option)}
        </option>
      ))}
    </Select>
  );
}

export const enumField: FieldType = { Display: EnumDisplay, Edit: EnumEdit, Search: EnumSearch };

function ArrayDisplay({ ctx, scope, name, defs, values }: FieldDisplayProps) {
  const list = Array.isArray(values[name]) ? (values[name] as unknown[]).map(str) : [];

  if (!list.length) {
    return null;
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {list.map((item) => (
        <Badge key={item} style={defs.style?.[item] ?? "default"}>
          {defs.options?.length ? translateOption(ctx, scope, name, defs, item) : item}
        </Badge>
      ))}
    </span>
  );
}

function ArrayEdit({ ctx, scope, name, defs, values, onChange, inputId, optionList }: FieldEditProps) {
  const list = Array.isArray(values[name]) ? (values[name] as unknown[]).map(str) : [];
  const options = optionList ?? defs.options ?? [];
  const [draft, setDraft] = useState("");

  if (options.length) {
    return (
      <div id={inputId} className="flex max-w-md flex-wrap gap-x-4 gap-y-1.5">
        {options.map((option) => (
          <Checkbox
            key={option}
            checked={list.includes(option)}
            onChange={(event) =>
              onChange({ [name]: event.target.checked ? [...list, option] : list.filter((item) => item !== option) })
            }
            label={translateOption(ctx, scope, name, defs, option)}
          />
        ))}
      </div>
    );
  }

  // Mảng tự do (không có option): nhập rồi Enter để thêm.
  return (
    <div className="flex max-w-md flex-col gap-2">
      {list.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {list.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange({ [name]: list.filter((x) => x !== item) })}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-red-50 hover:text-red-700"
              aria-label={`${ctx.t("Remove")} ${item}`}
            >
              {item} <i className="fas fa-times text-[10px]" aria-hidden />
            </button>
          ))}
        </span>
      )}
      <TextInput
        id={inputId}
        value={draft}
        placeholder={ctx.t("Add Item")}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && draft.trim()) {
            event.preventDefault();

            if (!list.includes(draft.trim())) {
              onChange({ [name]: [...list, draft.trim()] });
            }

            setDraft("");
          }
        }}
      />
    </div>
  );
}

const arrayHasValue = (name: string, values: Values) => Array.isArray(values[name]) && (values[name] as unknown[]).length > 0;

export const multiEnumField: FieldType = { Display: ArrayDisplay, Edit: ArrayEdit, Search: EnumSearch, hasValue: arrayHasValue };
export const arrayField: FieldType = { Display: ArrayDisplay, Edit: ArrayEdit, Search: EnumSearch, hasValue: arrayHasValue };

// ——— Ngày giờ ———

function DateDisplay({ ctx, name, values }: FieldDisplayProps) {
  const value = ctx.dateTime.toDisplayDate(str(values[name]));

  return value ? <span className="tabular-nums">{value}</span> : null;
}

function DateEdit({ name, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  return (
    <TextInput
      id={inputId}
      type="date"
      className="max-w-48"
      value={str(values[name])}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      onChange={(event) => onChange({ [name]: event.target.value || null })}
    />
  );
}

export const dateField: FieldType = { Display: DateDisplay, Edit: DateEdit, Search: DateSearch };

function DatetimeDisplay({ ctx, name, values }: FieldDisplayProps) {
  const value = ctx.dateTime.toDisplay(str(values[name]));

  return value ? <span className="tabular-nums">{value}</span> : null;
}

/** `YYYY-MM-DD HH:mm:ss` (UTC) ↔ giá trị của `<input type="datetime-local">` theo múi giờ người dùng. */
function toLocalInput(value: unknown, ctx: FieldContext): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  const date = ctx.dateTime.toDayjs(value);

  return date.isValid() ? date.format("YYYY-MM-DDTHH:mm") : "";
}

function fromLocalInput(value: string, ctx: FieldContext): string | null {
  if (!value) {
    return null;
  }

  const date = dayjs.tz(value, "YYYY-MM-DDTHH:mm", ctx.dateTime.getTimeZone());

  return date.isValid() ? date.utc().format("YYYY-MM-DD HH:mm:ss") : null;
}

function DatetimeEdit({ ctx, name, values, onChange, inputId, invalid, required, describedBy }: FieldEditProps) {
  return (
    <TextInput
      id={inputId}
      type="datetime-local"
      className="max-w-60"
      value={toLocalInput(values[name], ctx)}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      onChange={(event) => onChange({ [name]: fromLocalInput(event.target.value, ctx) })}
    />
  );
}

export const datetimeField: FieldType = { Display: DatetimeDisplay, Edit: DatetimeEdit, Search: DateSearch };

/** Datetime tuỳ chọn giờ: có giờ → `<name>`, chỉ ngày → `<name>Date` (ví dụ Task.dateStart / dateStartDate). */
function DatetimeOptionalDisplay(props: FieldDisplayProps) {
  const date = str(props.values[`${props.name}Date`]);

  if (date) {
    const value = props.ctx.dateTime.toDisplayDate(date);

    return value ? <span className="tabular-nums">{value}</span> : null;
  }

  return <DatetimeDisplay {...props} />;
}

function DatetimeOptionalEdit(props: FieldEditProps) {
  const { ctx, name, values, onChange, inputId, invalid, required, describedBy } = props;
  const [isAllDay, setAllDay] = useState(!!values[`${name}Date`]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {isAllDay ? (
        <TextInput
          id={inputId}
          type="date"
          className="max-w-48"
          value={str(values[`${name}Date`])}
          invalid={invalid}
          required={required}
          aria-describedby={describedBy}
          onChange={(event) => onChange({ [`${name}Date`]: event.target.value || null, [name]: null })}
        />
      ) : (
        <DatetimeEdit {...props} onChange={(patch) => onChange({ ...patch, [`${name}Date`]: null })} />
      )}
      <Checkbox
        checked={isAllDay}
        onChange={(event) => {
          setAllDay(event.target.checked);

          if (event.target.checked) {
            const date = values[name] ? ctx.dateTime.toDayjs(str(values[name])).format("YYYY-MM-DD") : null;

            onChange({ [`${name}Date`]: date, [name]: null });
          } else {
            const date = str(values[`${name}Date`]);

            onChange({
              [name]: date ? fromLocalInput(`${date}T09:00`, ctx) : null,
              [`${name}Date`]: null,
            });
          }
        }}
        label={ctx.t("All-Day", "labels", "Meeting")}
      />
    </div>
  );
}

export const datetimeOptionalField: FieldType = {
  Display: DatetimeOptionalDisplay,
  Edit: DatetimeOptionalEdit,
  Search: DateSearch,
  hasValue: (name, values) => !!values[name] || !!values[`${name}Date`],
};

// ——— Foreign (giá trị của bản ghi liên kết, chỉ đọc) ———

function ForeignDisplay({ ctx, scope, name, defs, values }: FieldDisplayProps) {
  const value = str(values[name]);

  if (!value) {
    return null;
  }

  // Field gốc là enum → dịch theo entity đích.
  const foreignScope = defs.link ? getLinkEntity(ctx.metadata, scope, defs.link) : undefined;
  const foreignField = typeof defs.field === "string" ? defs.field : undefined;
  const foreignDefs =
    foreignScope && foreignField
      ? (ctx.metadata.entityDefs as Record<string, { fields?: Record<string, FieldDefs> }> | undefined)?.[foreignScope]?.fields?.[
          foreignField
        ]
      : undefined;

  if (foreignScope && foreignField && foreignDefs?.type === "enum") {
    return <span>{translateOption(ctx, foreignScope, foreignField, foreignDefs, value)}</span>;
  }

  return <span>{value}</span>;
}

export const foreignField: FieldType = { Display: ForeignDisplay, Search: TextSearch };
