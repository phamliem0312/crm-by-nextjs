// Nhập dữ liệu từ CSV: entity nhập được, đọc CSV (xem trước), danh sách attribute để ghép cột, nhãn của attribute,
// tham số nhập và kết quả. Port từ `views/import/step1`, `views/import/step2`, `views/import/detail` của classic.
import type { Acl } from "./acl";
import { espoFetch, espoGet } from "./client";
import { getActualAttributeList, getEntityDefs, getFieldDefs } from "./entity";
import { EspoApiError } from "./errors";
import type { Translator } from "./i18n";
import { sendRequest, type EspoRecord } from "./records";
import type { Metadata, Preferences, Settings } from "./types";

export type ImportAction = "create" | "createAndUpdate" | "update";

/** Tham số bước 1 (giống `formData` của classic). */
export type ImportParams = {
  entityType: string | null;
  action: ImportAction;
  headerRow: boolean;
  delimiter: string;
  textQualifier: string;
  dateFormat: string;
  timeFormat: string;
  currency: string | null;
  timezone: string;
  decimalMark: string;
  personNameFormat: string;
  idleMode: boolean;
  skipDuplicateChecking: boolean;
  silentMode: boolean;
  manualMode: boolean;
  phoneNumberCountry?: string | null;
};

/** Tham số lưu được làm mặc định (`preferences.importParams.default`). */
export const IMPORT_PARAM_KEYS = [
  "headerRow",
  "decimalMark",
  "personNameFormat",
  "delimiter",
  "dateFormat",
  "timeFormat",
  "currency",
  "timezone",
  "textQualifier",
  "silentMode",
  "idleMode",
  "skipDuplicateChecking",
  "manualMode",
  "phoneNumberCountry",
] as const;

export const DELIMITERS = [",", ";", "\\t", "|"];

export function defaultImportParams(settings: Settings, preferences: Preferences, entityType: string | null = null): ImportParams {
  const params: ImportParams = {
    entityType,
    action: "create",
    headerRow: true,
    delimiter: ",",
    textQualifier: '"',
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm:ss",
    currency: typeof settings.defaultCurrency === "string" ? settings.defaultCurrency : null,
    timezone: "UTC",
    decimalMark: ".",
    personNameFormat: "f l",
    idleMode: false,
    skipDuplicateChecking: false,
    silentMode: true,
    manualMode: false,
  };
  const stored = ((preferences.importParams as { default?: Record<string, unknown> } | undefined)?.default ?? {}) as Record<string, unknown>;

  for (const key of IMPORT_PARAM_KEYS) {
    if (stored[key] !== undefined) {
      (params as Record<string, unknown>)[key] = stored[key];
    }
  }

  return params;
}

/** Entity nhập được (`importable`) và được tạo, sắp theo tên đã dịch. */
export function importableScopes(metadata: Metadata, acl: Acl, t: Translator): string[] {
  return Object.entries(metadata.scopes ?? {})
    .filter(([scope, defs]) => (defs as Record<string, unknown>).importable && !defs.disabled && acl.checkScope(scope, "create"))
    .map(([scope]) => scope)
    .sort((a, b) => t(a, "scopeNamesPlural").localeCompare(t(b, "scopeNamesPlural")));
}

/** Cách ghi họ tên; thêm dạng có tên đệm nếu hệ thống dùng tên đệm. */
export function personNameFormats(settings: Settings): string[] {
  const list = ["f l", "l f", "l, f"];

  if (String(settings.personNameFormat ?? "firstLast").toLowerCase().includes("middle")) {
    list.push("f m l", "l f m");
  }

  return list;
}

/** `DD.MM.YYYY` → `DD.MM.YYYY · 27.12.2021` (`convertFormatToLabel`). */
export function formatSample(format: string): string {
  const samples: [string, string][] = [
    ["YYYY", "2021"],
    ["DD", "27"],
    ["MM", "12"],
    ["HH", "23"],
    ["mm", "00"],
    ["hh", "11"],
    ["ss", "00"],
    ["a", "pm"],
    ["A", "PM"],
  ];
  let label = format;

  for (const [token, value] of samples) {
    label = label.replaceAll(token, value);
  }

  return `${format} · ${label}`;
}

