// Kiểm tra dữ liệu form trước khi lưu: required, pattern (`regExpPatterns`), min/max, email, số, ngày trước/sau.
// Port từ các hàm validate* của `views/fields/*` và `helpers/reg-exp-pattern` của UI classic.
// Server vẫn kiểm tra lại; phần này chỉ để báo lỗi sớm, đúng thông báo của Espo.
import { getFieldDefs, type FieldDefs } from "./entity";
import { interpolate, type Translator } from "./i18n";
import type { Metadata } from "./types";

type Values = Record<string, unknown>;

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/** Field có giá trị hay không (theo loại field), dùng cho `required`. */
export function isFieldEmpty(type: string, name: string, values: Values): boolean {
  switch (type) {
    case "link":
    case "linkOne":
    case "file":
    case "image":
      return isBlank(values[`${name}Id`]);
    case "linkParent":
      return isBlank(values[`${name}Id`]) || isBlank(values[`${name}Type`]);
    case "linkMultiple":
    case "attachmentMultiple":
      return isBlank(values[`${name}Ids`]);
    case "address":
      return ["Street", "City", "State", "Country", "PostalCode"].every((part) => isBlank(values[name + part]));
    case "personName": {
      const suffix = name.charAt(0).toUpperCase() + name.slice(1);

      return isBlank(values[`first${suffix}`]) && isBlank(values[`last${suffix}`]);
    }
    case "bool":
      return false;
    default:
      return isBlank(values[name]);
  }
}

/** Port `RegExpPatternHelper.validate`: `null` nếu hợp lệ, ngược lại là thông báo lỗi. */
export function validatePattern(
  pattern: string,
  value: unknown,
  label: string,
  metadata: Metadata,
  t: Translator,
): string | null {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  let messageKey = "fieldNotMatchingPattern";
  let source = pattern;

  if (pattern.startsWith("$")) {
    const name = pattern.slice(1);
    const found = (metadata.app as { regExpPatterns?: Record<string, { pattern?: string }> } | undefined)?.regExpPatterns?.[name]
      ?.pattern;

    if (found) {
      messageKey += `$${name}`;
      source = found;
    }
  }

  let regExp: RegExp;

  try {
    regExp = new RegExp(`^${source}$`);
  } catch {
    return null;
  }

  if (regExp.test(String(value))) {
    return null;
  }

  return interpolate(t(messageKey, "messages"), { pattern: source, field: label });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ValidationContext = {
  scope: string;
  metadata: Metadata;
  t: Translator;
  /** Dynamic logic có thể bật/tắt required. */
  isRequired?: (field: string, defs: FieldDefs) => boolean;
};

/** Kiểm tra một field; `null` = hợp lệ. */
export function validateField(field: string, values: Values, ctx: ValidationContext): string | null {
  const defs = getFieldDefs(ctx.metadata, ctx.scope, field);

  if (!defs || defs.readOnly) {
    return null;
  }

  const { t } = ctx;
  const label = t(field, "fields", ctx.scope);
  const required = ctx.isRequired ? ctx.isRequired(field, defs) : !!defs.required;

  if (required && isFieldEmpty(defs.type, field, values)) {
    return interpolate(t("fieldIsRequired", "messages"), { field: label });
  }

  const value = values[field];

  switch (defs.type) {
    case "varchar":
    case "text":
    case "url":
      return defs.pattern ? validatePattern(defs.pattern, value, label, ctx.metadata, t) : null;
    case "email": {
      const addresses = Array.isArray(values[`${field}Data`])
        ? (values[`${field}Data`] as { emailAddress?: string }[]).map((item) => item.emailAddress)
        : [value];

      return addresses.some((address) => typeof address === "string" && address !== "" && !EMAIL_PATTERN.test(address))
        ? interpolate(t("fieldShouldBeEmail", "messages"), { field: label })
        : null;
    }
    case "int":
    case "float":
    case "currency": {
      if (isBlank(value)) {
        return null;
      }

      if (typeof value !== "number" || !Number.isFinite(value) || (defs.type === "int" && !Number.isInteger(value))) {
        return interpolate(t(defs.type === "int" ? "fieldShouldBeInt" : "fieldShouldBeFloat", "messages"), { field: label });
      }

      const { min, max } = defs;

      if (typeof min === "number" && typeof max === "number" && (value < min || value > max)) {
        return interpolate(t("fieldShouldBeBetween", "messages"), { field: label, min, max });
      }

      if (typeof max === "number" && value > max) {
        return interpolate(t("fieldShouldBeLess", "messages"), { field: label, value: max });
      }

      if (typeof min === "number" && value < min) {
        return interpolate(t("fieldShouldBeGreater", "messages"), { field: label, value: min });
      }

      return null;
    }
    case "date":
    case "datetime":
    case "datetimeOptional": {
      if (isBlank(value)) {
        return null;
      }

      // Giá trị hệ thống (YYYY-MM-DD[ HH:mm:ss]) so sánh được dạng chuỗi.
      const other = (name: unknown) => (typeof name === "string" ? values[name] : undefined);
      const after = other(defs.after);
      const before = other(defs.before);

      if (typeof after === "string" && after && String(value) <= after) {
        return interpolate(t("fieldShouldAfter", "messages"), { field: label, otherField: t(String(defs.after), "fields", ctx.scope) });
      }

      if (typeof before === "string" && before && String(value) >= before) {
        return interpolate(t("fieldShouldBefore", "messages"), { field: label, otherField: t(String(defs.before), "fields", ctx.scope) });
      }

      return null;
    }
    case "address":
    case "personName": {
      // Pattern của từng phần (ví dụ $noBadCharacters của city/firstName).
      const parts = defs.type === "address" ? ["City", "State", "Country", "PostalCode"] : ["First", "Last", "Middle"];

      for (const part of parts) {
        const attribute = defs.type === "address" ? field + part : part.toLowerCase() + field.charAt(0).toUpperCase() + field.slice(1);
        const partDefs = (ctx.metadata.fields as Record<string, { fields?: Record<string, { pattern?: string }> }>)?.[defs.type]
          ?.fields?.[part.charAt(0).toLowerCase() + part.slice(1)];

        if (partDefs?.pattern) {
          const error = validatePattern(partDefs.pattern, values[attribute], label, ctx.metadata, t);

          if (error) {
            return error;
          }
        }
      }

      return null;
    }
    default:
      return null;
  }
}

/** Kiểm tra nhiều field; trả về map field → thông báo lỗi (chỉ các field lỗi). */
export function validateFields(fields: string[], values: Values, ctx: ValidationContext): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const error = validateField(field, values, ctx);

    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}
