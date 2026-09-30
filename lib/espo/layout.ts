// Chuẩn hoá layout của Espo (list, detail, bottomPanelsDetail, defaultSidePanel) thành cấu trúc cho UI.
// Port từ `views/record/detail` (convert layout @17579), `detail-side` (@41806) và `list` của UI classic.
import type { Acl } from "./acl";
import { getEntityDefs, getFieldDefs, isFieldAvailable, isFieldSortable } from "./entity";
import type { Translator } from "./i18n";
import type { Metadata } from "./types";

export type ListLayoutItem = {
  name: string;
  link?: boolean;
  width?: number;
  widthPx?: number;
  notSortable?: boolean;
  hidden?: boolean;
  align?: "left" | "right";
  customLabel?: string;
  noLabel?: boolean;
  view?: string;
};

export type DetailLayoutCell = {
  name?: string;
  fullWidth?: boolean;
  noLabel?: boolean;
  customLabel?: string;
  view?: string | { name?: string };
  span?: number;
};

export type DetailLayoutPanel = {
  label?: string;
  customLabel?: string;
  name?: string;
  rows?: (DetailLayoutCell | false)[][];
  columns?: (DetailLayoutCell | false)[][];
  tabBreak?: boolean;
  tabLabel?: string;
  style?: string;
  hidden?: boolean;
  noteText?: string;
  dynamicLogicVisible?: { conditionGroup?: unknown[] };
  dynamicLogicStyled?: { conditionGroup?: unknown[] };
};

export type BottomPanelsLayout = Record<
  string,
  { index?: number; tabBreak?: boolean; tabLabel?: string; disabled?: boolean; sticked?: boolean }
>;

export type ListColumn = {
  name: string;
  label: string;
  /** Link tới trang chi tiết (thường là cột `name`). */
  link: boolean;
  sortable: boolean;
  width: number | null;
  widthPx: number | null;
  align: "left" | "right";
};

/** Cột của list: bỏ cột ẩn, field không tồn tại/không được đọc. */
export function buildListColumns(
  layout: ListLayoutItem[],
  ctx: { scope: string; metadata: Metadata; acl: Acl; t: Translator },
): ListColumn[] {
  return layout
    .filter(
      (item) =>
        item?.name &&
        !item.hidden &&
        isFieldAvailable(ctx.metadata, ctx.scope, item.name) &&
        ctx.acl.checkField(ctx.scope, item.name),
    )
    .map((item) => ({
      name: item.name,
      label: item.noLabel
        ? ""
        : item.customLabel
          ? item.customLabel
          : ctx.t(item.name, "fields", ctx.scope),
      link: !!item.link,
      sortable: !item.notSortable && isFieldSortable(ctx.metadata, ctx.scope, item.name),
      width: typeof item.width === "number" ? item.width : null,
      widthPx: typeof item.widthPx === "number" ? item.widthPx : null,
      align: item.align === "right" ? "right" : "left",
    }));
}

export type DetailCell = {
  name: string;
  label: string;
  noLabel: boolean;
  fullWidth: boolean;
};

export type DetailPanel = {
  name: string;
  label: string | null;
  tabNumber: number;
  tabLabel: string | null;
  style: string;
  /** Panel `hidden` trong layout: nằm dưới nút "Show more". */
  underShowMore: boolean;
  noteText: string | null;
  /** Hàng; `null` = ô trống. */
  rows: (DetailCell | null)[][];
  dynamicLogicVisible?: { conditionGroup?: unknown[] };
};

function panelLabel(item: DetailLayoutPanel, scope: string, t: Translator): string | null {
  if (item.customLabel !== undefined) {
    return item.customLabel ? t(item.customLabel, "panelCustomLabels", scope) : null;
  }

  if (!item.label) {
    return null;
  }

  return item.label.startsWith("$") ? t(item.label.slice(1), "panels", scope) : t(item.label, "labels", scope);
}

/** Nhãn tab: `$Label` → `tabs`, `$label:Label` → `labels` (giống classic). */
export function translateTabLabel(label: string | undefined, scope: string, t: Translator): string | null {
  if (!label) {
    return null;
  }

  if (label.startsWith("$label:")) {
    return t(label.slice(7), "labels", scope);
  }

  return label.startsWith("$") ? t(label.slice(1), "tabs", scope) : label;
}

/**
 * Panel và ô của layout detail. Ô không có field/không được đọc thành ô trống; hàng/panel rỗng bị bỏ.
 */
export function buildDetailPanels(
  layout: DetailLayoutPanel[],
  ctx: { scope: string; metadata: Metadata; acl: Acl; t: Translator },
): DetailPanel[] {
  let tabNumber = -1;
  const panels: DetailPanel[] = [];

  layout.forEach((item, index) => {
    if (item.tabBreak || index === 0) {
      tabNumber++;
    }

    const rows = (item.rows ?? item.columns ?? [])
      .map((row) =>
        row.map((cell): DetailCell | null => {
          if (!cell) {
            return null;
          }

          const name = cell.name ?? (typeof cell.view === "object" ? cell.view?.name : undefined);

          if (!name || !getFieldDefs(ctx.metadata, ctx.scope, name) || !isFieldAvailable(ctx.metadata, ctx.scope, name)) {
            return null;
          }

          if (!ctx.acl.checkField(ctx.scope, name)) {
            return null;
          }

          return {
            name,
            label: cell.customLabel ?? ctx.t(name, "fields", ctx.scope),
            noLabel: !!cell.noLabel,
            fullWidth: !!cell.fullWidth,
          };
        }),
      )
      .filter((row) => row.some((cell) => cell !== null));

    if (!rows.length) {
      return;
    }

    panels.push({
      name: item.name || `panel-${index}`,
      label: panelLabel(item, ctx.scope, ctx.t),
      tabNumber,
      tabLabel: item.tabBreak || index === 0 ? translateTabLabel(item.tabLabel, ctx.scope, ctx.t) : null,
      style: item.style || "default",
      underShowMore: !!item.hidden && tabNumber === 0,
      noteText: item.noteText
        ? item.noteText.startsWith("$") && !item.noteText.includes(" ")
          ? ctx.t(item.noteText.slice(1), "panelNotes", ctx.scope)
          : item.noteText
        : null,
      rows,
      dynamicLogicVisible: item.dynamicLogicVisible,
    });
  });

  return panels;
}

