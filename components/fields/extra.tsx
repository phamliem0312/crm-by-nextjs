"use client";

// Field đợt 2: enumInt/enumFloat, arrayInt, urlMultiple, checklist, colorpicker, range*, jsonArray/jsonObject,
// barcode, map, duration, file, image, attachmentMultiple. Port hành vi từ `views/fields/*` tương ứng của classic.
import dayjs from "@/lib/espo/dayjs";
import { useRef, useState } from "react";
import { formatAddress, formatCurrency } from "@/lib/espo/field-format";
import type { FieldDefs } from "@/lib/espo/entity";
import { interpolate } from "@/lib/espo/i18n";
import { uploadAttachment, type AttachmentTarget, type UploadedAttachment } from "@/lib/espo/records";
import { toast } from "@/components/ui/toaster";
import { toHref, translateOption, varcharField } from "./basic";
import { EnumSearch, NumberSearch } from "./search-ui";
import type { FieldContext, FieldDisplayProps, FieldEditProps, FieldType, Values } from "./types";
import { Badge, Checkbox, IconButton, Select, TextInput, XIcon } from "./ui";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// ——— enumInt / enumFloat: enum có option là số ———

function NumericEnumDisplay({ ctx, scope, name, defs, values }: FieldDisplayProps) {
  const value = values[name];

  if (value === null || value === undefined || value === "") {
    return null;
  }

  const key = String(value);
  const style = defs.style?.[key];
  const label = translateOption(ctx, scope, name, defs, key);

  return style ? <Badge style={style}>{label}</Badge> : <span>{label}</span>;
}

function NumericEnumEdit({ ctx, scope, name, defs, values, onChange, inputId, invalid, required, optionList, describedBy }: FieldEditProps) {
  const options = (optionList ?? defs.options ?? []).map(String);
  const current = values[name] === null || values[name] === undefined ? "" : String(values[name]);

  return (
    <Select
      id={inputId}
      value={current}
      invalid={invalid}
      required={required}
      aria-describedby={describedBy}
      className="max-w-sm"
      onChange={(event) => onChange({ [name]: event.target.value === "" ? null : Number(event.target.value) })}
    >
      <option value="" />
      {options.map((option) => (
        <option key={option} value={option}>
          {translateOption(ctx, scope, name, defs, option)}
        </option>
      ))}
    </Select>
  );
}

export const enumIntField: FieldType = { Display: NumericEnumDisplay, Edit: NumericEnumEdit, Search: EnumSearch };
export const enumFloatField: FieldType = enumIntField;

// ——— arrayInt / urlMultiple: danh sách giá trị tự do ———

function ListDisplay({ name, values, defs }: FieldDisplayProps) {
  const items = list(values[name]).map(str).filter(Boolean);

  if (!items.length) {
    return null;
  }

  if (defs.type === "urlMultiple") {
    return (
      <span className="flex flex-col gap-0.5">
        {items.map((item) => {
          const href = toHref(item);

          return href ? (
            <a key={item} href={href} target="_blank" rel="noopener noreferrer" className="break-all text-blue-600 hover:underline">
              {item}
            </a>
          ) : (
            <span key={item}>{item}</span>
          );
        })}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((item) => (
        <Badge key={item}>{item}</Badge>
      ))}
    </span>
  );
}

function ListEdit({ ctx, name, defs, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const items = list(values[name]);
  const [draft, setDraft] = useState("");
  const numeric = defs.type === "arrayInt";

  function add() {
    const text = draft.trim();

    if (!text) {
      return;
    }

    const value = numeric ? Number.parseInt(text, 10) : text;

    if (numeric && !Number.isFinite(value)) {
      return;
    }

    if (!items.includes(value)) {
      onChange({ [name]: [...items, value] });
    }

    setDraft("");
  }

  return (
    <div className="flex max-w-md flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={String(item)} className="flex items-center gap-2 rounded-md bg-slate-50 py-0.5 pr-0.5 pl-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{str(item)}</span>
              <IconButton label={`${ctx.t("Remove")} ${str(item)}`} onClick={() => onChange({ [name]: items.filter((x) => x !== item) })}>
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <TextInput
        id={inputId}
        type={defs.type === "urlMultiple" ? "url" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={draft}
        invalid={invalid}
        aria-describedby={describedBy}
        placeholder={ctx.t("Add Item")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add();
          }
        }}
      />
    </div>
  );
}

const listHasValue = (name: string, values: Values) => list(values[name]).length > 0;

