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
