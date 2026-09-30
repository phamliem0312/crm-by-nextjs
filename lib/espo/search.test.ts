import { describe, expect, it } from "vitest";
import {
  EMPTY_SEARCH,
  buildSearchParams,
  getWherePart,
  hasActiveSearch,
  parseListState,
  serializeListState,
  type ListState,
} from "./search";

describe("getWherePart (port search-manager)", () => {
  it("builds a simple item with the field as attribute", () => {
    expect(getWherePart("type", { type: "in", value: ["Customer"] }, null)).toEqual({
      type: "in",
      attribute: "type",
      value: ["Customer"],
    });
  });

  it("uses an explicit attribute", () => {
    expect(getWherePart("assignedUser", { type: "equals", attribute: "assignedUserId", value: "u1" }, null)).toEqual({
      type: "equals",
      attribute: "assignedUserId",
      value: "u1",
    });
  });

  it("adds timeZone for date filters", () => {
    expect(getWherePart("createdAt", { type: "today", dateTime: true }, "Asia/Ho_Chi_Minh")).toEqual({
      type: "today",
      attribute: "createdAt",
      dateTime: true,
      timeZone: "Asia/Ho_Chi_Minh",
    });
  });

  it("builds or/and groups recursively and drops invalid items", () => {
    expect(
      getWherePart(
        "x",
        { type: "or", value: { a: { type: "isNull" }, b: { type: "equals", value: 1 }, c: {} as never } },
        null,
      ),
    ).toEqual({
      type: "or",
      value: [
        { type: "isNull", attribute: "a" },
        { type: "equals", attribute: "b", value: 1 },
      ],
    });
  });
});

describe("incomplete filters", () => {
  it("are not sent to the server", () => {
    expect(getWherePart("amount", { type: "between", data: { incomplete: true } }, null)).toBeNull();
  });
});

describe("getWherePart with classic array groups", () => {
  it("reads attribute/field from array items", () => {
    expect(
      getWherePart(
        "website",
        { type: "or", value: [{ type: "isNull", attribute: "website" }, { type: "equals", field: "website", value: "" }] },
        null,
      ),
    ).toEqual({
      type: "or",
      value: [
        { type: "isNull", attribute: "website" },
        { type: "equals", attribute: "website", value: "" },
      ],
    });
  });
});

describe("buildSearchParams", () => {
  it("maps state to the JSON searchParams accepted by Espo", () => {
    expect(
      buildSearchParams(
        {
          textFilter: "acme",
          primary: "recentlyCreated",
          bool: ["onlyMy"],
          advanced: { type: { type: "in", value: ["Customer"] } },
          orderBy: "name",
          order: "desc",
        },
        { select: ["id", "name"], maxSize: 20, offset: 40, timeZone: null },
      ),
    ).toEqual({
      select: ["id", "name"],
      maxSize: 20,
      offset: 40,
      orderBy: "name",
      order: "desc",
      textFilter: "acme",
      primaryFilter: "recentlyCreated",
      boolFilterList: ["onlyMy"],
      where: [{ type: "in", attribute: "type", value: ["Customer"] }],
    });
  });

  it("omits empty parts", () => {
    expect(buildSearchParams(EMPTY_SEARCH)).toEqual({});
  });
});

describe("URL state", () => {
  const defaults = { orderBy: "createdAt", order: "desc" as const };

  it("round-trips through the URL", () => {
    const state: ListState = {
      textFilter: "acme",
      primary: "open",
      bool: ["onlyMy", "followed"],
      advanced: { type: { type: "in", value: ["Customer"] } },
      orderBy: "name",
      order: "asc",
      page: 3,
    };

    expect(parseListState(serializeListState(state, defaults), defaults)).toEqual(state);
  });

  it("keeps the URL empty for the default state", () => {
    expect(serializeListState({ ...EMPTY_SEARCH, ...defaults, page: 1 }, defaults).toString()).toBe("");
  });

  it("ignores broken values", () => {
    const state = parseListState(new URLSearchParams("where=%7Bbad&order=up&page=-2&where2=1"), defaults);

    expect(state).toMatchObject({ advanced: {}, order: "desc", page: 1, orderBy: "createdAt" });
    expect(parseListState(new URLSearchParams('where={"a":1,"b":{"type":"isNull"}}')).advanced).toEqual({
      b: { type: "isNull" },
    });
  });

  it("detects active search", () => {
    expect(hasActiveSearch(EMPTY_SEARCH)).toBe(false);
    expect(hasActiveSearch({ ...EMPTY_SEARCH, bool: ["onlyMy"] })).toBe(true);
  });
});
