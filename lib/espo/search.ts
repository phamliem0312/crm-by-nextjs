// Trạng thái tìm kiếm/lọc của list và `searchParams` gửi lên API. Port từ `search-manager` của UI classic
// (espo-main.js @10964). Trạng thái được giữ trên URL để chia sẻ link/quay lại đúng bộ lọc.

/** Bộ lọc nâng cao của một field (giống `AdvancedFilter` của classic). */
export type AdvancedFilter = {
  type: string;
  value?: unknown;
  attribute?: string;
  /** Tên cũ của `attribute` (classic vẫn dùng trong nhóm or/and). */
  field?: string;
  /** Lọc datetime: server cần timeZone để hiểu "hôm nay", "tuần này"… */
  dateTime?: boolean;
  date?: boolean;
  /** Dữ liệu riêng của UI (ví dụ tên của link đã chọn) — không gửi lên server. */
  data?: Record<string, unknown>;
};

export type SearchState = {
  textFilter: string;
  primary: string | null;
  bool: string[];
  advanced: Record<string, AdvancedFilter>;
};

export type SortState = { orderBy: string | null; order: "asc" | "desc" | null };

export type ListState = SearchState & SortState & { page: number };

export type WhereItem = {
  type: string;
  attribute?: string;
  value?: unknown;
  dateTime?: boolean;
  date?: boolean;
  timeZone?: string;
};

/** Body JSON của tham số `searchParams` (xem `SearchParamsFetcher` phía Espo). */
export type SearchParams = {
  select?: string[];
  maxSize?: number;
  offset?: number;
  orderBy?: string;
  order?: "asc" | "desc";
  textFilter?: string;
  primaryFilter?: string;
  boolFilterList?: string[];
  where?: WhereItem[];
};

export const EMPTY_SEARCH: SearchState = { textFilter: "", primary: null, bool: [], advanced: {} };

/** Port `SearchManager.getWherePart`. */
export function getWherePart(name: string, filter: AdvancedFilter, timeZone: string | null): WhereItem | null {
  // `data.incomplete`: người dùng đang nhập dở (chưa có giá trị) — chưa gửi lên server.
  if (!filter || typeof filter !== "object" || !filter.type || filter.data?.incomplete) {
    return null;
  }

  if (filter.type === "or" || filter.type === "and") {
    // Classic dùng cả object (field → filter) lẫn mảng filter có `attribute`/`field`.
    const value = (filter.value ?? {}) as Record<string, AdvancedFilter> | AdvancedFilter[];
    const entries: [string, AdvancedFilter][] = Array.isArray(value)
      ? value.map((item) => [item?.attribute ?? item?.field ?? name, item])
      : Object.entries(value);
    const items = entries
      .map(([field, item]) => getWherePart(field, item, timeZone))
      .filter((item): item is WhereItem => item !== null);

    return { type: filter.type, value: items };
  }

  const part: WhereItem = { type: filter.type, attribute: filter.attribute ?? filter.field ?? name };

  if (filter.value !== undefined) {
    part.value = filter.value;
  }

  if (filter.dateTime || filter.date) {
    if (filter.dateTime) {
      part.dateTime = true;
    }

    if (filter.date) {
      part.date = true;
    }

    if (timeZone) {
      part.timeZone = timeZone;
    }
  }

  return part;
}

/** `where` cho các bộ lọc nâng cao. */
export function buildWhere(advanced: Record<string, AdvancedFilter>, timeZone: string | null): WhereItem[] {
  return Object.entries(advanced)
    .map(([name, filter]) => getWherePart(name, filter, timeZone))
    .filter((item): item is WhereItem => item !== null);
}

export function buildSearchParams(
  state: Partial<ListState>,
  options: { select?: string[]; maxSize?: number; offset?: number; timeZone?: string | null } = {},
): SearchParams {
  const params: SearchParams = {};

  if (options.select) {
    params.select = options.select;
  }

  if (options.maxSize !== undefined) {
    params.maxSize = options.maxSize;
  }

  if (options.offset !== undefined) {
    params.offset = options.offset;
  }

  if (state.orderBy) {
    params.orderBy = state.orderBy;
    params.order = state.order ?? "asc";
  }

  if (state.textFilter) {
    params.textFilter = state.textFilter;
  }

  if (state.primary) {
    params.primaryFilter = state.primary;
  }

  if (state.bool?.length) {
    params.boolFilterList = state.bool;
  }

  const where = buildWhere(state.advanced ?? {}, options.timeZone ?? null);

  if (where.length) {
    params.where = where;
  }

  return params;
}

/** Query string `searchParams=<json>` cho `GET <Scope>` / `GET <Scope>/:id/:link`. */
export function searchParamsQuery(params: SearchParams): string {
  return `searchParams=${encodeURIComponent(JSON.stringify(params))}`;
}

const URL_KEYS = { text: "q", primary: "filter", bool: "bool", advanced: "where", orderBy: "orderBy", order: "order", page: "page" };

function parseAdvanced(value: string | null): Record<string, AdvancedFilter> {
  if (!value) {
    return {};
  }

  try {
    const data: unknown = JSON.parse(value);

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).filter(
        (entry): entry is [string, AdvancedFilter] =>
          !!entry[1] && typeof entry[1] === "object" && typeof (entry[1] as AdvancedFilter).type === "string",
      ),
    );
  } catch {
    return {};
  }
}

/** Đọc trạng thái list từ URL; giá trị lỗi thì bỏ qua (dùng mặc định). */
export function parseListState(params: URLSearchParams, defaults: SortState = { orderBy: null, order: null }): ListState {
  const order = params.get(URL_KEYS.order);
  const page = Number.parseInt(params.get(URL_KEYS.page) ?? "", 10);

  return {
    textFilter: params.get(URL_KEYS.text) ?? "",
    primary: params.get(URL_KEYS.primary) || null,
    bool: (params.get(URL_KEYS.bool) ?? "").split(",").filter(Boolean),
    advanced: parseAdvanced(params.get(URL_KEYS.advanced)),
    orderBy: params.get(URL_KEYS.orderBy) || defaults.orderBy,
    order: order === "asc" || order === "desc" ? order : defaults.order,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Ghi trạng thái list ra URL; bỏ các giá trị mặc định cho gọn. */
export function serializeListState(state: ListState, defaults: SortState = { orderBy: null, order: null }): URLSearchParams {
  const params = new URLSearchParams();

  if (state.textFilter) {
    params.set(URL_KEYS.text, state.textFilter);
  }

  if (state.primary) {
    params.set(URL_KEYS.primary, state.primary);
  }

  if (state.bool.length) {
    params.set(URL_KEYS.bool, state.bool.join(","));
  }

  if (Object.keys(state.advanced).length) {
    params.set(URL_KEYS.advanced, JSON.stringify(state.advanced));
  }

  if (state.orderBy && (state.orderBy !== defaults.orderBy || state.order !== defaults.order)) {
    params.set(URL_KEYS.orderBy, state.orderBy);
    params.set(URL_KEYS.order, state.order ?? "asc");
  }

  if (state.page > 1) {
    params.set(URL_KEYS.page, String(state.page));
  }

  return params;
}

/** Có bộ lọc nào đang bật không (để hiện nút "Reset"). */
export function hasActiveSearch(state: SearchState): boolean {
  return !!state.textFilter || !!state.primary || state.bool.length > 0 || Object.keys(state.advanced).length > 0;
}
