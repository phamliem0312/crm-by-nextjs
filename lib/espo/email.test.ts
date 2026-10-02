// Test logic Email (thư mục, hành động theo thư mục, trả lời/chuyển tiếp) trên i18n chụp từ Espo thật.
import { describe, expect, it } from "vitest";
import i18n from "./__fixtures__/i18n.json";
import {
  canDropToFolder,
  caseAttributesFromEmail,
  dropAction,
  emailIsRead,
  emailMassActions,
  folderEntries,
  folderWhere,
  forwardAttributes,
  moveFolderOptions,
  moveFolderParamsFor,
  parseAddressFromStringAddress,
  parseAddressInput,
  parseNameFromStringAddress,
  personAttributesFromEmail,
  replyAttributes,
  sendingFailedMessage,
  subjectStyle,
  withSignature,
} from "./email";
import { DateTimeFormat } from "./format";
import { createTranslator, type LanguageData } from "./i18n";

const t = createTranslator(i18n as unknown as LanguageData);
const dateTime = new DateTimeFormat({ dateFormat: "DD.MM.YYYY", timeFormat: "HH:mm", timeZone: "UTC" });
const folders = [
  { id: "inbox", name: "Inbox" },
  { id: "important", name: "Important" },
  { id: "sent", name: "Sent" },
  { id: "f1", name: "Khách hàng" },
  { id: "group:g1", name: "Support" },
  { id: "archive", name: "Archive" },
  { id: "drafts", name: "Drafts" },
  { id: "trash", name: "Trash" },
];

describe("folders", () => {
  it("decorates the folder list like classic", () => {
    const entries = folderEntries(folders, t);
    const byId = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

    expect(byId.inbox).toMatchObject({ name: "Inbox", icon: "fas fa-inbox", groupStart: true, droppable: true, title: null });
    expect(byId.sent).toMatchObject({ droppable: false, icon: "far fa-paper-plane" });
    expect(byId.drafts.droppable).toBe(false);
    expect(byId.f1).toMatchObject({ name: "Khách hàng", icon: "far fa-folder", title: "Folder" });
    expect(byId["group:g1"]).toMatchObject({ icon: "far fa-circle", groupStart: true, title: "Group Folder" });
    expect(byId.archive.groupStart).toBe(true);
    expect(byId.trash.groupStart).toBe(false);
  });

  it("filters the list with inFolder", () => {
    expect(folderWhere("inbox")).toEqual([{ type: "inFolder", attribute: "folderId", value: "inbox" }]);
    expect(folderWhere(null)).toEqual([]);
  });

  it("allows drops like views/email/list.isDroppable", () => {
    expect(canDropToFolder("inbox", "trash")).toBe(true);
    expect(canDropToFolder("inbox", "sent")).toBe(false);
    expect(canDropToFolder("drafts", "inbox")).toBe(false);
    expect(canDropToFolder("sent", "inbox")).toBe(false);
    expect(canDropToFolder("all", "f1")).toBe(false);
    expect(canDropToFolder("all", "group:g1")).toBe(true);
    expect(canDropToFolder("group:g1", "f1")).toBe(false);
    expect(canDropToFolder("group:g1", "all")).toBe(true);
    expect(canDropToFolder("inbox", "inbox")).toBe(false);
  });

  it("maps drops to actions", () => {
    expect(dropAction("inbox", "important")).toEqual({ kind: "important" });
    expect(dropAction("inbox", "trash")).toEqual({ kind: "trash" });
    expect(dropAction("trash", "f1")).toEqual({ kind: "retrieveAndMove", folderId: "f1" });
    expect(dropAction("group:g1", "all")).toEqual({ kind: "move", folderId: "inbox" });
    expect(dropAction("inbox", "archive")).toEqual({ kind: "move", folderId: "archive" });
  });

  it("shows mass actions per folder", () => {
    expect(emailMassActions("inbox")).toEqual([
      "moveToTrash",
      "moveToArchive",
      "moveToFolder",
      "markAsImportant",
      "markAsNotImportant",
      "markAsRead",
      "markAsNotRead",
    ]);
    expect(emailMassActions("trash")).toEqual(["retrieveFromTrash", "moveToFolder", "markAsImportant", "markAsNotImportant", "markAsRead", "markAsNotRead"]);
    expect(emailMassActions("all")).toEqual(["moveToFolder", "markAsNotImportant", "markAsRead"]);
  });

  it("builds Move to Folder options", () => {
    const personal = moveFolderOptions(folders, { isGroup: false, noArchive: false, currentFolderId: "f1" }, t);

    expect(personal.map((item) => item.id)).toEqual(["inbox", "f1", "group:g1", "archive"]);
    expect(personal.find((item) => item.id === "f1")?.disabled).toBe(true);

    const group = moveFolderOptions(folders, { isGroup: true, noArchive: true, currentFolderId: null }, t);

    expect(group.map((item) => [item.id, item.name])).toEqual([
      ["inbox", "All"],
      ["group:g1", "Support"],
    ]);
  });

  it("derives the folder state of an email", () => {
    expect(moveFolderParamsFor({ isUsers: true, folderId: "f1" })).toEqual({ isGroup: false, noArchive: false, currentFolderId: "f1" });
    expect(moveFolderParamsFor({ isUsers: true, inArchive: true })).toMatchObject({ currentFolderId: "archive" });
    expect(moveFolderParamsFor({ groupFolderId: "g1", groupStatusFolder: null })).toEqual({
      isGroup: true,
      noArchive: false,
      currentFolderId: "group:g1",
    });
    expect(moveFolderParamsFor({ isUsers: false })).toMatchObject({ isGroup: true, noArchive: true });
    expect(subjectStyle({ isImportant: true, inTrash: true })).toBe("important");
    expect(subjectStyle({ groupFolderId: "g", groupStatusFolder: "Trash" })).toBe("trash");
    expect(subjectStyle({ inArchive: true })).toBe("archive");
    expect(emailIsRead({ isRead: false, sentById: "me" }, "me")).toBe(true);
    expect(emailIsRead({ isRead: false }, "me")).toBe(false);
    expect(emailIsRead({}, "me")).toBe(true);
  });
});

