"use client";

// Field gồm nhiều attribute: address, personName, email, phone.
// Port hành vi từ `views/fields/address`, `person-name`, `email`, `phone` của UI classic.
import { formatAddress, formatPersonName } from "@/lib/espo/field-format";
import { AddressSearch, TextSearch } from "./search-ui";
import type { FieldDisplayProps, FieldEditProps, FieldType, Values } from "./types";
import { IconButton, Select, TextArea, TextInput, XIcon } from "./ui";

const str = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// ——— Địa chỉ ———

function AddressDisplay({ ctx, name, values, mode }: FieldDisplayProps) {
  const text = formatAddress(name, values, typeof ctx.settings.addressFormat === "number" ? ctx.settings.addressFormat : 1);

  if (!text) {
    return null;
  }

  return mode === "list" ? (
    <span className="line-clamp-2">{text.replaceAll("\n", ", ")}</span>
  ) : (
    <span className="whitespace-pre-line">{text}</span>
  );
}

function AddressEdit({ ctx, scope, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const part = (key: string) => str(values[name + key]);
  const label = (key: string) => ctx.t(name + key, "fields", scope);
  const set = (key: string) => (event: { target: { value: string } }) => onChange({ [name + key]: event.target.value });

  return (
    <div className="grid max-w-lg grid-cols-2 gap-2" aria-describedby={describedBy}>
      <TextArea
        id={inputId}
        className="col-span-2 min-h-16"
        rows={2}
        placeholder={label("Street")}
        aria-label={label("Street")}
        value={part("Street")}
        invalid={invalid}
        onChange={set("Street")}
      />
      <TextInput placeholder={label("City")} aria-label={label("City")} value={part("City")} onChange={set("City")} />
      <TextInput placeholder={label("State")} aria-label={label("State")} value={part("State")} onChange={set("State")} />
      <TextInput placeholder={label("PostalCode")} aria-label={label("PostalCode")} value={part("PostalCode")} onChange={set("PostalCode")} />
      <TextInput placeholder={label("Country")} aria-label={label("Country")} value={part("Country")} onChange={set("Country")} />
    </div>
  );
}

export const addressField: FieldType = {
  Display: AddressDisplay,
  Edit: AddressEdit,
  Search: AddressSearch,
  wide: true,
  hasValue: (name, values) => ["Street", "City", "State", "Country", "PostalCode"].some((key) => !!values[name + key]),
};

// ——— Tên người ———

function PersonNameDisplay({ ctx, scope, name, values }: FieldDisplayProps) {
  const text = formatPersonName(name, values, str(ctx.settings.personNameFormat) || "firstLast", (value) =>
    ctx.t.option(value, `salutation${upperFirst(name)}`, scope),
  );

  return text ? <span>{text}</span> : null;
}

function PersonNameEdit({ ctx, scope, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const suffix = upperFirst(name);
  const salutationField = `salutation${suffix}`;
  const salutationDefs = (ctx.metadata.entityDefs as Record<string, { fields?: Record<string, { options?: string[] }> }>)?.[scope]
    ?.fields?.[salutationField];
  const salutations = salutationDefs?.options ?? ["", "Mr.", "Ms.", "Mrs.", "Dr."];
  const withMiddle = /Middle/i.test(str(ctx.settings.personNameFormat));
  const field = (key: string) => `${key}${suffix}`;
  const set = (attribute: string) => (event: { target: { value: string } }) => onChange({ [attribute]: event.target.value });

  return (
    <div className="flex max-w-xl flex-wrap gap-2" aria-describedby={describedBy}>
      <Select
        aria-label={ctx.t(salutationField, "fields", scope)}
        className="w-24 shrink-0"
        value={str(values[salutationField])}
        onChange={set(salutationField)}
      >
        {salutations.map((option) => (
          <option key={option || "(empty)"} value={option}>
            {option ? ctx.t.option(option, salutationField, scope) : ""}
          </option>
        ))}
      </Select>
      <TextInput
        id={inputId}
        className="min-w-32 flex-1"
        placeholder={ctx.t(field("first"), "fields", scope)}
        aria-label={ctx.t(field("first"), "fields", scope)}
        value={str(values[field("first")])}
        invalid={invalid}
        onChange={set(field("first"))}
      />
      {withMiddle && (
        <TextInput
          className="min-w-24 flex-1"
          placeholder={ctx.t(field("middle"), "fields", scope)}
          aria-label={ctx.t(field("middle"), "fields", scope)}
          value={str(values[field("middle")])}
          onChange={set(field("middle"))}
        />
      )}
      <TextInput
        className="min-w-32 flex-1"
        placeholder={ctx.t(field("last"), "fields", scope)}
        aria-label={ctx.t(field("last"), "fields", scope)}
        value={str(values[field("last")])}
        invalid={invalid}
        onChange={set(field("last"))}
      />
    </div>
  );
}

export const personNameField: FieldType = {
  Display: PersonNameDisplay,
  Edit: PersonNameEdit,
  Search: TextSearch,
  hasValue: (name, values) => {
    const suffix = upperFirst(name);

    return !!values[`first${suffix}`] || !!values[`last${suffix}`] || !!values[name];
  },
};

// ——— Email / điện thoại (nhiều giá trị, một giá trị chính) ———

type EmailItem = { emailAddress: string; primary: boolean; optOut?: boolean; invalid?: boolean; lower?: string };
type PhoneItem = { phoneNumber: string; primary: boolean; type?: string; optOut?: boolean; invalid?: boolean };

function emailItems(name: string, values: Values): EmailItem[] {
  const data = values[`${name}Data`];

  if (Array.isArray(data) && data.length) {
    return data as EmailItem[];
  }

  const value = str(values[name]);

  return value ? [{ emailAddress: value, primary: true }] : [];
}

function phoneItems(name: string, values: Values): PhoneItem[] {
  const data = values[`${name}Data`];

  if (Array.isArray(data) && data.length) {
    return data as PhoneItem[];
  }

  const value = str(values[name]);

  return value ? [{ phoneNumber: value, primary: true }] : [];
}

/** Bỏ dòng trống, đảm bảo có đúng một giá trị chính. */
function cleanEmails(items: EmailItem[]): EmailItem[] {
  const clean = items
    .filter((item) => item.emailAddress.trim() !== "")
    .map((item) => ({ ...item, emailAddress: item.emailAddress.trim(), lower: item.emailAddress.trim().toLowerCase() }));

  if (clean.length && !clean.some((item) => item.primary)) {
    clean[0] = { ...clean[0], primary: true };
  }

  return clean;
}

function cleanPhones(items: PhoneItem[]): PhoneItem[] {
  const clean = items
    .filter((item) => item.phoneNumber.trim() !== "")
    .map((item) => ({ ...item, phoneNumber: item.phoneNumber.trim() }));

  if (clean.length && !clean.some((item) => item.primary)) {
    clean[0] = { ...clean[0], primary: true };
  }

  return clean;
}

function EmailDisplay({ name, values, mode }: FieldDisplayProps) {
  const items = mode === "list" ? emailItems(name, values).filter((item) => item.primary).slice(0, 1) : emailItems(name, values);

  if (!items.length) {
    return null;
  }

  return (
    <span className="flex flex-col gap-0.5">
      {items.map((item) => (
        <span key={item.emailAddress} className={item.optOut || item.invalid ? "text-slate-400 line-through" : ""}>
          <a href={`mailto:${item.emailAddress}`} className="break-all text-blue-600 hover:underline">
            {item.emailAddress}
          </a>
        </span>
      ))}
    </span>
  );
}

function PhoneDisplay({ ctx, scope, name, values, mode }: FieldDisplayProps) {
  const items = mode === "list" ? phoneItems(name, values).filter((item) => item.primary).slice(0, 1) : phoneItems(name, values);

  if (!items.length) {
    return null;
  }

  return (
    <span className="flex flex-col gap-0.5">
      {items.map((item) => (
        <span key={item.phoneNumber} className={item.optOut || item.invalid ? "text-slate-400 line-through" : ""}>
          <a href={`tel:${item.phoneNumber.replace(/[^\d+]/g, "")}`} className="text-blue-600 hover:underline">
            {item.phoneNumber}
          </a>
          {mode === "detail" && item.type && (
            <span className="ml-2 text-xs text-slate-500">{ctx.t.option(item.type, name, scope)}</span>
          )}
        </span>
      ))}
    </span>
  );
}

/** Danh sách giá trị có nút chọn "chính" và nút xoá. */
function MultiValueEdit<T extends { primary: boolean }>({
  ctx,
  items,
  valueKey,
  onItems,
  inputId,
  invalid,
  inputType,
  renderExtra,
  blank,
  describedBy,
}: {
  ctx: FieldEditProps["ctx"];
  items: T[];
  valueKey: keyof T & string;
  onItems: (items: T[]) => void;
  inputId: string;
  invalid: boolean;
  inputType: string;
  renderExtra?: (item: T, index: number, update: (patch: Partial<T>) => void) => React.ReactNode;
  blank: () => T;
  describedBy?: string;
}) {
  const rows = items.length ? items : [blank()];
  const update = (index: number, patch: Partial<T>) => onItems(rows.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div className="flex max-w-lg flex-col gap-2" aria-describedby={describedBy}>
      {rows.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {renderExtra?.(item, index, (patch) => update(index, patch))}
          <TextInput
            id={index === 0 ? inputId : undefined}
            type={inputType}
            value={str(item[valueKey])}
            invalid={invalid}
            onChange={(event) => update(index, { [valueKey]: event.target.value } as Partial<T>)}
          />
          {rows.length > 1 && (
            <>
              <label className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-500" title={ctx.t("Primary")}>
                <input
                  type="radio"
                  className="accent-blue-600"
                  checked={item.primary}
                  onChange={() => onItems(rows.map((row, i) => ({ ...row, primary: i === index })))}
                />
                {ctx.t("Primary")}
              </label>
              <IconButton
                label={ctx.t("Remove")}
                onClick={() => {
                  const next = rows.filter((_, i) => i !== index);

                  if (item.primary && next.length) {
                    next[0] = { ...next[0], primary: true };
                  }

                  onItems(next);
                }}
              >
                <XIcon />
              </IconButton>
            </>
          )}
        </div>
      ))}
      <button
        type="button"
        className="self-start text-sm font-medium text-blue-600 hover:underline"
        onClick={() => onItems([...rows, { ...blank(), primary: false }])}
      >
        <i className="fas fa-plus mr-1 text-xs" aria-hidden />
        {ctx.t("Add")}
      </button>
    </div>
  );
}