export const arrayIntField: FieldType = { Display: ListDisplay, Edit: ListEdit, hasValue: listHasValue };
export const urlMultipleField: FieldType = { Display: ListDisplay, Edit: ListEdit, hasValue: listHasValue };

// ——— checklist: các mục đã đánh dấu trong danh sách option ———

function ChecklistDisplay({ ctx, scope, name, defs, values }: FieldDisplayProps) {
  const checked = list(values[name]).map(str);
  const options = defs.options ?? [];

  if (!options.length) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {options.map((option) => (
        <li key={option} className={checked.includes(option) ? "text-slate-900" : "text-slate-400"}>
          <i className={`${checked.includes(option) ? "fas fa-check-square text-blue-600" : "far fa-square"} mr-2`} aria-hidden />
          {translateOption(ctx, scope, name, defs, option)}
        </li>
      ))}
    </ul>
  );
}

function ChecklistEdit({ ctx, scope, name, defs, values, onChange, inputId }: FieldEditProps) {
  const checked = list(values[name]).map(str);

  return (
    <div id={inputId} className="flex flex-col gap-1.5">
      {(defs.options ?? []).map((option) => (
        <Checkbox
          key={option}
          checked={checked.includes(option)}
          onChange={(event) =>
            onChange({ [name]: event.target.checked ? [...checked, option] : checked.filter((item) => item !== option) })
          }
          label={translateOption(ctx, scope, name, defs, option)}
        />
      ))}
    </div>
  );
}

export const checklistField: FieldType = { Display: ChecklistDisplay, Edit: ChecklistEdit, Search: EnumSearch, hasValue: () => true };

// ——— colorpicker ———

const COLOR = /^#[0-9a-f]{6}$/i;

function ColorDisplay({ name, values }: FieldDisplayProps) {
  const value = str(values[name]);

  if (!value) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-4 rounded border border-slate-300" style={COLOR.test(value) ? { backgroundColor: value } : undefined} aria-hidden />
      <span className="font-mono text-xs">{value}</span>
    </span>
  );
}

function ColorEdit({ ctx, name, values, onChange, inputId }: FieldEditProps) {
  const value = str(values[name]);

  return (
    <span className="inline-flex items-center gap-2">
      <input
        id={inputId}
        type="color"
        value={COLOR.test(value) ? value : "#000000"}
        onChange={(event) => onChange({ [name]: event.target.value })}
        className="h-9 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
      />
      {value && (
        <IconButton label={ctx.t("Remove")} onClick={() => onChange({ [name]: null })}>
          <XIcon />
        </IconButton>
      )}
    </span>
  );
}

export const colorpickerField: FieldType = { Display: ColorDisplay, Edit: ColorEdit };

// ——— rangeInt / rangeFloat / rangeCurrency: `from<Name>` – `to<Name>` ———

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function rangeValue(ctx: FieldContext, defs: FieldDefs, value: unknown, currency: string): string {
  if (typeof value !== "number") {
    return "";
  }

  if (defs.type === "rangeCurrency") {
    return formatCurrency(value, currency, ctx.numbers, {
      currencyFormat: typeof ctx.settings.currencyFormat === "number" ? ctx.settings.currencyFormat : 1,
      decimalPlaces: typeof ctx.settings.currencyDecimalPlaces === "number" ? ctx.settings.currencyDecimalPlaces : null,
    });
  }

  return defs.type === "rangeInt" ? ctx.numbers.formatInt(value) : ctx.numbers.formatFloat(value);
}

function RangeDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const suffix = upperFirst(name);
  const currency = str(values[`${name}Currency`]) || str(ctx.settings.defaultCurrency);
  const from = rangeValue(ctx, defs, values[`from${suffix}`], currency);
  const to = rangeValue(ctx, defs, values[`to${suffix}`], currency);

  if (!from && !to) {
    return null;
  }

  return <span className="tabular-nums">{from && to ? `${from} – ${to}` : from ? `≥ ${from}` : `≤ ${to}`}</span>;
}

