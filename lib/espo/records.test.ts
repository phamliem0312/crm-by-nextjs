import { describe, expect, it } from "vitest";
import { changedAttributes } from "./records";

describe("changedAttributes", () => {
  it("returns only changed attributes, comparing arrays/objects by value", () => {
    expect(
      changedAttributes(
        { name: "Acme", teamsIds: ["t1"], website: null, amount: 10 },
        { name: "Acme 2", teamsIds: ["t1"], website: undefined, amount: 10, type: "Customer" },
      ),
    ).toEqual({ name: "Acme 2", type: "Customer" });
  });

  it("treats undefined and null as equal", () => {
    expect(changedAttributes({ a: null }, { a: undefined })).toEqual({});
  });
});
