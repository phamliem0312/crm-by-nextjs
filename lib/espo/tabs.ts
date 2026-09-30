// Dựng danh sách mục navbar từ `tabList`. Port từ `helpers/site/tabs` (@49521) và
// `NavbarSiteView.setupTabDefsList` / `prepareTabItemDefs` (@56266) của UI classic, chế độ navbar bên (side).
import type { Acl } from "./acl";
import type { Translator } from "./i18n";
import type { EspoUser, Metadata, Preferences, Settings, TabDivider, TabGroup, TabItem, TabUrl } from "./types";

export type NavEntryBase = {
  key: string;
  label: string;
  iconClass: string | null;
  color: string | null;
};

export type NavEntry =
  | (NavEntryBase & { kind: "scope"; scope: string; href: string })
  | (NavEntryBase & { kind: "home"; href: string })
  | (NavEntryBase & { kind: "url"; href: string; openInNewTab: boolean })
  | (NavEntryBase & { kind: "group"; items: NavEntry[] })
  | (NavEntryBase & { kind: "divider" });

export type NavTabs = {
  /** Các mục trước `_delimiter_` đầu tiên. */
  main: NavEntry[];
  /** Các mục sau `_delimiter_` đầu tiên (menu "thêm"). */
  more: NavEntry[];
  /** Các mục sau `_delimiter_` thứ hai: ẩn cho tới khi bấm "show more". */
  moreHidden: NavEntry[];
};

export type TabsContext = {
  settings: Settings;
  preferences: Preferences;
  user: Pick<EspoUser, "type">;
  acl: Acl;
  metadata: Metadata;
  t: Translator;
  /** Đường dẫn cho một scope (UI mới hoặc chuyển sang classic). */
  scopeHref: (scope: string) => string;
};

const COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export const isTabDivider = (item: TabItem): item is TabDivider =>
  typeof item === "object" && item !== null && item.type === "divider";

export const isTabMoreDelimiter = (item: TabItem): boolean => item === "_delimiter_" || item === "_delimiter-ext_";

export const isTabUrl = (item: TabItem): item is TabUrl =>
  typeof item === "object" && item !== null && item.type === "url";

export const isTabGroup = (item: TabItem): item is TabGroup =>
  typeof item === "object" && item !== null && !isTabDivider(item) && !isTabUrl(item);

/** `tabList` có hiệu lực: của settings, hoặc của preferences nếu người dùng tự đặt. */
export function getTabList(settings: Settings, preferences: Preferences): TabItem[] {
  const own = preferences.tabList ?? [];
  let list = preferences.useCustomTabList && !preferences.addCustomTabs ? own : (settings.tabList ?? []);

  if (preferences.useCustomTabList && preferences.addCustomTabs) {
    list = [...list, ...own];
  }

  return structuredClone(list ?? []);
}

export function getTranslatedTabLabel(item: TabItem, t: Translator): string {
  const translateLabel = (label: string) => (label.startsWith("$") ? t(label.slice(1), "navbarTabs") : label);

  if (typeof item === "object") {
    return item?.text ? translateLabel(item.text) : "";
  }

  if (item === "Home") {
    return t("Home");
  }

  return t(item, "scopeNamesPlural");
}

export function checkTabAccess(item: TabItem, ctx: Pick<TabsContext, "acl" | "metadata" | "user">): boolean {
  if (isTabUrl(item)) {
    if (item.onlyAdmin && ctx.user.type !== "admin" && ctx.user.type !== "super-admin") {
      return false;
    }

    return item.aclScope ? ctx.acl.checkScope(item.aclScope) : true;
  }

  if (item === "Home" || isTabMoreDelimiter(item)) {
    return true;
  }

  if (typeof item !== "string") {
    return false;
  }

  const defs = ctx.metadata.scopes?.[item];

  if (!defs || defs.disabled) {
    return false;
  }

  if (defs.acl) {
    return ctx.acl.checkScope(item);
  }

  if (defs.tabAclPermission) {
    const level = ctx.acl.getPermissionLevel(defs.tabAclPermission);

    return !!level && level !== "no";
  }

  return true;
}

/** Bỏ divider ở đầu, ở cuối và divider đứng liền nhau trong một group. */
function tidyGroupItems(items: TabItem[]): TabItem[] {
  const noDoubles = items.filter((item, i) => !isTabDivider(item) || !items[i + 1] || !isTabDivider(items[i + 1]));

  return noDoubles.filter((item, i) => !isTabDivider(item) || (i !== 0 && i !== noDoubles.length - 1));
}