function RangeEdit({ ctx, name, defs, values, onChange, inputId, invalid }: FieldEditProps) {
  const suffix = upperFirst(name);
  const parse = (text: string) => {
    const value = Number(text.split(ctx.numbers.thousandSeparator || "\u0000").join("").replace(ctx.numbers.decimalMark, "."));

    return text.trim() === "" || !Number.isFinite(value) ? null : defs.type === "rangeInt" ? Math.trunc(value) : value;
  };

  return (
    <div className="flex max-w-sm items-center gap-2">
      <TextInput
        id={inputId}
        inputMode="decimal"
        invalid={invalid}
        aria-label={ctx.t(`from${suffix}`, "fields")}
        defaultValue={str(values[`from${suffix}`])}
        onChange={(event) => onChange({ [`from${suffix}`]: parse(event.target.value) })}
      />
      <span className="text-slate-400">–</span>
      <TextInput
        inputMode="decimal"
        invalid={invalid}
        aria-label={ctx.t(`to${suffix}`, "fields")}
        defaultValue={str(values[`to${suffix}`])}
        onChange={(event) => onChange({ [`to${suffix}`]: parse(event.target.value) })}
      />
    </div>
  );
}

const rangeHasValue = (name: string, values: Values) =>
  typeof values[`from${upperFirst(name)}`] === "number" || typeof values[`to${upperFirst(name)}`] === "number";

export const rangeField: FieldType = { Display: RangeDisplay, Edit: RangeEdit, hasValue: rangeHasValue };

// ——— jsonArray / jsonObject (chỉ đọc) ———

function JsonDisplay({ name, values, mode }: FieldDisplayProps) {
  const value = values[name];

  if (value === null || value === undefined || (Array.isArray(value) && !value.length)) {
    return null;
  }

  const text = JSON.stringify(value, null, mode === "detail" ? 2 : 0);

  return mode === "list" ? (
    <span className="line-clamp-2 font-mono text-xs break-all">{text}</span>
  ) : (
    <pre className="max-h-64 overflow-auto rounded-lg bg-slate-50 p-2 font-mono text-xs whitespace-pre-wrap">{text}</pre>
  );
}

export const jsonField: FieldType = { Display: JsonDisplay };

// ——— barcode: lưu như varchar ———

function BarcodeDisplay({ name, values }: FieldDisplayProps) {
  const value = str(values[name]);

  return value ? (
    <span className="inline-flex items-center gap-2 font-mono">
      <i className="fas fa-barcode text-slate-400" aria-hidden />
      {value}
    </span>
  ) : null;
}

export const barcodeField: FieldType = { ...varcharField, Display: BarcodeDisplay };

// ——— map: link mở bản đồ cho field địa chỉ tương ứng (ví dụ billingAddressMap → billingAddress) ———

function MapDisplay({ ctx, name, values }: FieldDisplayProps) {
  const addressField = name.replace(/Map$/, "");
  const address = formatAddress(addressField, values, 1).replaceAll("\n", ", ");

  if (!address) {
    return null;
  }

  return (
    <a
      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
    >
      <i className="fas fa-map-marker-alt text-xs" aria-hidden />
      {ctx.t("View")}
    </a>
  );
}

export const mapField: FieldType = {
  Display: MapDisplay,
  hasValue: (name, values) => ["Street", "City", "Country"].some((part) => !!values[name.replace(/Map$/, "") + part]),
};

// ——— duration: số giây giữa `start` và `end` (ví dụ Meeting: dateStart/dateEnd) ———

/** Port `stringifyDuration` của classic: "1d 2h 30m". */
export function stringifyDuration(seconds: number, units: Record<string, string> = {}): string {
  if (!seconds || seconds < 60) {
    return "0";
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];

  if (days) {
    parts.push(`${days}${units.d ?? "d"}`);
  }

  if (hours) {
    parts.push(`${hours}${units.h ?? "h"}`);
  }

  if (minutes) {
    parts.push(`${minutes}${units.m ?? "m"}`);
  }

  return parts.join(" ");
}

const DATE_TIME = "YYYY-MM-DD HH:mm:ss";

function durationSeconds(defs: FieldDefs, values: Values): number | null {
  const start = str(values[str(defs.start)]);
  const end = str(values[str(defs.end)]);

  if (start && end) {
    return dayjs.utc(end, DATE_TIME).diff(dayjs.utc(start, DATE_TIME), "second");
  }

  return typeof values.duration === "number" ? values.duration : null;
}

function durationUnits(ctx: FieldContext): Record<string, string> {
  const units = ctx.t.path(["Global", "durationUnits"]);

  return units && typeof units === "object" ? (units as Record<string, string>) : {};
}

function DurationDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const seconds = durationSeconds(defs, values) ?? (typeof values[name] === "number" ? (values[name] as number) : null);

  return seconds === null ? null : <span>{stringifyDuration(seconds, durationUnits(ctx))}</span>;
}

