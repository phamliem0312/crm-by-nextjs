import { describe, expect, it } from "vitest";
import i18nFixture from "./__fixtures__/i18n.json";
import metadataFixture from "./__fixtures__/metadata-records.json";
import { createTranslator, interpolate, type LanguageData } from "./i18n";
import type { Metadata } from "./types";
import { isFieldEmpty, validateField, validateFields, validatePattern } from "./validation";

const metadata = metadataFixture as unknown as Metadata;
const t = createTranslator(i18nFixture as unknown as LanguageData);
const ctx = (scope: string) => ({ scope, metadata, t });
const label = (scope: string, field: string) => t(field, "fields", scope);

describe("isFieldEmpty", () => {
  it.each([
    ["varchar", "name", { name: "" }, true],
    ["link", "account", { accountId: "a1" }, false],
    ["link", "account", { accountName: "x" }, true],
    ["linkMultiple", "teams", { teamsIds: [] }, true],
    ["linkParent", "parent", { parentId: "1", parentType: null }, true],
    ["address", "billingAddress", { billingAddressCity: "Hanoi" }, false],
    ["personName", "name", { firstName: "", lastName: "Doe" }, false],
    ["personName", "name", { firstName: null, lastName: null }, true],
    ["bool", "flag", {}, false],
  ])("%s %s %j → %s", (type, name, values, expected) => {
    expect(isFieldEmpty(type, name, values)).toBe(expected);
  });
});

describe("validatePattern", () => {
  it("uses named patterns and their messages", () => {
    expect(validatePattern("$noBadCharacters", "Acme <b>", "Name", metadata, t)).toBe(
      interpolate(t("fieldNotMatchingPattern$noBadCharacters", "messages"), { field: "Name" }),
    );
    expect(validatePattern("$noBadCharacters", "Acme", "Name", metadata, t)).toBeNull();
    expect(validatePattern("$digits", "", "N", metadata, t)).toBeNull();
  });

  it("uses raw patterns", () => {
    expect(validatePattern("[a-z]+", "ABC", "Code", metadata, t)).toContain("[a-z]+");
  });
});

describe("validateField với entityDefs thật", () => {
  it("requires Account.name and checks its pattern", () => {
    expect(validateField("name", { name: "" }, ctx("Account"))).toBe(
      interpolate(t("fieldIsRequired", "messages"), { field: label("Account", "name") }),
    );
    expect(validateField("name", { name: "Bad <x>" }, ctx("Account"))).toContain(label("Account", "name"));
    expect(validateField("name", { name: "Acme" }, ctx("Account"))).toBeNull();
  });

  it("checks currency min (Opportunity.amount min 0, required)", () => {
    expect(validateField("amount", { amount: -5 }, ctx("Opportunity"))).toBe(
      interpolate(t("fieldShouldBeGreater", "messages"), { field: label("Opportunity", "amount"), value: 0 }),
    );
    expect(validateField("amount", { amount: null }, ctx("Opportunity"))).toContain(label("Opportunity", "amount"));
    expect(validateField("amount", { amount: "abc" }, ctx("Opportunity"))).toBe(
      interpolate(t("fieldShouldBeFloat", "messages"), { field: label("Opportunity", "amount") }),
    );
  });

  it("checks email addresses", () => {
    expect(validateField("emailAddress", { emailAddress: "bad" }, ctx("Account"))).toBe(
      interpolate(t("fieldShouldBeEmail", "messages"), { field: label("Account", "emailAddress") }),
    );
    expect(
      validateField("emailAddress", { emailAddressData: [{ emailAddress: "a@b.co" }, { emailAddress: "x" }] }, ctx("Account")),
    ).not.toBeNull();
  });

  it("checks date order (Task.dateStart before dateEnd)", () => {
    expect(
      validateField("dateStart", { dateStart: "2026-10-02 10:00:00", dateEnd: "2026-10-01 10:00:00" }, ctx("Task")),
    ).toBe(
      interpolate(t("fieldShouldBefore", "messages"), {
        field: label("Task", "dateStart"),
        otherField: label("Task", "dateEnd"),
      }),
    );
    expect(validateField("dateStart", { dateStart: "2026-10-01 10:00:00", dateEnd: "2026-10-02 10:00:00" }, ctx("Task"))).toBeNull();
  });

  it("checks address part patterns and honours dynamic required", () => {
    expect(validateField("billingAddress", { billingAddressCity: "<x>" }, ctx("Account"))).not.toBeNull();
    expect(validateFields(["name"], { name: "" }, { ...ctx("Account"), isRequired: () => false })).toEqual({});
  });
});
