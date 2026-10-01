import { describe, expect, it } from "vitest";
import appUserAdmin from "./__fixtures__/app-user-admin.json";
import metadataPhase3 from "./__fixtures__/metadata-phase3.json";
import { Acl } from "./acl";
import { autorefreshMs, dashletAllowed, dashletOptions, dashletSearchParams, resolveDashboardLayout } from "./dashboard";
import type { AppUserData, Metadata } from "./types";

const app = appUserAdmin as unknown as AppUserData;
const metadata = metadataPhase3 as unknown as Metadata;

describe("resolveDashboardLayout", () => {
  it("uses the user's layout sorted by row then column", () => {
    const tabs = resolveDashboardLayout(app.settings, app.preferences, app.user);

    expect(tabs[0].name).toBe("My Espo");
    expect(tabs[0].layout.map((item) => item.name)).toEqual(["Stream", "Activities"]);
  });

  it("prefers the forced layout and falls back to an empty tab", () => {
    const forced = [{ name: "Team", layout: [{ id: "a", name: "Memo", x: 0, y: 0, width: 4, height: 1 }] }];

    expect(resolveDashboardLayout({ ...app.settings, forcedDashboardLayout: forced }, app.preferences, app.user)[0].name).toBe("Team");
    expect(resolveDashboardLayout({}, { dashboardLayout: null }, app.user)).toEqual([{ name: "My Espo", layout: [] }]);
  });
});

describe("dashletOptions / dashletSearchParams", () => {
  it("merges metadata defaults with the user's options", () => {
    const options = dashletOptions(metadata, { dashletsOptions: { d1: { displayRecords: 3, title: "Việc của tôi" } } }, {
      id: "d1",
      name: "Tasks",
      x: 0,
      y: 0,
      width: 2,
      height: 2,
    });

    expect(options).toMatchObject({ title: "Việc của tôi", displayRecords: 3, orderBy: "dateUpcoming" });
    expect(dashletSearchParams(options, { metadata, scope: "Task", timeZone: null })).toEqual({
      primaryFilter: "actualStartingNotInFuture",
      boolFilterList: ["onlyMy"],
      orderBy: "dateUpcoming",
      order: "asc",
      maxSize: 3,
    });
  });

  it("builds nested or-filters from searchData (Meetings dashlet)", () => {
    const options = dashletOptions(metadata, {}, { id: "m", name: "Meetings", x: 0, y: 0, width: 2, height: 2 });
    const params = dashletSearchParams(options, { metadata, scope: "Meeting", timeZone: "Asia/Ho_Chi_Minh" });

    expect(params.where).toEqual([
      {
        type: "or",
        value: [
          { type: "today", attribute: "dateStart", dateTime: true, timeZone: "Asia/Ho_Chi_Minh" },
          { type: "future", attribute: "dateEnd", dateTime: true, timeZone: "Asia/Ho_Chi_Minh" },
        ],
      },
    ]);
  });

  it("uses primary/bool/sort options of the generic Records dashlet", () => {
    const params = dashletSearchParams(
      { entityType: "Account", primaryFilter: "customers", boolFilterList: ["onlyMy"], sortBy: "name", sortDirection: "desc", displayRecords: 7 },
      { metadata, scope: "Account", timeZone: null },
    );

    expect(params).toEqual({ primaryFilter: "customers", boolFilterList: ["onlyMy"], orderBy: "name", order: "desc", maxSize: 7 });
  });

  it("converts the refresh interval", () => {
    expect(autorefreshMs({ autorefreshInterval: 0.5 })).toBe(30_000);
    expect(autorefreshMs({ autorefreshInterval: 0 })).toBe(false);
  });
});

describe("dashletAllowed", () => {
  it("checks the dashlet's ACL scope", () => {
    const acl = new Acl(app.acl, app.user);

    expect(dashletAllowed(metadata, acl, app.user, "Tasks")).toBe(true);
    expect(dashletAllowed(metadata, acl, app.user, "NoSuchDashlet")).toBe(false);
  });
});
