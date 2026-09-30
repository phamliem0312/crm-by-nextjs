import { describe, expect, it } from "vitest";
import metadataFixture from "./__fixtures__/metadata-records.json";
import { checkCondition, checkConditionGroup, evaluateLogic, type LogicContext, type LogicDefs } from "./dynamic-logic";
import { DateTimeFormat } from "./format";

const ctx: LogicContext = {
  userId: "u1",
  teamsIds: ["t1"],
  dateTime: new DateTimeFormat({ timeZone: "UTC" }, { timeZone: "Asia/Ho_Chi_Minh" }),
  now: new Date("2026-09-30T10:00:00Z"),
};

const logicDefs = (metadataFixture as { logicDefs: Record<string, LogicDefs> }).logicDefs;

describe("checkCondition (port dynamic-logic)", () => {
  const record = { status: "New", tags: ["a", "b"], amount: 10, name: "Acme", empty: "", list: [] };

  it.each([
    [{ type: "equals", attribute: "status", value: "New" }, true],
    [{ attribute: "status", value: "New" }, true],
    [{ type: "notEquals", attribute: "status", value: "New" }, false],
    [{ type: "isEmpty", attribute: "empty" }, true],
    [{ type: "isEmpty", attribute: "list" }, true],
    [{ type: "isEmpty", attribute: "missing" }, true],
    [{ type: "isNotEmpty", attribute: "tags" }, true],
    [{ type: "contains", attribute: "tags", value: "a" }, true],
    [{ type: "notContains", attribute: "tags", value: "z" }, true],
    [{ type: "startsWith", attribute: "name", value: "Ac" }, true],
    [{ type: "endsWith", attribute: "name", value: "me" }, true],
    [{ type: "matches", attribute: "name", value: "/^acme$/i" }, true],
    [{ type: "greaterThan", attribute: "amount", value: 5 }, true],
    [{ type: "lessThanOrEquals", attribute: "amount", value: 9 }, false],
    [{ type: "in", attribute: "status", value: ["New", "Assigned"] }, true],
    [{ type: "notIn", attribute: "status", value: ["New"] }, false],
    [{ type: "equals", attribute: "$user.id", value: "u1" }, true],
    [{ type: "contains", attribute: "$user.teamsIds", value: "t1" }, true],
    [{ type: "unknownType", attribute: "status" }, false],
    [{ type: "equals" }, false],
  ])("%j → %s", (condition, expected) => {
    expect(checkCondition(condition, record, ctx)).toBe(expected);
  });

  it("evaluates nested groups", () => {
    const group = [
      { type: "or", value: [{ type: "equals", attribute: "status", value: "X" }, { type: "isTrue", attribute: "amount" }] },
      { type: "not", value: { type: "isEmpty", attribute: "name" } },
    ];

    expect(checkConditionGroup(group, record, ctx)).toBe(true);
  });

  it("handles date conditions in the user's time zone", () => {
    // 10:00 UTC = 17:00 ở Asia/Ho_Chi_Minh ngày 30/09.
    expect(checkCondition({ type: "isToday", attribute: "d" }, { d: "2026-09-30 16:59:00" }, ctx)).toBe(true);
    expect(checkCondition({ type: "isToday", attribute: "d" }, { d: "2026-09-30 17:30:00" }, ctx)).toBe(false);
    expect(checkCondition({ type: "inFuture", attribute: "d" }, { d: "2026-10-01" }, ctx)).toBe(true);
    expect(checkCondition({ type: "inPast", attribute: "d" }, { d: "2026-09-29" }, ctx)).toBe(true);
  });
});

describe("evaluateLogic với logicDefs thật", () => {
  it("Task: dateCompleted chỉ hiện khi status = Completed", () => {
    expect(evaluateLogic(logicDefs.Task, { status: "Completed" }, ctx).fields.dateCompleted).toEqual({ visible: true });
    expect(evaluateLogic(logicDefs.Task, { status: "Started" }, ctx).fields.dateCompleted).toEqual({ visible: false });
  });

  it("Lead: name bắt buộc khi không có account/email/phone; panel convertedTo theo status", () => {
    const empty = evaluateLogic(logicDefs.Lead, { accountName: null, emailAddress: null, phoneNumber: null }, ctx);

    expect(empty.fields.name.required).toBe(true);
    expect(empty.panels.convertedTo.visible).toBe(false);

    const converted = evaluateLogic(logicDefs.Lead, { accountName: "Acme", status: "Converted" }, ctx);

    expect(converted.fields.name.required).toBe(false);
    expect(converted.panels.convertedTo.visible).toBe(true);
  });

  it("applies readOnlySaved only to saved records and option lists", () => {
    const defs: LogicDefs = {
      fields: {
        status: { readOnlySaved: { conditionGroup: [{ type: "equals", attribute: "status", value: "Closed" }] } },
      },
      options: {
        stage: [{ optionList: ["A", "B"], conditionGroup: [{ type: "equals", attribute: "type", value: "x" }] }],
      },
    };

    expect(evaluateLogic(defs, { status: "Closed" }, ctx, null).fields.status).toEqual({});
    expect(evaluateLogic(defs, { status: "Open" }, ctx, { status: "Closed" }).fields.status).toEqual({ readOnly: true });
    expect(evaluateLogic(defs, { type: "x" }, ctx).options.stage).toEqual(["A", "B"]);
    expect(evaluateLogic(defs, { type: "y" }, ctx).options.stage).toBeUndefined();
  });
});
