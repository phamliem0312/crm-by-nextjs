import { describe, expect, it } from "vitest";
import { classicHref, recordViewHref, safeClassicHash, scopeListHref } from "./routes";

describe("routes", () => {
  it("sends scopes not yet implemented to classic", () => {
    expect(scopeListHref("Account")).toBe("/classic?to=%23Account");
    expect(recordViewHref("Account", "a b")).toBe("/classic?to=%23Account%2Fview%2Fa%2520b");
    expect(classicHref("Admin")).toBe("/classic?to=%23Admin");
  });

  it.each([
    ["#Admin", "#Admin"],
    ["#Account/view/1", "#Account/view/1"],
    [null, "#"],
    ["Admin", "#"],
    ["https://evil.test", "#"],
    ["#a\nb", "#"],
    ["#a\\b", "#"],
  ])("safeClassicHash(%j) → %j", (value, expected) => {
    expect(safeClassicHash(value)).toBe(expected);
  });
});
