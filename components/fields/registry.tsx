"use client";

// Registry loại field (đợt 1 của giai đoạn 2). Loại chưa hỗ trợ: hiện giá trị chỉ đọc + link mở ở classic.
import { classicHref } from "@/lib/espo/routes";
import {
  arrayField,
  autoincrementField,
  boolField,
  currencyConvertedField,
  currencyField,
  dateField,
  datetimeField,
  datetimeOptionalField,
  enumField,
  floatField,
  foreignField,
  intField,
  multiEnumField,
  numberField,
  textField,
  urlField,
  varcharField,
} from "./basic";
import { addressField, emailField, personNameField, phoneField } from "./composite";
import {
  arrayIntField,
  attachmentMultipleField,
  barcodeField,
  checklistField,
  colorpickerField,
  durationField,
  enumFloatField,
  enumIntField,
  fileField,
  jsonField,
  mapField,
  rangeField,
  urlMultipleField,
} from "./extra";
import { attendeesField, isOverdueField, remindersField } from "./event";
import { linkField, linkMultipleField, linkParentField } from "./link";
import type { FieldDefs } from "@/lib/espo/entity";
import type { FieldDisplayProps, FieldType, Values } from "./types";
import { wysiwygField } from "./wysiwyg";

const FIELD_TYPES: Record<string, FieldType> = {
  varchar: varcharField,
  text: textField,
  url: urlField,
  int: intField,
  float: floatField,
  number: numberField,
  autoincrement: autoincrementField,
  currency: currencyField,
  currencyConverted: currencyConvertedField,
  bool: boolField,
  enum: enumField,
  multiEnum: multiEnumField,
  array: arrayField,
  date: dateField,
  datetime: datetimeField,
  datetimeOptional: datetimeOptionalField,
  email: emailField,
  phone: phoneField,
  link: linkField,
  linkOne: linkField,
  linkParent: linkParentField,
  linkMultiple: linkMultipleField,
  address: addressField,
  personName: personNameField,
  foreign: foreignField,
  // Đợt 2
  enumInt: enumIntField,
  enumFloat: enumFloatField,
  arrayInt: arrayIntField,
  urlMultiple: urlMultipleField,
  checklist: checklistField,
  colorpicker: colorpickerField,
  rangeInt: rangeField,
  rangeFloat: rangeField,
  rangeCurrency: rangeField,
  jsonArray: jsonField,
  jsonObject: jsonField,
  barcode: barcodeField,
  map: mapField,
  duration: durationField,
  file: fileField,
  image: fileField,
  attachmentMultiple: attachmentMultipleField,
  wysiwyg: wysiwygField,
};

/** Loại field chưa hỗ trợ: hiện giá trị thô (chỉ đọc) và link mở bản ghi ở classic để sửa. */
function UnsupportedDisplay({ ctx, scope, name, values, mode }: FieldDisplayProps) {
  const raw = values[name];
  const text =
    raw === null || raw === undefined || raw === ""
      ? ""
      : typeof raw === "object"
        ? JSON.stringify(raw)
        : String(raw);
  const id = typeof values.id === "string" ? values.id : null;

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {text && <span className="line-clamp-3 break-all text-slate-700">{text}</span>}
      {mode === "detail" && id && (
        <a href={classicHref(`#${scope}/view/${encodeURIComponent(id)}`)} className="text-xs text-blue-600 hover:underline">
          <i className="fas fa-external-link-alt mr-1" aria-hidden />
          EspoCRM Classic
        </a>
      )}
      {!text && mode === "list" ? null : !text && <span className="sr-only">{ctx.t("None")}</span>}
    </span>
  );
}

const unsupportedField: FieldType = { Display: UnsupportedDisplay, hasValue: () => true };

/**
 * Field có view riêng của classic mà UI mới làm lại (thay cho `views` tuỳ biến trong entityDefs).
 * Key là `defs.view` đã bỏ tiền tố `crm:`/`modules/crm/`.
 */
const VIEW_TYPES: Record<string, FieldType> = {
  "views/meeting/fields/reminders": remindersField,
  "views/task/fields/is-overdue": isOverdueField,
};

function viewKey(view: string): string {
  return view.replace(/^crm:/, "").replace(/^modules\/crm\//, "");
}

/** Loại field theo defs: view riêng (nếu có) rồi tới `type`. Truyền chuỗi = chỉ theo type. */
export function getFieldType(defs: FieldDefs | string | undefined): FieldType {
  if (defs && typeof defs === "object") {
    const byView = defs.view ? VIEW_TYPES[viewKey(defs.view)] : undefined;

    if (byView) {
      return byView;
    }

    // linkMultiple có cột trạng thái (người tham dự Meeting/Call): hiện kèm trạng thái chấp nhận.
    if (defs.type === "linkMultiple" && (defs.columns as Record<string, string> | undefined)?.status) {
      return attendeesField;
    }

    return FIELD_TYPES[defs.type] || unsupportedField;
  }

  return (defs && FIELD_TYPES[defs]) || unsupportedField;
}

export function isFieldTypeSupported(type: string | undefined): boolean {
  return !!type && type in FIELD_TYPES;
}

export function fieldHasValue(defs: FieldDefs | string | undefined, name: string, values: Values): boolean {
  const fieldType = getFieldType(defs);

  if (fieldType.hasValue) {
    return fieldType.hasValue(name, values);
  }

  const value = values[name];

  return value !== null && value !== undefined && value !== "";
}

/** Hiển thị một field (list/detail). Detail rỗng → "None" mờ như classic. */
export function FieldValue(props: FieldDisplayProps) {
  const fieldType = getFieldType(props.defs);

  if (!fieldHasValue(props.defs, props.name, props.values)) {
    return props.mode === "detail" ? <span className="text-slate-400">{props.ctx.t("None")}</span> : null;
  }

  const Display = fieldType.Display;

  return <Display {...props} />;
}

/** Áp `onFormChange` của mọi field (ví dụ duration dời ngày kết thúc) sau khi form đổi giá trị. */
export function applyFormChange(
  fields: { name: string; defs: FieldDefs }[],
  previous: Values,
  next: Values,
): Values {
  let result = next;

  for (const field of fields) {
    const hook = getFieldType(field.defs).onFormChange;

    if (hook) {
      result = { ...result, ...hook(field.name, field.defs, previous, result) };
    }
  }

  return result;
}

/** Giá trị bổ sung khi mở form tạo mới (`onInit` của mọi field trong entity). */
export function initNewValues(fields: Record<string, FieldDefs>, values: Values): Values {
  let result = values;

  for (const [name, defs] of Object.entries(fields)) {
    const hook = getFieldType(defs).onInit;

    if (hook) {
      result = { ...result, ...hook(name, defs, result) };
    }
  }

  return result;
}

/** Attribute cần gửi khi lưu một field: attribute thật + attribute của field khác mà nó điều khiển. */
export function extraSaveAttributes(name: string, defs: FieldDefs): string[] {
  return getFieldType(defs).saveAttributes?.(name, defs) ?? [];
}

/** Attribute gửi lên server của các field (qua `prepareSave` nếu có). */
export function prepareValuesForSave(fields: { name: string; defs: FieldDefs }[], values: Values): Values {
  const result = { ...values };

  for (const field of fields) {
    const prepare = getFieldType(field.defs).prepareSave;

    if (prepare) {
      Object.assign(result, prepare(field.name, values));
    }
  }

  return result;
}