function DurationEdit({ ctx, name, defs, values, onChange, inputId, describedBy }: FieldEditProps) {
  const seconds = durationSeconds(defs, values) ?? (typeof defs.default === "number" ? defs.default : 3600);
  const options = [...new Set([...((defs.options as number[] | undefined) ?? [900, 1800, 3600, 7200]), seconds])].sort((a, b) => a - b);
  const start = str(values[str(defs.start)]);

  return (
    <Select
      id={inputId}
      aria-describedby={describedBy}
      className="max-w-48"
      value={String(seconds)}
      onChange={(event) => {
        const next = Number(event.target.value);
        const patch: Values = { [name]: next };

        // Giống classic: đổi duration → dời `end` = `start` + duration.
        if (start && defs.end) {
          patch[str(defs.end)] = dayjs.utc(start, DATE_TIME).add(next, "second").format(DATE_TIME);
        }

        onChange(patch);
      }}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {stringifyDuration(option, durationUnits(ctx))}
        </option>
      ))}
    </Select>
  );
}

export const durationField: FieldType = {
  Display: DurationDisplay,
  Edit: DurationEdit,
  Search: NumberSearch,
  hasValue: () => true,
  // Đổi `start` → dời `end` để giữ nguyên duration (classic: listen change:dateStart).
  onFormChange: (_name, defs, previous, next) => {
    const startAttribute = str(defs.start);
    const endAttribute = str(defs.end);

    if (!startAttribute || !endAttribute || previous[startAttribute] === next[startAttribute] || !next[startAttribute]) {
      return {};
    }

    const seconds = durationSeconds(defs, previous) ?? (typeof defs.default === "number" ? defs.default : 3600);

    return { [endAttribute]: dayjs.utc(str(next[startAttribute]), DATE_TIME).add(seconds, "second").format(DATE_TIME) };
  },
  saveAttributes: (_name, defs) => (defs.end ? [str(defs.end)] : []),
};

// ——— file / image / attachmentMultiple ———

function downloadUrl(ctx: FieldContext, id: string): string {
  return `${ctx.classicBasePath}/?entryPoint=download&id=${encodeURIComponent(id)}`;
}

function imageUrl(ctx: FieldContext, id: string, size = "small"): string {
  return `${ctx.classicBasePath}/?entryPoint=image&size=${size}&id=${encodeURIComponent(id)}`;
}

