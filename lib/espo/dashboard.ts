// Dashboard: tab + lưới dashlet theo `preferences.dashboardLayout`, tuỳ chọn dashlet (`dashletsOptions`).
// Port từ `views/dashboard`, `views/dashlets/abstract/base|record-list` của classic.
import type { Acl } from "./acl";
import { buildWhere, type AdvancedFilter, type SearchParams } from "./search";
import type { EspoUser, Metadata, Preferences, Settings } from "./types";

export type DashletLayoutItem = { id: string; name: string; x: number; y: number; width: number; height: number };

export type DashboardTab = { name: string; layout: DashletLayoutItem[] };

export type ExpandedLayout = { rows: { name: string; link?: boolean; soft?: boolean; small?: boolean }[][] };

export type DashletOptions = Record<string, unknown> & {
  title?: string;
  displayRecords?: number;
  autorefreshInterval?: number | null;
  entityType?: string;
  expandedLayout?: ExpandedLayout;
};

type DashletDefs = {
  view?: string;
  aclScope?: string;
  entityType?: string;
  options?: { defaults?: Record<string, unknown> };
  accessDataList?: { inPortalDisabled?: boolean; isAdminOnly?: boolean; scope?: string; action?: string }[];
};

function isTabList(value: unknown): value is DashboardTab[] {
  return Array.isArray(value) && value.length > 0 && value.every((tab) => tab && typeof tab === "object");
}

/** Tab của dashboard: layout ép (`forcedDashboardLayout`) → portal dùng của Settings → của người dùng. */
export function resolveDashboardLayout(settings: Settings, preferences: Preferences, user: EspoUser): DashboardTab[] {
  const candidates = [settings.forcedDashboardLayout, user.portalId ? settings.dashboardLayout : preferences.dashboardLayout];
  const value = candidates.find((item) => item !== undefined && item !== null && (!Array.isArray(item) || item === candidates[1] || item.length));

  if (!isTabList(value)) {
    return [{ name: "My Espo", layout: [] }];
  }

  return value.map((tab) => ({
    name: String(tab.name ?? ""),
    layout: (Array.isArray(tab.layout) ? tab.layout : [])
      .filter((item) => item && typeof item.id === "string" && typeof item.name === "string")
      .map((item) => ({
        id: item.id,
        name: item.name,
        x: Number(item.x) || 0,
        y: Number(item.y) || 0,
        width: Math.max(1, Number(item.width) || 2),
        height: Math.max(1, Number(item.height) || 2),
      }))
      // Như GridStack.Utils.sort: theo hàng rồi cột (thứ tự đọc trên màn hình nhỏ).
      .sort((a, b) => a.y - b.y || a.x - b.x),
  }));
}

export function dashletDefs(metadata: Metadata, name: string): DashletDefs | null {
  return ((metadata.dashlets as Record<string, DashletDefs> | undefined)?.[name] ?? null) as DashletDefs | null;
}

/** Tuỳ chọn của một dashlet: mặc định trong metadata, ghi đè bởi `preferences.dashletsOptions[id]`. */
export function dashletOptions(metadata: Metadata, preferences: Preferences, item: DashletLayoutItem): DashletOptions {
  const defaults = dashletDefs(metadata, item.name)?.options?.defaults ?? {};
  const own = ((preferences.dashletsOptions as Record<string, Record<string, unknown>> | undefined)?.[item.id] ?? {}) as Record<string, unknown>;

  return { ...defaults, ...own } as DashletOptions;
}

/** Người dùng được xem dashlet không (aclScope, accessDataList). */
export function dashletAllowed(metadata: Metadata, acl: Acl, user: EspoUser, name: string): boolean {
  const defs = dashletDefs(metadata, name);

  if (!defs) {
    return false;
  }

  if (defs.aclScope && !acl.checkScope(defs.aclScope, "read")) {
    return false;
  }

  return (defs.accessDataList ?? []).every((item) => {
    if (item.inPortalDisabled && user.type === "portal") {
      return false;
    }

    if (item.isAdminOnly && !acl.isAdmin()) {
      return false;
    }

    return !item.scope || acl.checkScope(item.scope, (item.action as "read" | undefined) ?? "read");
  });
}

/** Entity của dashlet danh sách: cố định trong metadata (Tasks, Cases…) hoặc theo tuỳ chọn (Records). */
export function dashletEntityType(metadata: Metadata, name: string, options: DashletOptions): string | null {
  const own = dashletDefs(metadata, name)?.entityType;

  return own ?? (typeof options.entityType === "string" && options.entityType ? options.entityType : null);
}

type SearchData = { bool?: Record<string, boolean>; primary?: string; advanced?: Record<string, AdvancedFilter> };

/**
 * `searchParams` cho dashlet danh sách (port `getSearchData` + `search-manager`): bộ lọc có sẵn của dashlet
 * (`searchData`) hoặc tuỳ chọn primaryFilter/boolFilterList của dashlet Records; sắp xếp theo orderBy/sortBy.
 */
export function dashletSearchParams(
  options: DashletOptions,
  ctx: { metadata: Metadata; scope: string; timeZone: string | null },
): SearchParams {
  const data: SearchData = structuredClone((options.searchData as SearchData | undefined) ?? {});
  const hasCollaborators = !!(ctx.metadata.scopes?.[ctx.scope] as Record<string, unknown> | undefined)?.collaborators;

  if (options.includeShared && hasCollaborators) {
    data.bool = { ...data.bool, shared: true };
  }

  const params: SearchParams = {};
  const primary = (typeof options.primaryFilter === "string" && options.primaryFilter) || data.primary;
  const bool = [
    ...Object.entries(data.bool ?? {})
      .filter(([, on]) => on)
      .map(([name]) => name),
    ...(Array.isArray(options.boolFilterList) ? options.boolFilterList.map(String) : []),
  ];
  const where = buildWhere(data.advanced ?? {}, ctx.timeZone);

  if (primary) {
    params.primaryFilter = primary;
  }

  if (bool.length) {
    params.boolFilterList = [...new Set(bool)];
  }

  if (where.length) {
    params.where = where;
  }

  const orderBy = (options.orderBy ?? options.sortBy) as string | undefined;

  if (orderBy) {
    params.orderBy = orderBy;
    params.order = "asc";
  }

  for (const key of ["sortDirection", "order"] as const) {
    if (options[key] === "asc" || options[key] === "desc") {
      params.order = options[key] as "asc" | "desc";
    }
  }

  params.maxSize = typeof options.displayRecords === "number" ? options.displayRecords : 5;

  return params;
}

/** Field cần `select` theo layout mở rộng của dashlet. */
export function expandedLayoutFields(layout: ExpandedLayout | undefined): string[] {
  return [...new Set((layout?.rows ?? []).flat().map((cell) => cell.name))];
}

/** Chu kỳ tự làm mới (phút → ms); 0/null = không tự làm mới. */
export function autorefreshMs(options: DashletOptions): number | false {
  const minutes = Number(options.autorefreshInterval ?? 0);

  return minutes > 0 ? minutes * 60_000 : false;
}
