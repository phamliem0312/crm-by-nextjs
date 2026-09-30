import { describe, expect, it } from "vitest";
import metadataFixture from "./__fixtures__/metadata-records.json";
import {
  getActualAttributeList,
  getAttributeList,
  getFieldAttributeList,
  getNotActualAttributeList,
  getSelectAttributes,
  isFieldAvailable,
  isFieldFilterable,
  isFieldSortable,
} from "./entity";
import type { Metadata } from "./types";

const metadata = metadataFixture as unknown as Metadata;

describe("attribute lists (port field-manager)", () => {
  it("uses the field name when a type has no actualFields", () => {
    expect(getAttributeList(metadata, "varchar", "name")).toEqual(["name"]);
  });

  it("uses suffix naming by default", () => {
    expect(getActualAttributeList(metadata, "link", "account")).toEqual(["accountId"]);
    expect(getNotActualAttributeList(metadata, "link", "account")).toEqual(["accountName"]);
    expect(getAttributeList(metadata, "address", "billingAddress")).toEqual([
      "billingAddressStreet",
      "billingAddressCity",
      "billingAddressState",
      "billingAddressCountry",
      "billingAddressPostalCode",
    ]);
    // "" trong actualFields = chính tên field.
    expect(getAttributeList(metadata, "currency", "amount")).toEqual(["amountCurrency", "amount"]);
  });

  it("uses prefix naming for personName", () => {
    expect(getAttributeList(metadata, "personName", "name")).toEqual([
      "salutationName",
      "firstName",
      "lastName",
      "middleName",
      "name",
    ]);
  });

  it("adds additional attributes of an entity field", () => {
    expect(getFieldAttributeList(metadata, "Contact", "accounts")).toEqual([
      "accountsIds",
      "accountsNames",
      "accountsColumns",
    ]);
  });

  it("returns nothing for unknown fields", () => {
    expect(getFieldAttributeList(metadata, "Account", "noSuchField")).toEqual([]);
  });
});

describe("field flags", () => {
  it("knows sortable and filterable fields", () => {
    expect(isFieldSortable(metadata, "Account", "name")).toBe(true);
    expect(isFieldSortable(metadata, "Account", "teams")).toBe(false);
    expect(isFieldFilterable(metadata, "varchar")).toBe(true);
  });

  it("knows available fields", () => {
    expect(isFieldAvailable(metadata, "Account", "name")).toBe(true);
    expect(isFieldAvailable(metadata, "Account", "noSuchField")).toBe(false);
  });

  it("builds a select list with id first and no duplicates", () => {
    expect(getSelectAttributes(metadata, "Account", ["name", "assignedUser", "name"])).toEqual([
      "id",
      "name",
      "assignedUserId",
      "assignedUserName",
    ]);
  });
});