describe("addresses", () => {
  it("parses string addresses", () => {
    expect(parseNameFromStringAddress('"An Nguyễn" <an@x.vn>')).toBe("An Nguyễn");
    expect(parseNameFromStringAddress("an@x.vn")).toBeNull();
    expect(parseAddressFromStringAddress("An <an@x.vn>")).toBe("an@x.vn");
    expect(parseAddressFromStringAddress(" an@x.vn ")).toBe("an@x.vn");
    expect(parseAddressInput("An <an@x.vn>, b@y.vn;\n")).toEqual([
      { address: "an@x.vn", name: "An" },
      { address: "b@y.vn", name: null },
    ]);
  });
});

describe("reply / forward", () => {
  const user = {
    id: "me",
    emailAddress: "me@corp.vn",
    emailAddressList: ["me@corp.vn"],
    userEmailAddressList: ["me@corp.vn"],
    excludeFromReplyEmailAddressList: ["noreply@corp.vn"],
    defaultTeamId: "t2",
    defaultTeamName: "Sales",
  };
  const received = {
    id: "e1",
    name: "Báo giá",
    from: "an@x.vn",
    fromString: "An Nguyễn <an@x.vn>",
    to: "me@corp.vn;noreply@corp.vn;binh@x.vn",
    cc: "chi@x.vn",
    isHtml: true,
    body: "<p>Xin chào</p>",
    dateSent: "2026-09-30 07:05:00",
    messageId: "<m1@x.vn>",
    parentType: "Account",
    parentId: "a1",
    parentName: "Acme",
    teamsIds: ["t1"],
    teamsNames: { t1: "Support" },
  };

  it("replies to the sender and quotes the body", () => {
    const attributes = replyAttributes(received, { cc: false, user, dateTime, t, now: new Date("2026-10-01T00:00:00Z") });

    expect(attributes).toMatchObject({
      status: "Draft",
      name: "Re: Báo giá",
      to: "an@x.vn",
      from: "me@corp.vn",
      parentId: "a1",
      repliedId: "e1",
      inReplyTo: "<m1@x.vn>",
      teamsIds: ["t1", "t2"],
      nameHash: { "an@x.vn": "An Nguyễn" },
    });
    expect(attributes.cc).toBeUndefined();
    expect(attributes.body).toBe('<p data-quote-start="true"><br></p><p>30 Sep 07:05:</p><blockquote><p>Xin chào</p></blockquote>');
  });

  it("reply all adds the other recipients to CC", () => {
    const attributes = replyAttributes(received, { cc: true, user, dateTime, t, canAssignTeam: (id) => id !== "t1" });

    expect(attributes.cc).toBe("chi@x.vn;binh@x.vn");
    expect(attributes.teamsIds).toEqual(["t2"]);
  });

  it("replying on a sent email goes back to its recipients", () => {
    const sent = { ...received, from: "me@corp.vn", to: "an@x.vn", cc: "", name: "RE: Hợp đồng", isHtml: false, body: "a\nb" };
    const attributes = replyAttributes(sent, { cc: true, user, dateTime, t, now: new Date("2027-01-02T00:00:00Z") });

    expect(attributes.name).toBe("RE: Hợp đồng");
    expect(attributes.to).toBe("an@x.vn");
    expect(attributes.body).toBe("\n\n30 Sep 07:05, 2026:\n> a\n> b\n");
    expect(attributes.bodyPlain).toBe(attributes.body);
  });

  it("uses Reply-To when present", () => {
    const attributes = replyAttributes({ ...received, replyToString: "Hỗ trợ <help@x.vn>" }, { cc: false, user, dateTime, t });

    expect(attributes.to).toBe("help@x.vn");
    expect((attributes.nameHash as Record<string, string>)["help@x.vn"]).toBe("Hỗ trợ");
  });

  it("forwards with a header block", () => {
    const attributes = forwardAttributes({ ...received, nameHash: { "an@x.vn": "An <&>" } }, { dateTime, t });

    expect(attributes.name).toBe("Fwd: Báo giá");
    expect(attributes.body).toBe(
      "<br>------Forwarded message------<br>From: An &lt;&amp;&gt; &lt;an@x.vn&gt;<br>Date Sent: 30.09.2026 07:05<br>Subject: Báo giá" +
        "<br>To: &lt;me@corp.vn&gt;;&lt;noreply@corp.vn&gt;;&lt;binh@x.vn&gt;<br><br><p>Xin chào</p>",
    );
    expect(forwardAttributes({ ...received, name: "Fwd: x" }, { dateTime, t }).name).toBe("Fwd: x");
  });
});

