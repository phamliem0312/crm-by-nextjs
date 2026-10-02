// Test logic Import (đọc CSV, attribute ghép cột, nhãn, tham số) trên metadata/i18n chụp từ Espo thật.
import { describe, expect, it } from "vitest";
import appUserAdmin from "./__fixtures__/app-user-admin.json";
import appUserLimited from "./__fixtures__/app-user-limited.json";
import i18n from "./__fixtures__/i18n.json";
import metadataPhase4 from "./__fixtures__/metadata-phase4.json";
import metadataRecords from "./__fixtures__/metadata-records.json";
import { Acl } from "./acl";
import { createTranslator, type LanguageData } from "./i18n";
import {
  csvToArray,
  defaultImportParams,
  formatSample,
  guessAttribute,
  importableScopes,
  importAttributeLabel,
  importAttributeList,
  importFieldList,
  isImportRunning,
  mappingRows,
  personNameFormats,
} from "./import";
import type { AppUserData, Metadata } from "./types";

const records = metadataRecords as unknown as Metadata & { entityDefs: Record<string, unknown>; fields: unknown };
const phase4 = metadataPhase4 as unknown as Metadata;
const metadata: Metadata = { ...records, scopes: { ...records.scopes, ...phase4.scopes } };
const admin = appUserAdmin as unknown as AppUserData;
const limited = appUserLimited as unknown as AppUserData;
const adminAcl = new Acl(admin.acl, admin.user);
const t = createTranslator(i18n as unknown as LanguageData);

describe("csvToArray", () => {
  it("parses quoted cells, escaped quotes and line breaks", () => {
    expect(csvToArray('name,email\n"Acme, Inc","a@x.vn"\n"Say ""hi""",b@x.vn\r\n"Line\nbreak",')).toEqual([
      ["name", "email"],
      ["Acme, Inc", "a@x.vn"],
      ['Say "hi"', "b@x.vn"],
      ["Line\nbreak", ""],
    ]);
  });

  it("supports other delimiters and qualifiers", () => {
    expect(csvToArray("a;b\n'x;y';z", ";", "'")).toEqual([
      ["a", "b"],
      ["x;y", "z"],
    ]);
    expect(csvToArray("a\tb\n1\t2", "\\t")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("import setup", () => {
  it("lists importable entities the user can create", () => {
    const scopes = importableScopes(metadata, adminAcl, t);

    expect(scopes).toEqual(expect.arrayContaining(["Account", "Contact", "Lead", "Opportunity", "Case", "Task"]));
    expect(importableScopes(metadata, new Acl(limited.acl, limited.user), t)).toEqual(["Account"]);
  });

  it("reads defaults and formats", () => {
    expect(defaultImportParams({ defaultCurrency: "USD" }, { importParams: { default: { delimiter: ";", headerRow: false } } }, "Account")).toMatchObject({
      entityType: "Account",
      action: "create",
      delimiter: ";",
      headerRow: false,
      currency: "USD",
      silentMode: true,
    });
    expect(formatSample("DD.MM.YYYY")).toBe("DD.MM.YYYY · 27.12.2021");
    expect(formatSample("hh:mm a")).toBe("hh:mm a · 11:00 pm");
    expect(personNameFormats({ personNameFormat: "firstMiddleLast" })).toEqual(["f l", "l f", "l, f", "f m l", "l f m"]);
    expect(isImportRunning("In Process")).toBe(true);
    expect(isImportRunning("Complete")).toBe(false);
  });
});

describe("mapping", () => {
  it("lists attributes like step 2 of classic", () => {
    const attributes = importAttributeList(metadata, "Account", adminAcl, t);

    expect(attributes).toEqual(expect.arrayContaining(["id", "name", "emailAddress", "emailAddress2", "billingAddressCity", "assignedUserId", "assignedUserName"]));
    expect(attributes.some((item) => item.startsWith("phoneNumber") && item !== "phoneNumber")).toBe(true);
    expect(importFieldList(metadata, "Account", adminAcl, t)).toEqual(expect.arrayContaining(["name", "industry", "createdAt"]));
  });

  it("labels attributes", () => {
    expect(importAttributeLabel("name", "Account", metadata, t)).toBe("Name");
    expect(importAttributeLabel("assignedUserId", "Account", metadata, t)).toBe("Assigned User (ID)");
    expect(importAttributeLabel("emailAddress2", "Account", metadata, t)).toBe("Email 2");
    expect(importAttributeLabel("phoneNumberOffice", "Account", metadata, t)).toMatch(/^Phone \(/);
  });

  it("guesses columns from the header row", () => {
    const attributes = ["id", "name", "emailAddress", "billingAddressCity"];

    expect(guessAttribute("name", attributes)).toBe("name");
    expect(guessAttribute("Email_Address", attributes)).toBe("emailAddress");
    expect(guessAttribute("Something", attributes)).toBeNull();
    expect(mappingRows([["name", "email"], ["Acme", "a@x.vn"]], true)).toEqual([
      { header: "name", value: "Acme" },
      { header: "email", value: "a@x.vn" },
    ]);
    expect(mappingRows([["Acme", "a@x.vn"]], false)).toEqual([
      { header: null, value: "Acme" },
      { header: null, value: "a@x.vn" },
    ]);
  });
});
