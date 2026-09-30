import { describe, expect, it } from "vitest";
import adminFixture from "./__fixtures__/app-user-admin.json";
import limitedFixture from "./__fixtures__/app-user-limited.json";
import i18nFixture from "./__fixtures__/i18n.json";
import layoutsFixture from "./__fixtures__/layouts.json";
import metadataFixture from "./__fixtures__/metadata-records.json";
import { Acl, type AclUser } from "./acl";
import { createTranslator, type LanguageData } from "./i18n";
import {
  buildDefaultSideFields,
  buildDetailPanels,
  buildListColumns,
  buildRelationshipPanels,
  detailFieldNames,
  type BottomPanelsLayout,
  type DetailLayoutPanel,
  type ListLayoutItem,
} from "./layout";
import type { AclData, Metadata } from "./types";

const metadata = metadataFixture as unknown as Metadata;
const t = createTranslator(i18nFixture as unknown as LanguageData);
const layouts = layoutsFixture as unknown as Record<string, Record<string, unknown>>;
const admin = new Acl(adminFixture.acl as unknown as AclData, adminFixture.user as AclUser);
const limited = new Acl(limitedFixture.acl as unknown as AclData, limitedFixture.user as AclUser);

const ctx = (scope: string, acl = admin) => ({ scope, metadata, acl, t });

describe("buildListColumns (layout list thật của Account)", () => {
  const columns = buildListColumns(layouts.Account.list as ListLayoutItem[], ctx("Account"));

  it("skips hidden columns and keeps order", () => {
    expect(columns.map((c) => c.name)).toEqual(["name", "website", "type", "billingAddressCountry"]);
  });

  it("marks links, sorting, widths and translated labels", () => {
    expect(columns[0]).toMatchObject({ name: "name", link: true, sortable: true, label: t("name", "fields", "Account") });
    expect(columns[1]).toMatchObject({ name: "website", sortable: false, width: 25 });
  });

  it("drops fields the user cannot read", () => {
    const list: ListLayoutItem[] = [{ name: "name" }, { name: "sicCode" }];

    expect(buildListColumns(list, ctx("Account", limited)).map((c) => c.name)).toEqual(["name"]);
  });
});

describe("buildDetailPanels (layout detail thật)", () => {
  it("builds panels with translated labels and full-width cells", () => {
    const panels = buildDetailPanels(layouts.Account.detail as DetailLayoutPanel[], ctx("Account"));

    expect(panels.map((p) => p.label)).toEqual([t("Overview", "labels", "Account"), t("Details", "labels", "Account")]);
    expect(panels[0].rows[0].map((c) => c?.name)).toEqual(["name", "website"]);
    expect(panels[1].rows[1]).toEqual([
      { name: "description", label: t("description", "fields", "Account"), noLabel: false, fullWidth: true },
    ]);
    expect(detailFieldNames(panels)).toContain("billingAddress");
  });

  it("turns false and unknown cells into empty cells and drops empty rows/panels", () => {
    const layout: DetailLayoutPanel[] = [
      { label: "A", rows: [[{ name: "name" }, false], [{ name: "noSuchField" }]] },
      { label: "$B", rows: [[false]] },
    ];

    const panels = buildDetailPanels(layout, ctx("Account"));

    expect(panels).toHaveLength(1);
    expect(panels[0].rows).toEqual([[expect.objectContaining({ name: "name" }), null]]);
  });

  it("assigns tab numbers at tab breaks", () => {
    const layout: DetailLayoutPanel[] = [
      { label: "A", rows: [[{ name: "name" }]] },
      { label: "B", tabBreak: true, tabLabel: "Extra", rows: [[{ name: "type" }]] },
    ];

    expect(buildDetailPanels(layout, ctx("Account")).map((p) => [p.tabNumber, p.tabLabel])).toEqual([
      [0, null],
      [1, "Extra"],
    ]);
  });
});

describe("buildDefaultSideFields", () => {
  it("expands :assignedUser", () => {
    expect(buildDefaultSideFields(layouts.Account.defaultSidePanel as { name: string }[], ctx("Account"))).toEqual([
      "assignedUser",
      "teams",
    ]);
  });

  it("uses the default layout when missing", () => {
    expect(buildDefaultSideFields(null, ctx("Task"))).toEqual(["assignedUser", "teams"]);
  });
});

describe("buildRelationshipPanels (bottomPanelsDetail thật)", () => {
  it("orders link panels by layout and skips stream/tab breaks", () => {
    const panels = buildRelationshipPanels(layouts.Account.bottomPanelsDetail as BottomPanelsLayout, ctx("Account"));

    expect(panels.map((p) => p.link)).toEqual(["contacts", "opportunities", "documents", "cases"]);
    expect(panels[0]).toMatchObject({
      foreignScope: "Contact",
      label: t("contacts", "links", "Account"),
      tabNumber: 2,
      canCreate: true,
    });
    expect(panels[0].defs.createAttributeMap).toMatchObject({ id: "accountId", name: "accountName" });
  });

  it("hides panels of entities the user cannot read", () => {
    const panels = buildRelationshipPanels(layouts.Account.bottomPanelsDetail as BottomPanelsLayout, ctx("Account", limited));

    expect(panels.map((p) => p.link)).not.toContain("contacts");
    expect(panels.map((p) => p.link)).not.toContain("opportunities");
  });
});