describe("helpers", () => {
  it("adds the signature", () => {
    expect(withSignature("<blockquote>q</blockquote>", true, "<p>Ký</p>", "prepend")).toBe("<p><br></p><p>Ký</p><blockquote>q</blockquote>");
    expect(withSignature("", false, "Tên<br>Công ty", "prepend")).toBe("\n\nTên\nCông ty");
    expect(withSignature("body", true, "", "append")).toBe("body");
  });

  it("prefills Lead/Contact/Case from an email", () => {
    expect(personAttributesFromEmail({ id: "e1", from: "an@x.vn", fromString: "Nguyễn Văn An <an@x.vn>" })).toEqual({
      firstName: "Nguyễn Văn",
      lastName: "An",
      emailAddress: "an@x.vn",
      originalEmailId: "e1",
    });
    expect(
      caseAttributesFromEmail({ id: "e1", name: "Lỗi", bodyPlain: "chi tiết", parentType: "Contact", parentId: "c1", parentName: "Bình", accountId: "a1" }),
    ).toMatchObject({ contactId: "c1", contactsIds: ["c1"], accountId: "a1", accountName: "a1", name: "Lỗi", description: "chi tiết" });
  });

  it("formats send failures", () => {
    expect(sendingFailedMessage(null, t)).toBe("Email sending failed");
    expect(sendingFailedMessage("recipientAddressRejected", t)).toBe("Email sending failed: Recipient address rejected.");
  });
});
