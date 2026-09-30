import { describe, expect, it } from "vitest";
import { loginUrl, safeNextPath } from "./client";

describe("safeNextPath", () => {
  it.each([
    ["/Account/123?x=1", "/Account/123?x=1"],
    ["/", "/"],
    [null, "/"],
    ["", "/"],
    ["https://evil.test", "/"],
    ["//evil.test", "/"],
    ["/\\evil.test", "/"],
    ["Account", "/"],
  ])("%j → %j", (value, expected) => {
    expect(safeNextPath(value)).toBe(expected);
  });
});

describe("loginUrl", () => {
  it("adds next only for non-root paths", () => {
    expect(loginUrl()).toBe("/login");
    expect(loginUrl("/")).toBe("/login");
    expect(loginUrl("/Account?a=1")).toBe("/login?next=%2FAccount%3Fa%3D1");
  });
});