function EmailEdit({ ctx, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  return (
    <MultiValueEdit<EmailItem>
      ctx={ctx}
      items={emailItems(name, values)}
      valueKey="emailAddress"
      inputType="email"
      inputId={inputId}
      invalid={invalid}
      describedBy={describedBy}
      blank={() => ({ emailAddress: "", primary: true, optOut: false, invalid: false })}
      // Giữ cả dòng đang gõ dở trong form; `prepareSave` bỏ dòng trống trước khi gửi.
      onItems={(items) => onChange({ [name]: cleanEmails(items).find((item) => item.primary)?.emailAddress ?? null, [`${name}Data`]: items })}
    />
  );
}

function PhoneEdit({ ctx, scope, name, defs, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const typeList = (defs.typeList as string[] | undefined) ?? ["Mobile", "Office", "Home", "Fax", "Other"];
  const defaultType = (defs.defaultType as string | undefined) ?? typeList[0];

  return (
    <MultiValueEdit<PhoneItem>
      ctx={ctx}
      items={phoneItems(name, values)}
      valueKey="phoneNumber"
      inputType="tel"
      inputId={inputId}
      invalid={invalid}
      describedBy={describedBy}
      blank={() => ({ phoneNumber: "", primary: true, type: defaultType, optOut: false, invalid: false })}
      renderExtra={(item, _index, update) => (
        <Select
          aria-label={`${ctx.t(name, "fields", scope)}: ${ctx.t("Type")}`}
          className="w-28 shrink-0"
          value={item.type ?? defaultType}
          onChange={(event) => update({ type: event.target.value })}
        >
          {typeList.map((type) => (
            <option key={type} value={type}>
              {ctx.t.option(type, name, scope)}
            </option>
          ))}
        </Select>
      )}
      onItems={(items) => onChange({ [name]: cleanPhones(items).find((item) => item.primary)?.phoneNumber ?? null, [`${name}Data`]: items })}
    />
  );
}

export const emailField: FieldType = {
  Display: EmailDisplay,
  Edit: EmailEdit,
  Search: TextSearch,
  hasValue: (name, values) => emailItems(name, values).length > 0,
  prepareSave: (name, values) => {
    if (!Array.isArray(values[`${name}Data`])) {
      return {};
    }

    const clean = cleanEmails(values[`${name}Data`] as EmailItem[]);

    return { [name]: clean.find((item) => item.primary)?.emailAddress ?? null, [`${name}Data`]: clean };
  },
};

export const phoneField: FieldType = {
  Display: PhoneDisplay,
  Edit: PhoneEdit,
  Search: TextSearch,
  hasValue: (name, values) => phoneItems(name, values).length > 0,
  prepareSave: (name, values) => {
    if (!Array.isArray(values[`${name}Data`])) {
      return {};
    }

    const clean = cleanPhones(values[`${name}Data`] as PhoneItem[]);

    return { [name]: clean.find((item) => item.primary)?.phoneNumber ?? null, [`${name}Data`]: clean };
  },
};