function FileLink({ ctx, id, name, type, image }: { ctx: FieldContext; id: string; name: string; type?: string; image?: boolean }) {
  if (image || (type && type.startsWith("image/"))) {
    return (
      <a href={imageUrl(ctx, id, "large")} target="_blank" rel="noopener noreferrer" className="inline-block">
        {/* Ảnh lấy qua entry point của Espo (cookie auth-token), không qua next/image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl(ctx, id)} alt={name} className="max-h-32 rounded-lg border border-slate-200 object-contain" />
      </a>
    );
  }

  return (
    <a href={downloadUrl(ctx, id)} className="inline-flex items-center gap-1.5 break-all text-blue-600 hover:underline">
      <i className="fas fa-paperclip text-xs text-slate-400" aria-hidden />
      {name || id}
    </a>
  );
}

function maxUploadBytes(ctx: FieldContext): number | null {
  const mb = ctx.appParams.maxUploadSize;

  return typeof mb === "number" && mb > 0 ? mb * 1024 * 1024 : null;
}

/** Chọn file → kiểm tra dung lượng → tải lên Attachment. */
function useUpload(ctx: FieldContext, label: string) {
  const [uploading, setUploading] = useState(false);

  async function upload(file: File, target: AttachmentTarget): Promise<UploadedAttachment | null> {
    const max = maxUploadBytes(ctx);

    if (max && file.size > max) {
      toast.errorText(interpolate(ctx.t("fieldMaxFileSizeError", "messages"), { field: label, max: max / 1024 / 1024 }));

      return null;
    }

    setUploading(true);

    try {
      return await uploadAttachment(file, target);
    } catch (error) {
      toast.error(error);

      return null;
    } finally {
      setUploading(false);
    }
  }

  return { uploading, upload };
}

function FileDisplay({ ctx, name, defs, values }: FieldDisplayProps) {
  const id = str(values[`${name}Id`]);

  return id ? <FileLink ctx={ctx} id={id} name={str(values[`${name}Name`])} image={defs.type === "image"} /> : null;
}

function FilePicker({
  ctx,
  inputId,
  accept,
  multiple,
  uploading,
  onFiles,
  describedBy,
}: {
  ctx: FieldContext;
  inputId: string;
  accept?: string;
  multiple?: boolean;
  uploading: boolean;
  onFiles: (files: File[]) => void;
  describedBy?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <input
        ref={ref}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];

          event.target.value = "";

          if (files.length) {
            onFiles(files);
          }
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => ref.current?.click()}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-60"
      >
        <i className={`fas ${uploading ? "fa-circle-notch fa-spin" : "fa-paperclip"} text-xs`} aria-hidden />
        {uploading ? ctx.t("Uploading...") : ctx.t("Select")}
      </button>
    </span>
  );
}

function FileEdit({ ctx, scope, name, defs, values, onChange, inputId, describedBy }: FieldEditProps) {
  const id = str(values[`${name}Id`]);
  const { uploading, upload } = useUpload(ctx, ctx.t(name, "fields", scope));

  if (id) {
    return (
      <span className="inline-flex items-center gap-2">
        <FileLink ctx={ctx} id={id} name={str(values[`${name}Name`])} image={defs.type === "image"} />
        <IconButton label={ctx.t("Remove")} onClick={() => onChange({ [`${name}Id`]: null, [`${name}Name`]: null })}>
          <XIcon />
        </IconButton>
      </span>
    );
  }

  return (
    <FilePicker
      ctx={ctx}
      inputId={inputId}
      describedBy={describedBy}
      accept={defs.type === "image" ? "image/*" : (defs.accept as string[] | undefined)?.join(",")}
      uploading={uploading}
      onFiles={async ([file]) => {
        const attachment = await upload(file, { relatedType: scope, field: name });

        if (attachment) {
          onChange({ [`${name}Id`]: attachment.id, [`${name}Name`]: attachment.name });
        }
      }}
    />
  );
}

export const fileField: FieldType = {
  Display: FileDisplay,
  Edit: FileEdit,
  hasValue: (name, values) => !!values[`${name}Id`],
};

function attachments(name: string, values: Values) {
  const ids = list(values[`${name}Ids`]).map(str);
  const names = (values[`${name}Names`] ?? {}) as Record<string, string>;
  const types = (values[`${name}Types`] ?? {}) as Record<string, string>;

  return ids.map((id) => ({ id, name: names[id] ?? id, type: types[id] ?? "" }));
}

function AttachmentsDisplay({ ctx, name, values, mode }: FieldDisplayProps) {
  const items = attachments(name, values);

  if (!items.length) {
    return null;
  }

  if (mode === "list") {
    return (
      <span className="inline-flex items-center gap-1 text-slate-600">
        <i className="fas fa-paperclip text-xs" aria-hidden />
        {items.length}
      </span>
    );
  }

  return (
    <span className="flex flex-col gap-1.5">
      {items.map((item) => (
        <FileLink key={item.id} ctx={ctx} id={item.id} name={item.name} type={item.type} />
      ))}
    </span>
  );
}

function AttachmentsEdit({ ctx, scope, name, values, onChange, inputId, describedBy }: FieldEditProps) {
  const items = attachments(name, values);
  const { uploading, upload } = useUpload(ctx, ctx.t(name, "fields", scope));

  const set = (next: { id: string; name: string; type: string }[]) =>
    onChange({
      [`${name}Ids`]: next.map((item) => item.id),
      [`${name}Names`]: Object.fromEntries(next.map((item) => [item.id, item.name])),
      [`${name}Types`]: Object.fromEntries(next.map((item) => [item.id, item.type])),
    });

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <FileLink ctx={ctx} id={item.id} name={item.name} />
              <IconButton label={`${ctx.t("Remove")} ${item.name}`} onClick={() => set(items.filter((x) => x.id !== item.id))}>
                <XIcon />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <FilePicker
        ctx={ctx}
        inputId={inputId}
        describedBy={describedBy}
        multiple
        uploading={uploading}
        onFiles={async (files) => {
          const uploaded = [];

          for (const file of files) {
            const attachment = await upload(file, { parentType: scope, field: name });

            if (attachment) {
              uploaded.push(attachment);
            }
          }

          set([...items, ...uploaded]);
        }}
      />
    </div>
  );
}

export const attachmentMultipleField: FieldType = {
  Display: AttachmentsDisplay,
  Edit: AttachmentsEdit,
  wide: true,
  hasValue: (name, values) => list(values[`${name}Ids`]).length > 0,
};
