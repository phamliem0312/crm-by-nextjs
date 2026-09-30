/** Dữ liệu trả về từ `GET I18n`: scope → category → label → bản dịch. */
export type LanguageData = Record<string, Record<string, Record<string, unknown>>>;

function get(data: LanguageData, scope: string, category: string, name: string): unknown {
  const categoryData = data[scope]?.[category];

  if (categoryData && Object.hasOwn(categoryData, name)) {
    return categoryData[name];
  }

  return scope === "Global" ? name : false;
}

/**
 * Dịch một nhãn. Không có trong `scope` thì tìm ở `Global`, không có nữa thì trả về chính `name`.
 * Port từ `Language.translate` của UI classic.
 */
export function translate(
  data: LanguageData,
  name: string,
  category = "labels",
  scope = "Global",
): string {
  let result = get(data, scope, category, name);

  if (result === false && scope !== "Global") {
    result = get(data, "Global", category, name);
  }

  return typeof result === "string" ? result : name;
}

/** Lấy giá trị theo đường dẫn, ví dụ `["Global", "lists", "monthNames"]`. Giống `Language.translatePath`. */
export function translatePath(data: LanguageData, path: string[]): unknown {
  let value: unknown = data;

  for (const key of path) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, key)) {
      return path.join(".");
    }

    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/** Dịch một giá trị option của field enum. Giống `Language.translateOption`. */
export function translateOption(data: LanguageData, value: string, field: string, scope = "Global"): string {
  let options = data[scope]?.options?.[field];

  if ((!options || typeof options !== "object") && scope !== "Global") {
    options = data.Global?.options?.[field];
  }

  const translated = options && typeof options === "object" ? (options as Record<string, unknown>)[value] : undefined;

  return typeof translated === "string" && translated !== "" ? translated : value;
}

/** Thay `{key}` trong chuỗi bằng giá trị tương ứng. */
export function interpolate(text: string, values: Record<string, string | number>): string {
  let result = text;

  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{${key}}`, String(value));
  }

  return result;
}

export type Translator = {
  (name: string, category?: string, scope?: string): string;
  data: LanguageData;
  option: (value: string, field: string, scope?: string) => string;
  path: (path: string[]) => unknown;
};

export function createTranslator(data: LanguageData): Translator {
  const t = ((name: string, category?: string, scope?: string) => translate(data, name, category, scope)) as Translator;

  t.data = data;
  t.option = (value, field, scope) => translateOption(data, value, field, scope);
  t.path = (path) => translatePath(data, path);

  return t;
}
