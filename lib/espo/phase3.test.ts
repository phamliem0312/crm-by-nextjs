// Test logic giai đoạn 3 (hành động bản ghi, activities, panel phụ, panel dưới, export, thông báo)
// trên metadata/layout chụp từ Espo thật.
import { describe, expect, it } from "vitest";
import appUserAdmin from "./__fixtures__/app-user-admin.json";
import appUserLimited from "./__fixtures__/app-user-limited.json";
import i18n from "./__fixtures__/i18n.json";
import layouts from "./__fixtures__/layouts.json";
import metadataPhase3 from "./__fixtures__/metadata-phase3.json";
import metadataRecords from "./__fixtures__/metadata-records.json";
import { Acl } from "./acl";
import { activityCreateAttributes, activityCreateOptions, canCompleteTask, canSetHeldInPanel, tasksLink } from "./activities";
import { canExport, exportAttributeList, exportFormats, exportShouldBeIdle } from "./export";
import { createTranslator, type LanguageData } from "./i18n";
import { buildBottomPanels, type BottomPanelsLayout } from "./layout";
import { mentionMessageKey, notificationMessage } from "./notifications";
import { acceptanceOptions, canConvert, canSetHeld, convertScopes, myAcceptanceStatus } from "./record-actions";
import { buildExtraPanels } from "./side-panels";
import type { AppUserData, Metadata } from "./types";

const records = metadataRecords as unknown as Metadata & { entityDefs: Record<string, unknown> };
const phase3 = metadataPhase3 as unknown as Metadata & { entityDefs: Record<string, unknown>; clientDefs: Record<string, unknown> };
// Gộp hai fixture: entity nghiệp vụ (giai đoạn 2) + sự kiện/stream (giai đoạn 3).
const metadata: Metadata = {
  ...records,
  scopes: { ...records.scopes, ...phase3.scopes },
  entityDefs: { ...records.entityDefs, ...phase3.entityDefs },
  clientDefs: { ...(records.clientDefs as object), ...phase3.clientDefs },
  dashlets: phase3.dashlets,
  streamDefs: phase3.streamDefs,
  app: { ...(records.app as object), ...(phase3.app as object) },
};
const admin = appUserAdmin as unknown as AppUserData;
const limited = appUserLimited as unknown as AppUserData;
const adminAcl = new Acl(admin.acl, admin.user);
const limitedAcl = new Acl(limited.acl, limited.user);
const t = createTranslator(i18n as unknown as LanguageData);

describe("record actions (Meeting/Call, Lead)", () => {
  const meeting = { id: "m1", status: "Planned", usersIds: ["u1", admin.user.id], usersColumns: { [admin.user.id]: { status: "Tentative" } } };

  it("offers Set Held / Not Held only while the event is planned", () => {
    expect(canSetHeld(metadata, adminAcl, "Meeting", meeting, true)).toBe(true);
    expect(canSetHeld(metadata, adminAcl, "Meeting", { ...meeting, status: "Held" }, true)).toBe(false);
    expect(canSetHeld(metadata, adminAcl, "Meeting", meeting, false)).toBe(false);
    expect(canSetHeld(metadata, adminAcl, "Account", { id: "a" }, true)).toBe(false);
  });

  it("reads the current user's acceptance status", () => {
    expect(myAcceptanceStatus(metadata, "Meeting", meeting, admin.user.id)).toBe("Tentative");
    expect(myAcceptanceStatus(metadata, "Meeting", meeting, "u1")).toBe("None");
    expect(myAcceptanceStatus(metadata, "Meeting", meeting, "nobody")).toBeUndefined();
    expect(myAcceptanceStatus(metadata, "Meeting", { ...meeting, status: "Not Held" }, admin.user.id)).toBeUndefined();
    expect(acceptanceOptions(metadata, "Call")).toEqual(["Accepted", "Tentative", "Declined"]);
  });

  it("allows converting an actual lead into creatable entities", () => {
    expect(canConvert(metadata, "Lead", { id: "l", status: "New" }, true)).toBe(true);
    expect(canConvert(metadata, "Lead", { id: "l", status: "Converted" }, true)).toBe(false);
    expect(canConvert(metadata, "Lead", { id: "l", status: "Dead" }, true)).toBe(false);
    expect(canConvert(metadata, "Account", { id: "a", status: "x" }, true)).toBe(false);
    expect(convertScopes(metadata, adminAcl, "Lead", false)).toEqual(["Account", "Contact", "Opportunity"]);
    expect(convertScopes(metadata, adminAcl, "Lead", true)).toEqual(["Contact", "Opportunity"]);
    // User giới hạn: chỉ tạo được Account (role "Next Test – Limited").
    expect(convertScopes(metadata, limitedAcl, "Lead", false)).toEqual(["Account"]);
  });
});