/** Đọc CSV (port `csvToArray` của classic, hỗ trợ ô có dấu phân cách/xuống dòng trong dấu nháy). */
export function csvToArray(data: string, delimiter = ",", qualifier = '"'): string[][] {
  const d = delimiter.replace(/\\t/, "\t");
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const q = escape(qualifier);
  const dl = escape(d);
  const pattern = new RegExp(`(${dl}|\\r?\\n|\\r|^)(?:${q}([^${q}]*(?:${q}${q}[^${q}]*)*)${q}|([^${q}${dl}\\r\\n]*))`, "gi");
  const rows: string[][] = [[]];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(data))) {
    const matchedDelimiter = match[1];

    if (matchedDelimiter.length && matchedDelimiter !== d) {
      rows.push([]);
    }

    const value = match[2] !== undefined ? match[2].replace(new RegExp(`${q}${q}`, "g"), qualifier) : match[3];

    rows[rows.length - 1].push(value);

    // Chuỗi rỗng khớp được ở cuối → tránh lặp vô hạn.
    if (match[0].length === 0) {
      pattern.lastIndex++;
    }
  }

  return rows;
}

/** Field cho phép nhập (bỏ field bị cấm sửa, utility, tắt…), giống `getFieldList` của bước 2. */
const ALLOWED_FIELDS = ["createdAt", "createdBy"];

function isImportableField(defs: Record<string, unknown>, field: string): boolean {
  if (ALLOWED_FIELDS.includes(field)) {
    return true;
  }

  return !(
    defs.disabled ||
    defs.importDisabled ||
    defs.utility ||
    (defs.directAccessDisabled && !defs.importEnabled) ||
    (defs.directUpdateDisabled && !defs.importEnabled && !defs.directUpdateEnabled)
  );
}

export function importFieldList(metadata: Metadata, scope: string, acl: Acl, t: Translator): string[] {
  const forbidden = acl.getScopeForbiddenFieldList(scope, "edit");

  return Object.entries(getEntityDefs(metadata, scope).fields ?? {})
    .filter(([field, defs]) => !forbidden.includes(field) && isImportableField(defs as Record<string, unknown>, field))
    .map(([field]) => field)
    .sort((a, b) => t(a, "fields", scope).localeCompare(t(b, "fields", scope)));
}

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Attribute ghép được với cột CSV (`getAttributeList` của bước 2): id, attribute của field, số điện thoại theo loại… */
export function importAttributeList(metadata: Metadata, scope: string, acl: Acl, t: Translator): string[] {
  const forbidden = acl.getScopeForbiddenFieldList(scope, "edit");
  const list: string[] = ["id"];
  const add = (attribute: string) => {
    if (!list.includes(attribute)) {
      list.push(attribute);
    }
  };

  for (const [field, raw] of Object.entries(getEntityDefs(metadata, scope).fields ?? {})) {
    const defs = raw as Record<string, unknown> & { type: string };

    if (forbidden.includes(field) || !isImportableField(defs, field)) {
      continue;
    }

    if (defs.type === "phone") {
      add(field);

      for (const type of (Array.isArray(defs.typeList) ? defs.typeList : []).map(String)) {
        add(field + upperFirst(type.replace(/\s/g, "_")));
      }

      continue;
    }

    if (defs.type === "email") {
      add(`${field}2`);
      add(`${field}3`);
      add(`${field}4`);
    }

    if (defs.type === "link") {
      add(`${field}Name`);
      add(`${field}Id`);
    }

    if (defs.type === "foreign" && !defs.relateOnImport) {
      continue;
    }

    if (defs.type === "personName") {
      add(field);
    }

    const actual = getActualAttributeList(metadata, defs.type, field);

    (actual.length ? actual : [field]).forEach(add);
  }

  return list.sort((a, b) => t(a, "fields", scope).localeCompare(t(b, "fields", scope)));
}