/** Lọc `tabList` theo quyền và dọn divider thừa, giống `setupTabDefsList`. */
export function filterTabList(tabList: TabItem[], ctx: Pick<TabsContext, "acl" | "metadata" | "user">): TabItem[] {
  let list = tabList.filter((item, i) => {
    if (!item) {
      return false;
    }

    if (typeof item !== "object") {
      return checkTabAccess(item, ctx);
    }

    if (isTabDivider(item)) {
      return i !== tabList.length - 1;
    }

    if (isTabUrl(item)) {
      return checkTabAccess(item, ctx);
    }

    return true;
  });

  // Group: lọc mục con; group rỗng thì bỏ.
  list = list
    .map((item) => {
      if (!isTabGroup(item)) {
        return item;
      }

      const itemList = tidyGroupItems(
        (item.itemList ?? []).filter((child) => isTabDivider(child) || checkTabAccess(child, ctx)),
      );

      return { ...item, itemList };
    })
    .filter((item) => !isTabGroup(item) || (item.itemList?.length ?? 0) > 0);

  let moreIsMet = false;

  list = list.filter((item, i) => {
    const next = list[i + 1];
    const prev = list[i - 1];

    if (isTabMoreDelimiter(item)) {
      moreIsMet = true;
    }

    if (!isTabDivider(item) || !next) {
      return true;
    }

    if (isTabDivider(next)) {
      return false;
    }

    return !(prev && isTabDivider(prev) && isTabMoreDelimiter(next) && moreIsMet);
  });

  if (moreIsMet) {
    // Bỏ các divider ở cuối danh sách.
    let end = list.length;

    while (end > 0 && isTabDivider(list[end - 1])) {
      end--;
    }

    list = list.slice(0, end);
  }

  return list;
}

function prepareEntry(item: TabItem, index: number, ctx: TabsContext): NavEntry {
  const colorsDisabled = !!(ctx.settings.scopeColorsDisabled || ctx.settings.tabColorsDisabled);
  const iconsDisabled = !!ctx.settings.tabIconsDisabled;
  const label = getTranslatedTabLabel(item, ctx.t);
  const validColor = (color: string | null | undefined) => (color && COLOR_PATTERN.test(color) ? color : null);

  if (item === "Home") {
    return { kind: "home", key: "home", label, iconClass: null, color: null, href: "/" };
  }

  if (isTabDivider(item)) {
    return { kind: "divider", key: `divider-${index}`, label, iconClass: null, color: null };
  }

  if (isTabUrl(item)) {
    return {
      kind: "url",
      key: `url-${index}`,
      label,
      href: item.url || "#",
      openInNewTab: item.openInNewTab ?? false,
      iconClass: item.iconClass ?? null,
      color: validColor(item.color),
    };
  }

  if (isTabGroup(item)) {
    return {
      kind: "group",
      key: `group-${index}`,
      label,
      iconClass: item.iconClass ?? null,
      color: validColor(item.color),
      items: (item.itemList ?? []).map((child, i) => prepareEntry(child, i, ctx)),
    };
  }

  const scope = item as string;
  const clientDefs = ctx.metadata.clientDefs?.[scope];

  return {
    kind: "scope",
    key: scope,
    scope,
    label,
    href: ctx.scopeHref(scope),
    iconClass: iconsDisabled ? null : (clientDefs?.iconClass ?? null),
    color: colorsDisabled ? null : validColor(clientDefs?.color),
  };
}

/** Danh sách mục navbar đã lọc quyền, dịch nhãn và chia nhóm theo `_delimiter_`. */
export function buildNavTabs(ctx: TabsContext): NavTabs {
  const list = filterTabList(getTabList(ctx.settings, ctx.preferences), ctx);
  const result: NavTabs = { main: [], more: [], moreHidden: [] };
  let section: keyof NavTabs = "main";

  list.forEach((item, i) => {
    if (isTabMoreDelimiter(item)) {
      if (section === "main") {
        section = "more";
      } else if (i !== list.length - 1) {
        section = "moreHidden";
      }

      return;
    }

    result[section].push(prepareEntry(item, i, ctx));
  });

  // Khác classic: classic giữ divider đứng ngay trước `_delimiter_` đầu tiên (hiện thành tiêu đề không có mục nào).
  for (const section of Object.values(result)) {
    while (section.length > 0 && section[section.length - 1].kind === "divider") {
      section.pop();
    }
  }

  return result;
}