describe("activities panels", () => {
  it("lists Schedule/Log actions via the parent link", () => {
    const ctx = { metadata, acl: adminAcl, settings: admin.settings };

    // Như classic: panel "activities" tra `activitiesStatusList` (không có) → dùng trạng thái mặc định của entity.
    expect(activityCreateOptions("activities", "Account", ctx)).toEqual([
      { scope: "Meeting", link: "meetings", status: null },
      { scope: "Call", link: "calls", status: null },
    ]);
    expect(activityCreateOptions("history", "Account", ctx).map((option) => option.status)).toEqual(["Held", "Held"]);
    expect(activityCreateOptions("activities", "Account", { ...ctx, acl: limitedAcl })).toEqual([]);
  });

  it("prefills parent and contacts like classic", () => {
    expect(activityCreateAttributes("Account", { id: "a1", name: "Acme" }, "Meeting", "Planned", { metadata })).toEqual({
      status: "Planned",
      parentType: "Account",
      parentId: "a1",
      parentName: "Acme",
    });
    // Contact có Account → parent là Account; danh sách contacts của bản ghi cha.
    expect(
      activityCreateAttributes("Contact", { id: "c1", name: "Bình", accountId: "a1", accountName: "Acme" }, "Call", null, { metadata }),
    ).toMatchObject({ parentType: "Account", parentId: "a1" });
    expect(activityCreateAttributes("Lead", { id: "l1", name: "Lan" }, "Task", null, { metadata })).toMatchObject({ parentType: "Lead", parentId: "l1" });
  });

  it("knows which rows can be completed or held", () => {
    expect(canSetHeldInPanel(metadata, "Call", "Planned")).toBe(true);
    expect(canSetHeldInPanel(metadata, "Call", "Held")).toBe(false);
    expect(canCompleteTask(metadata, "Started")).toBe(true);
    expect(canCompleteTask(metadata, "Completed")).toBe(false);
    expect(tasksLink("Account", metadata)).toBe("tasksPrimary");
    expect(tasksLink("Contact", metadata)).toBe("tasks");
  });
});

describe("extra and bottom panels", () => {
  const ctx = { scope: "Account", type: "detail" as const, metadata, acl: adminAcl, t };

  it("builds activities/history/tasks side panels with ACL", () => {
    expect(buildExtraPanels("side", ctx, null).map((panel) => panel.kind)).toEqual(["activities", "history", "tasks"]);
    expect(buildExtraPanels("side", { ...ctx, acl: limitedAcl }, null)).toEqual([]);
    // Panel bottom bị tắt mặc định, layout bật lại thì hiện.
    expect(buildExtraPanels("bottom", ctx, null)).toEqual([]);
    expect(buildExtraPanels("bottom", ctx, { activities: { index: 9, disabled: false } }).map((panel) => panel.name)).toEqual(["activities"]);
    expect(buildExtraPanels("side", { ...ctx, scope: "Meeting" }, null)[0]).toMatchObject({ kind: "attendees", fields: ["users", "contacts", "leads"] });
  });

  it("orders Stream and relationships into tabs from bottomPanelsDetail", () => {
    const panels = buildBottomPanels(layouts.Account.bottomPanelsDetail as BottomPanelsLayout, { scope: "Account", metadata, acl: adminAcl, t }, { stream: true });

    expect(panels.map((panel) => `${panel.tabNumber}:${panel.name}`)).toEqual(["1:stream", "2:contacts", "2:opportunities", "2:documents", "3:cases"]);
    expect(buildBottomPanels(null, { scope: "Account", metadata, acl: adminAcl, t }, { stream: true })[0].name).toBe("stream");
    expect(buildBottomPanels(layouts.Account.bottomPanelsDetail as BottomPanelsLayout, { scope: "Account", metadata, acl: adminAcl, t }).some((panel) => panel.kind === "stream")).toBe(false);
  });
});

describe("export", () => {
  it("checks permission and formats", () => {
    expect(canExport("Account", { settings: admin.settings, acl: adminAcl, metadata })).toBe(true);
    expect(canExport("Account", { settings: { ...limited.settings, exportDisabled: true }, acl: limitedAcl, metadata })).toBe(false);
    expect(exportFormats(metadata, "Account")).toEqual(["xlsx", "csv"]);
  });

  it("maps fields to attributes and decides idle mode", () => {
    expect(exportAttributeList(metadata, "Account", ["name", "assignedUser", "billingAddress"])).toEqual(
      expect.arrayContaining(["name", "assignedUserId", "assignedUserName", "billingAddressCity"]),
    );
    expect(exportShouldBeIdle(5000, true, { exportIdleCountThreshold: 1000 }, false)).toBe(true);
    expect(exportShouldBeIdle(5000, false, { exportIdleCountThreshold: 1000 }, false)).toBe(false);
    expect(exportShouldBeIdle(10, true, { exportIdleCountThreshold: 1000 }, false)).toBe(false);
  });
});

describe("notifications", () => {
  const stream = { t, metadata, userId: "me", parent: null, language: "en_US" };

  it("describes assignment and removal notifications", () => {
    const assign = notificationMessage(
      { id: "n", type: "Assign", data: { entityType: "Account", entityId: "a1", entityName: "Acme", userId: "u1", userName: "An" } },
      stream,
    );

    expect(assign).toMatchObject({ kind: "message", key: "assign", category: "notificationMessages" });
    expect(notificationMessage({ id: "n", type: "EntityRemoved", data: { entityType: "Account", entityName: "Old" } }, stream)).toMatchObject({
      key: "entityRemoved",
    });
  });

  it("renders note notifications and mention keys", () => {
    const note = { id: "x", type: "Post", post: "hi @me", parentType: "Account", parentId: "a1", createdById: "u1" };

    expect(notificationMessage({ id: "n", type: "MentionInPost", noteData: note }, stream)).toEqual({ kind: "note", note, key: "mentionYouInPost" });
    expect(mentionMessageKey({ id: "x", isGlobal: true })).toBe("mentionYouInPostTargetAll");
    expect(mentionMessageKey({ id: "x", usersIds: ["u1"], createdById: "u1" })).toBe("mentionYouInPostTargetNoTarget");
  });

  it("counts grouped record updates", () => {
    expect(
      notificationMessage({ id: "n", groupType: "Record", groupedUnreadCount: 3, relatedParentType: "Account", relatedParentId: "a1", relatedParentName: "Acme" }, stream),
    ).toMatchObject({ key: "groupUpdatesMultiple", data: { number: { kind: "text", text: "3" } } });
  });
});
