import { describe, expect, it } from "vitest";
import adminFixture from "./__fixtures__/app-user-admin.json";
import limitedFixture from "./__fixtures__/app-user-limited.json";
import i18nFixture from "./__fixtures__/i18n.json";
import adminMetadata from "./__fixtures__/metadata-admin.json";
import limitedMetadata from "./__fixtures__/metadata-limited.json";
import { Acl, type AclUser } from "./acl";
import { createTranslator, type LanguageData } from "./i18n";
import { buildNavTabs, filterTabList, getTabList, type NavEntry, type TabsContext } from "./tabs";
import type { AclData, Metadata, Preferences, Settings, TabItem } from "./types";

const t = createTranslator(i18nFixture as unknown as LanguageData);

type Fixture = { user: unknown; acl: unknown; settings: unknown; preferences: unknown };

function context(fixture: Fixture, metadata: Metadata, overrides: Partial<TabsContext> = {}): TabsContext {
  return {
    settings: fixture.settings as Settings,
    preferences: fixture.preferences as Preferences,
    user: fixture.user as AclUser,
    acl: new Acl(fixture.acl as unknown as AclData, fixture.user as AclUser),
    metadata,
    t,
    scopeHref: (scope) => `/classic?to=${encodeURIComponent(`#${scope}`)}`,
    ...overrides,
  };
}

const scopes = (entries: NavEntry[]) => entries.filter((e) => e.kind === "scope").map((e) => (e.kind === "scope" ? e.scope : ""));

describe("buildNavTabs (fixture tháº­t)", () => {
  it("shows every tab scope to admin, split at _delimiter_", () => {
    const tabs = buildNavTabs(context(adminFixture, adminMetadata as Metadata));

    expect(scopes(tabs.main)).toEqual(expect.arrayContaining(["Account", "Contact", "Lead", "Opportunity", "Case"]));
    expect(scopes(tabs.more)).toEqual(expect.arrayContaining(["Campaign", "Document", "User"]));
    expect(tabs.main.find((e) => e.kind === "divider")?.label).toBe(t("CRM", "navbarTabs"));
  });

  it("hides scopes the limited role cannot access", () => {
    const tabs = buildNavTabs(context(limitedFixture, limitedMetadata as Metadata));
    const all = [...tabs.main, ...tabs.more, ...tabs.moreHidden];

    expect(scopes(all)).toContain("Account");
    expect(scopes(all)).toContain("Lead");
    expect(scopes(all)).not.toContain("Contact");
    expect(scopes(all)).not.toContain("Opportunity");
    expect(scopes(all)).not.toContain("Case");
  });

  it("does not leave dividers without items", () => {
    const tabs = buildNavTabs(context(limitedFixture, limitedMetadata as Metadata));

    for (const section of [tabs.main, tabs.more]) {
      section.forEach((entry, i) => {
        if (entry.kind === "divider") {
          expect(section[i + 1]?.kind).not.toBe("divider");
          expect(i).not.toBe(section.length - 1);
        }
      });
    }
  });

  it("uses translated plural names, icons and hrefs", () => {
    const account = buildNavTabs(context(adminFixture, adminMetadata as Metadata)).main.find(
      (e) => e.kind === "scope" && e.scope === "Account",
    );

    expect(account).toMatchObject({
      label: t("Account", "scopeNamesPlural"),
      iconClass: (adminMetadata as Metadata).clientDefs?.Account?.iconClass,
      href: "/classic?to=%23Account",
    });
  });
});

describe("tab list rules", () => {
  const base = context(adminFixture, adminMetadata as Metadata);

  it("uses custom tab lists from preferences", () => {
    expect(getTabList({ tabList: ["Account"] }, { useCustomTabList: true, tabList: ["Lead"] })).toEqual(["Lead"]);
    expect(
      getTabList({ tabList: ["Account"] }, { useCustomTabList: true, addCustomTabs: true, tabList: ["Lead"] }),
    ).toEqual(["Account", "Lead"]);
    expect(getTabList({ tabList: ["Account"] }, {})).toEqual(["Account"]);
  });

  it("filters groups and url tabs", () => {
    const list: TabItem[] = [
      { type: "group", text: "$CRM", itemList: [{ type: "divider" }, "Contact", { type: "divider" }, { type: "divider" }, "Lead"] },
      { type: "group", text: "Empty", itemList: ["NoSuchScope"] },
      { type: "url", text: "Admin only", url: "https://x.test", onlyAdmin: true },
    ];
    const limitedCtx = context(limitedFixture, limitedMetadata as Metadata);

    expect(filterTabList(list, base)).toEqual([
      { type: "group", text: "$CRM", itemList: ["Contact", { type: "divider" }, "Lead"] },
      { type: "url", text: "Admin only", url: "https://x.test", onlyAdmin: true },
    ]);
    expect(filterTabList(list, limitedCtx)).toEqual([{ type: "group", text: "$CRM", itemList: ["Lead"] }]);
  });

  it("puts items after a second delimiter into moreHidden", () => {
    const tabs = buildNavTabs({
      ...base,
      settings: { tabList: ["Account", "_delimiter_", "Lead", "_delimiter_", "Contact"] },
      preferences: {},
    });

    expect(scopes(tabs.main)).toEqual(["Account"]);
    expect(scopes(tabs.more)).toEqual(["Lead"]);
    expect(scopes(tabs.moreHidden)).toEqual(["Contact"]);
  });

  it("drops invalid colors and respects disabled icons", () => {
    const tabs = buildNavTabs({
      ...base,
      settings: { tabList: [{ type: "url", url: "/x", text: "X", color: "red", iconClass: "fas fa-x" }, "Account"], tabIconsDisabled: true },
      preferences: {},
    });

    expect(tabs.main[0]).toMatchObject({ kind: "url", color: null, iconClass: "fas fa-x" });
    expect(tabs.main[1]).toMatchObject({ kind: "scope", iconClass: null });
  });
});
