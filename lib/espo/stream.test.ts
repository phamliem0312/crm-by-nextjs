import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n";
import { messageParts, messageTemplate, noteMessage, toggleReaction, type Note, type StreamContext } from "./stream";

const t = createTranslator({
  Global: {
    scopeNames: { Account: "Khách hàng", Contact: "Liên hệ", Task: "Công việc" },
    streamMessages: {
      create: "{user} tạo {entityType} {entity}",
      createThis: "{user} tạo {entityType}",
      createAssignedThisSelf: "{user} đã tạo {entityType} này và tự giao cho mình",
      update: "{user} cập nhật {entityType} {entity}",
      assignVoid: "{user} unassigned {entityType} {entity}",
    },
    streamMessagesFemale: { create: "{user} (nữ) tạo {entityType} {entity}" },
    fields: { status: "Trạng thái" },
    options: {},
  },
  Task: { options: { status: { Started: "Đang làm" } } },
});

const metadata = {
  scopes: { Task: { statusField: "status" } },
  entityDefs: { Task: { fields: { status: { type: "enum", style: { Started: "primary" } } } } },
};

const base = (parent: StreamContext["parent"]): StreamContext => ({ t, metadata, userId: "me", parent, language: "vi_VN" });

const note = (data: Partial<Note>): Note => ({
  id: "n1",
  createdById: "u1",
  createdByName: "An",
  parentType: "Account",
  parentId: "a1",
  parentName: "Acme",
  ...data,
});

describe("noteMessage", () => {
  it("uses the This form on the record's own stream", () => {
    const message = noteMessage(note({ type: "Create" }), base({ scope: "Account", id: "a1" }));

    expect(message.key).toBe("createThis");
    expect(messageParts(messageTemplate(message, note({}), t), message.data)).toEqual([
      { kind: "record", scope: "User", id: "u1", name: "An" },
      " tạo ",
      { kind: "text", text: "khách hàng" },
    ]);
  });

  it("links the parent record on another record's stream", () => {
    const message = noteMessage(note({ type: "Create", parentType: "Contact", parentId: "c1", parentName: "Bình" }), base({ scope: "Account", id: "a1" }));

    expect(message.key).toBe("create");
    expect(message.data.entity).toEqual({ kind: "record", scope: "Contact", id: "c1", name: "Bình" });
  });

  it("handles assignment variants", () => {
    const self = noteMessage(note({ type: "Create", data: { assignedUserId: "u1", assignedUserName: "An" } }), base({ scope: "Account", id: "a1" }));

    expect(self.key).toBe("createAssignedThisSelf");

    const you = noteMessage(note({ type: "Create", data: { assignedUserId: "me", assignedUserName: "Tôi" } }), base(null));

    expect(you.key).toBe("createAssignedYou");
    expect(noteMessage(note({ type: "Assign", data: {} }), base(null)).key).toBe("assignVoid");
    expect(
      noteMessage(note({ type: "Assign", data: { addedAssignedUsers: [{ id: "x", name: "X" }], removedAssignedUsers: [] } }), base({ scope: "Account", id: "a1" })).key,
    ).toBe("assignMultiAddThis");
  });

  it("translates the status of create/update notes", () => {
    const message = noteMessage(note({ type: "Update", parentType: "Task", data: { value: "Started", fields: ["status"] } }), base(null));

    expect(message.key).toBe("update");
    expect(message.status).toEqual({ kind: "status", text: "Đang làm", style: "primary" });
  });

  it("shows only the author for a post on the record itself", () => {
    const message = noteMessage(note({ type: "Post", post: "hi" }), base({ scope: "Account", id: "a1" }));

    expect(message).toMatchObject({ key: "postThis", template: "{user}" });
    expect(noteMessage(note({ type: "Post", post: null }), base({ scope: "Account", id: "a1" })).key).toBe("attachThis");
  });

  it("describes post targets in the user stream", () => {
    const post = (extra: Partial<Note>) => noteMessage(note({ type: "Post", post: "x", parentType: null, parentId: null, ...extra }), base(null));

    expect(post({ isGlobal: true }).key).toBe("postTargetAll");
    expect(post({ teamsIds: ["t1", "t2"], teamsNames: { t1: "A", t2: "B" } }).key).toBe("postTargetTeams");
    expect(post({ usersIds: ["u1"] }).key).toBe("postTargetSelf");
    expect(post({ usersIds: ["me"] }).key).toBe("postTargetYou");
    expect(post({ usersIds: ["me", "u2"], usersNames: { u2: "Chi" } }).key).toBe("postTargetYouAndOthers");
  });

  it("covers relate and email notes", () => {
    const relate = noteMessage(note({ type: "Relate", relatedType: "Contact", relatedId: "c1", relatedName: "Bình" }), base({ scope: "Account", id: "a1" }));

    expect(relate.key).toBe("relateThis");
    expect(relate.data.relatedEntityType).toEqual({ kind: "text", text: "liên hệ" });

    const email = noteMessage(
      note({ type: "EmailReceived", data: { emailId: "e1", emailName: "Hi", isInitial: true, personEntityType: "Contact", personEntityId: "c1", personEntityName: "Bình" } }),
      base({ scope: "Account", id: "a1" }),
    );

    expect(email.key).toBe("emailReceivedInitialFromThis");
    expect(email.data.from).toMatchObject({ scope: "Contact", id: "c1" });
  });
});

describe("messageTemplate / messageParts", () => {
  it("prefers the gendered template and capitalises a leading entity type", () => {
    const female = note({ type: "Create", createdByGender: "Female", parentType: "Contact", parentId: "c1" });

    expect(messageTemplate(noteMessage(female, base(null)), female, t)).toBe("{user} (nữ) tạo {entityType} {entity}");
    expect(messageParts("{entityType} {missing}!", { entityType: { kind: "text", text: "liên hệ" } })).toEqual([
      { kind: "text", text: "Liên hệ" },
      " ",
      "!",
    ]);
  });
});

describe("toggleReaction", () => {
  it("adds, switches and removes the single reaction", () => {
    expect(toggleReaction(note({ myReactions: [], reactionCounts: null }), "Like")).toEqual({ myReactions: ["Like"], reactionCounts: { Like: 1 } });
    expect(toggleReaction(note({ myReactions: ["Like"], reactionCounts: { Like: 2 } }), "Smile")).toEqual({
      myReactions: ["Smile"],
      reactionCounts: { Like: 1, Smile: 1 },
    });
    expect(toggleReaction(note({ myReactions: ["Like"], reactionCounts: { Like: 1 } }), "Like")).toEqual({ myReactions: [], reactionCounts: {} });
  });
});