/** Tất cả field xuất hiện trong các panel (để `select` khi tải bản ghi). */
export function detailFieldNames(panels: DetailPanel[]): string[] {
  return [...new Set(panels.flatMap((panel) => panel.rows.flat().filter((c): c is DetailCell => !!c).map((c) => c.name)))];
}

/**
 * Field của side panel mặc định (layout `defaultSidePanel`, mặc định `:assignedUser`, `teams`).
 * `:assignedUser` → `assignedUsers` nếu entity có, không thì `assignedUser`.
 */
export function buildDefaultSideFields(
  layout: (string | { name?: string })[] | null | undefined,
  ctx: { scope: string; metadata: Metadata; acl: Acl },
): string[] {
  const items = layout ?? [{ name: ":assignedUser" }, { name: "teams" }];
  const fields = getEntityDefs(ctx.metadata, ctx.scope).fields ?? {};

  return items
    .map((item) => (typeof item === "string" ? item : (item?.name ?? "")))
    .map((name) => {
      if (name !== ":assignedUser") {
        return name;
      }

      if (fields.assignedUsers) {
        return "assignedUsers";
      }

      return fields.assignedUser ? "assignedUser" : "";
    })
    .filter(
      (name) =>
        !!name &&
        !!fields[name] &&
        !fields[name].disabled &&
        isFieldAvailable(ctx.metadata, ctx.scope, name) &&
        ctx.acl.checkField(ctx.scope, name),
    );
}

export type RelationshipPanelDefs = {
  layout?: string;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  createAttributeMap?: Record<string, string>;
  select?: boolean;
  create?: boolean;
  unlinkDisabled?: boolean;
  filterList?: string[];
  [key: string]: unknown;
};

export type RelationshipPanel = {
  link: string;
  label: string;
  foreignScope: string;
  tabNumber: number;
  tabLabel: string | null;
  defs: RelationshipPanelDefs;
  canCreate: boolean;
  canSelect: boolean;
  canUnlink: boolean;
};

const RELATIONSHIP_LINK_TYPES = new Set(["hasMany", "manyMany", "hasChildren"]);

/**
 * Relationship panel ở cuối trang chi tiết: theo layout `bottomPanelsDetail` (thứ tự, tab),
 * chỉ gồm link hasMany/manyMany/hasChildren mà người dùng được đọc entity đích.
 * Panel không phải link (ví dụ `stream`) do phần khác xử lý.
 */
export function buildRelationshipPanels(
  layout: BottomPanelsLayout | null | undefined,
  ctx: { scope: string; metadata: Metadata; acl: Acl; t: Translator },
): RelationshipPanel[] {
  const links = getEntityDefs(ctx.metadata, ctx.scope).links ?? {};
  const clientDefs = (ctx.metadata.clientDefs?.[ctx.scope] ?? {}) as { relationshipPanels?: Record<string, RelationshipPanelDefs> };
  const panelDefs = clientDefs.relationshipPanels ?? {};

  let entries = Object.entries(layout ?? {});

  if (!entries.length) {
    // Không có layout: dùng thứ tự của clientDefs.relationshipPanels.
    entries = Object.keys(panelDefs).map((name, index) => [name, { index }]);
  }

  entries.sort((a, b) => (a[1]?.index ?? 0) - (b[1]?.index ?? 0));

  let tabNumber = 0;
  let tabLabel: string | null = null;
  const result: RelationshipPanel[] = [];

  for (const [name, item] of entries) {
    if (item?.tabBreak) {
      tabNumber++;
      tabLabel = translateTabLabel(item.tabLabel, ctx.scope, ctx.t);
      continue;
    }

    const link = links[name];

    if (item?.disabled || !link || link.disabled || link.utility || !RELATIONSHIP_LINK_TYPES.has(link.type)) {
      continue;
    }

    const foreignScope = link.entity;

    if (!foreignScope || !ctx.acl.checkScope(foreignScope, "read")) {
      continue;
    }

    const defs = panelDefs[name] ?? {};

    result.push({
      link: name,
      label: ctx.t(name, "links", ctx.scope),
      foreignScope,
      tabNumber,
      tabLabel,
      defs,
      canCreate: defs.create !== false && ctx.acl.checkScope(foreignScope, "create"),
      canSelect: defs.select !== false && ctx.acl.checkScope(ctx.scope, "edit"),
      canUnlink: !defs.unlinkDisabled && ctx.acl.checkScope(ctx.scope, "edit"),
    });
  }

  return result;
}