/** Nhãn của một attribute trong ô chọn cột (`getFieldDropdown`): field, `(id)`, `(name)`, điện thoại theo loại… */
export function importAttributeLabel(attribute: string, scope: string, metadata: Metadata, t: Translator): string {
  const has = (name: string) => Object.hasOwn(t.data[scope]?.fields ?? {}, name) || Object.hasOwn(t.data.Global?.fields ?? {}, name);

  if (has(attribute)) {
    return t(attribute, "fields", scope);
  }

  const base = (suffix: string) => attribute.slice(0, attribute.length - suffix.length);
  const withBase = (suffix: string, label: string) =>
    attribute.endsWith(suffix) && getFieldDefs(metadata, scope, base(suffix)) ? `${t(base(suffix), "fields", scope)} (${t(label, "fields")})` : null;

  const byId = withBase("Id", "id");

  if (byId) {
    return byId;
  }

  const byName = withBase("Name", "name");

  if (byName) {
    return byName;
  }

  const byType = withBase("Type", "type");

  if (byType) {
    return byType;
  }

  if (attribute.startsWith("phoneNumber")) {
    return `${t("phoneNumber", "fields", scope)} (${t.option(attribute.slice(11), "phoneNumber", scope)})`;
  }

  const emailNumber = attribute.slice(12);

  if (attribute.startsWith("emailAddress") && String(Number.parseInt(emailNumber, 10)) === emailNumber) {
    return `${t("emailAddress", "fields", scope)} ${emailNumber}`;
  }

  return withBase("Ids", "ids") ?? attribute;
}

/** Attribute tự chọn cho cột theo tiêu đề (`name` trùng hoặc bỏ `_`/hoa thường). */
export function guessAttribute(header: string | undefined, attributes: string[]): string | null {
  if (!header) {
    return null;
  }

  const normalized = header.toLowerCase().replace(/_/g, "");

  return attributes.find((attribute) => attribute === header) ?? attributes.find((attribute) => attribute.toLowerCase() === normalized) ?? null;
}

export type ImportMapping = { header: string | null; value: string };

/** Dòng ghép cột: tiêu đề (nếu có dòng tiêu đề) + giá trị dòng dữ liệu đầu. */
export function mappingRows(preview: string[][], headerRow: boolean): ImportMapping[] {
  const index = headerRow ? 1 : 0;

  if (preview.length <= index) {
    return [];
  }

  return preview[index].map((value, i) => ({ header: headerRow ? (preview[0][i] ?? null) : null, value: value ?? "" }));
}

export type ImportRequest = ImportParams & {
  attributeList: (string | null)[];
  updateBy?: number[];
  defaultValues?: Record<string, unknown>;
  defaultFieldList?: string[];
};

/** Tải nội dung CSV lên (`POST Import/file`, body thô `text/csv`). */
export async function uploadImportFile(contents: string): Promise<string> {
  const response = await espoFetch("Import/file", { method: "POST", headers: { "Content-Type": "text/csv" }, body: contents });

  if (!response.ok) {
    throw await EspoApiError.fromResponse(response);
  }

  const result = (await response.json()) as { attachmentId?: string };

  if (!result.attachmentId) {
    throw new Error("Bad response");
  }

  return result.attachmentId;
}

/** Chạy nhập (`POST Import`); trả về id của bản ghi Import. */
export function runImport(request: ImportRequest, attachmentId: string): Promise<{ id: string }> {
  return sendRequest("POST", "Import", { ...request, attachmentId });
}

/** Import đang chạy (cần hỏi lại trạng thái). */
export const isImportRunning = (status: unknown) => ["In Process", "Pending", "Standby"].includes(String(status ?? ""));

export const revertImport = (id: string) => sendRequest("POST", `Import/${encodeURIComponent(id)}/revert`);

export const removeImportDuplicates = (id: string) => sendRequest("POST", `Import/${encodeURIComponent(id)}/removeDuplicates`);

export const unmarkImportDuplicate = (id: string, entityType: string, entityId: string) =>
  sendRequest("POST", `Import/${encodeURIComponent(id)}/unmarkDuplicates`, { entityId, entityType });

/** Xuất các dòng lỗi ra CSV (`POST Import/:id/exportErrors` → attachment để tải). */
export const exportImportErrors = (id: string) => sendRequest<{ attachmentId: string }>("POST", `Import/${encodeURIComponent(id)}/exportErrors`);

export function getImport(id: string, signal?: AbortSignal): Promise<EspoRecord> {
  return espoGet<EspoRecord>(`Import/${encodeURIComponent(id)}`, { signal });
}

/** Lưu tham số làm mặc định (`preferences.importParams.default`). */
export function saveImportDefaults(userId: string, preferences: Preferences, params: ImportParams): Promise<unknown> {
  const current = (preferences.importParams as Record<string, unknown> | undefined) ?? {};
  const data = Object.fromEntries(IMPORT_PARAM_KEYS.map((key) => [key, params[key] ?? null]));

  return sendRequest("PUT", `Preferences/${encodeURIComponent(userId)}`, { importParams: { ...current, default: data } });
}
