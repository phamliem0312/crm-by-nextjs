import { describe, expect, it } from "vitest";
import adminFixture from "./__fixtures__/app-user-admin.json";
import limitedFixture from "./__fixtures__/app-user-limited.json";
import { Acl, type AclRecordOptions, type AclUser } from "./acl";
import type { AclData } from "./types";

// Fixture chụp từ API thật (npm run capture:fixtures). Role "Next Test – Limited":
// Account create=yes read/edit/stream=own delete=no; Lead read/stream=all, còn lại no;
// Contact/Opportunity/Case bị tắt; Account.website chỉ đọc, Account.sicCode ẩn.
const limited = new Acl(limitedFixture.acl as unknown as AclData, limitedFixture.user as AclUser);
const admin = new Acl(adminFixture.acl as unknown as AclData, adminFixture.user as AclUser);

const withFields = (...fields: string[]): AclRecordOptions => ({ hasField: (field) => fields.includes(field) });
const me = limitedFixture.user.id;

describe("Acl.checkScope", () => {
  it("allows everything for admin", () => {
    expect(admin.checkScope("Account", "delete")).toBe(true);
    expect(admin.checkScope("Contact", "read")).toBe(true);
  });

  it("follows role levels for a regular user", () => {
    expect(limited.checkScope("Account")).toBe(true);
    expect(limited.checkScope("Account", "read")).toBe(true);
    expect(limited.checkScope("Account", "delete")).toBe(false);
    expect(limited.checkScope("Lead", "read")).toBe(true);
    expect(limited.checkScope("Lead", "edit")).toBe(false);
  });

  it("denies scopes missing from the table", () => {
    expect(limited.checkScopeHasAcl("Contact")).toBe(false);
    expect(limited.checkScope("Contact")).toBe(false);
    expect(limited.checkScope("Opportunity", "read")).toBe(false);
  });

  it("reads levels and permissions", () => {
    expect(limited.getLevel("Account", "read")).toBe("own");
    expect(limited.getLevel("Contact", "read")).toBeNull();
    expect(limited.getPermissionLevel("assignment")).toBe("no");
    expect(limited.getPermissionLevel("exportPermission")).toBe("no");
  });

  it("handles boolean scope data", () => {
    const acl = new Acl({ table: { Calendar: true, Import: false } } as AclData, { id: "u", type: "regular" });

    expect(acl.checkScope("Calendar", "read")).toBe(true);
    expect(acl.checkScope("Import")).toBe(false);
  });
});

describe("Acl.checkRecord", () => {
  const account = withFields("assignedUser", "teams", "createdBy");

  it("allows own records", () => {
    expect(limited.checkRecord("Account", { assignedUserId: me, teamsIds: [] }, "edit", account)).toBe(true);
  });

  it("denies records of other users", () => {
    expect(limited.checkRecord("Account", { assignedUserId: "other", teamsIds: [] }, "read", account)).toBe(false);
  });

  it("returns null when ownership data is not loaded (precise)", () => {
    expect(limited.checkRecord("Account", {}, "read", { ...account, precise: true })).toBeNull();
  });

  it("uses scope level when it is `all`", () => {
    expect(limited.checkRecord("Lead", { assignedUserId: "other" }, "read", account)).toBe(true);
  });

  it("allows team records for `team` level", () => {
    const acl = new Acl({ table: { Account: { read: "team" } } } as AclData, { id: "u", type: "regular", teamsIds: ["t1"] });

    expect(acl.checkRecord("Account", { assignedUserId: "x", teamsIds: ["t1"] }, "read", account)).toBe(true);
    expect(acl.checkRecord("Account", { assignedUserId: "x", teamsIds: ["t2"] }, "read", account)).toBe(false);
  });

  it("lets users delete records they created when aclAllowDeleteCreated is on", () => {
    const acl = new Acl(limitedFixture.acl as unknown as AclData, limitedFixture.user as AclUser, {
      aclAllowDeleteCreated: true,
    });
    const record = { createdById: me, assignedUserId: null, teamsIds: [] };

    expect(limited.checkRecord("Account", record, "delete", account)).toBe(false);
    expect(acl.checkRecord("Account", record, "delete", account)).toBe(true);
  });

  it("treats collaborators as shared for read", () => {
    const acl = new Acl({ table: { Account: { read: "own" } } } as AclData, { id: "u", type: "regular" });
    const options = withFields("assignedUser", "collaborators");

    expect(acl.checkRecord("Account", { assignedUserId: "x", collaboratorsIds: ["u"] }, "read", options)).toBe(true);
  });
});

describe("Acl fields", () => {
  it("lists forbidden fields from fieldTableQuickAccess", () => {
    expect(limited.getScopeForbiddenFieldList("Account")).toEqual(["sicCode"]);
    expect(limited.getScopeForbiddenFieldList("Account", "edit")).toEqual(["website", "sicCode"]);
    expect(limited.checkField("Account", "website")).toBe(true);
    expect(limited.checkField("Account", "website", "edit")).toBe(false);
    expect(limited.checkField("Account", "name", "edit")).toBe(true);
  });

  it("returns copies so callers cannot corrupt the cache", () => {
    limited.getScopeForbiddenFieldList("Account").push("name");

    expect(limited.checkField("Account", "name")).toBe(true);
  });
});

describe("Acl.checkPermission", () => {
  it("allows only self when level is no", () => {
    expect(limited.checkPermission("assignment", { id: me, type: "regular" })).toBe(true);
    expect(limited.checkPermission("assignment", { id: "other", type: "regular" })).toBe(false);
    expect(admin.checkPermission("assignment", { id: "other", type: "regular" })).toBe(true);
  });

  it("checks shared teams for team level", () => {
    const acl = new Acl({ table: {}, assignmentPermission: "team" } as AclData, {
      id: "u",
      type: "regular",
      teamsIds: ["t1"],
    });

    expect(acl.checkPermission("assignment", { id: "x", type: "regular", teamsIds: ["t1"] })).toBe(true);
    expect(acl.checkPermission("assignment", { id: "x", type: "regular", teamsIds: ["t2"] })).toBe(false);
    expect(acl.checkPermission("assignment", { id: "x", type: "regular" })).toBeNull();
  });
});
