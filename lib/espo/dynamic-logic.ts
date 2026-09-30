// Dynamic logic: ẩn/hiện, bắt buộc, chỉ đọc field; ẩn/hiện panel; giới hạn option — theo `logicDefs`.
// Port từ `dynamic-logic` của UI classic (espo-main.js @12897). Hàm thuần: trả về trạng thái, UI tự áp.
import dayjs from "./dayjs";
import type { DateTimeFormat } from "./format";

export type LogicCondition = {
  type?: string;
  attribute?: string;
  value?: unknown;
};

export type ConditionItem = { conditionGroup?: LogicCondition[] };

export type LogicDefs = {
  fields?: Record<string, Partial<Record<"visible" | "required" | "readOnly" | "readOnlySaved", ConditionItem>>>;
  panels?: Record<string, Partial<Record<"visible" | "styled", ConditionItem>>>;
  options?: Record<string, { optionList?: string[]; conditionGroup?: LogicCondition[] }[]>;
};

export type LogicContext = {
  userId: string;
  teamsIds: string[];
  dateTime: Pick<DateTimeFormat, "toDayjs" | "getTimeZone" | "systemTimeZone">;
  now?: Date;
};

export type FieldLogicState = { visible?: boolean; required?: boolean; readOnly?: boolean };

export type LogicState = {
  fields: Record<string, FieldLogicState>;
  panels: Record<string, { visible?: boolean; styled?: boolean }>;
  /** `undefined` = dùng option gốc của field. */
  options: Record<string, string[] | undefined>;
};

type Record_ = Record<string, unknown>;

function getValue(attribute: string, record: Record_, ctx: LogicContext): unknown {
  if (attribute === "$user.id") {
    return ctx.userId;
  }

  if (attribute === "$user.teamsIds") {
    return ctx.teamsIds;
  }

  return Object.hasOwn(record, attribute) ? record[attribute] : undefined;
}

const hasIncludes = (value: unknown): value is { includes: (v: unknown) => boolean } =>
  typeof (value as { includes?: unknown } | null)?.includes === "function";

/** Ngày/giờ của giá trị (date `YYYY-MM-DD` theo múi giờ hệ thống, datetime UTC → múi giờ người dùng). */
function toDate(value: string, ctx: LogicContext) {
  return value.length > 10
    ? ctx.dateTime.toDayjs(value)
    : dayjs.tz(value, "YYYY-MM-DD", ctx.dateTime.systemTimeZone);
}

export function checkCondition(defs: LogicCondition, record: Record_, ctx: LogicContext): boolean {
  const type = defs.type || "equals";

  if (type === "or" || type === "and" || type === "not") {
    return checkConditionGroup(defs.value as LogicCondition[] | LogicCondition, record, ctx, type);
  }

  if (!defs.attribute) {
    return false;
  }

  const value = defs.value;
  const setValue = getValue(defs.attribute, record, ctx);

  switch (type) {
    case "equals":
      return setValue === value;
    case "notEquals":
      return setValue !== value;
    case "isEmpty":
      return Array.isArray(setValue) ? !setValue.length : setValue === null || setValue === "" || setValue === undefined;
    case "isNotEmpty":
      return Array.isArray(setValue) ? !!setValue.length : setValue !== null && setValue !== "" && setValue !== undefined;
    case "isTrue":
      return !!setValue;
    case "isFalse":
      return !setValue;
    case "contains":
    case "has":
      return !!setValue && hasIncludes(setValue) && setValue.includes(value);
    case "notContains":
    case "notHas":
      return !setValue || !hasIncludes(setValue) || !setValue.includes(value);
    case "startsWith":
      return typeof setValue === "string" && typeof value === "string" && setValue.startsWith(value);
    case "endsWith":
      return typeof setValue === "string" && typeof value === "string" && setValue.endsWith(value);
    case "matches": {
      if (!setValue || typeof setValue !== "string" || typeof value !== "string") {
        return false;
      }

      const match = /^\/(.*)\/([a-z]*)$/.exec(value);

      return !!match && new RegExp(match[1], match[2]).test(setValue);
    }
    case "greaterThan":
      return (setValue as number) > (value as number);
    case "lessThan":
      return (setValue as number) < (value as number);
    case "greaterThanOrEquals":
      return (setValue as number) >= (value as number);
    case "lessThanOrEquals":
      return (setValue as number) <= (value as number);
    case "in":
      return Array.isArray(value) && value.includes(setValue);
    case "notIn":
      return !Array.isArray(value) || !value.includes(setValue);
    case "isToday":
    case "inFuture":
    case "inPast": {
      if (!setValue || typeof setValue !== "string") {
        return false;
      }

      const date = toDate(setValue, ctx);
      const now = dayjs(ctx.now ?? new Date()).tz(ctx.dateTime.getTimeZone());
      const isDateTime = setValue.length > 10;

      if (type === "isToday") {
        return date.isSame(now, "day");
      }

      return type === "inFuture"
        ? date.isAfter(now, isDateTime ? "second" : "day")
        : date.isBefore(now, isDateTime ? "second" : "day");
    }
    default:
      return false;
  }
}

export function checkConditionGroup(
  data: LogicCondition[] | LogicCondition | undefined,
  record: Record_,
  ctx: LogicContext,
  type: "and" | "or" | "not" = "and",
): boolean {
  if (type === "not") {
    return !!data && !Array.isArray(data) ? !checkCondition(data, record, ctx) : false;
  }

  const list = Array.isArray(data) ? data : [];

  return type === "and"
    ? list.every((item) => checkCondition(item, record, ctx))
    : list.some((item) => checkCondition(item, record, ctx));
}

/**
 * Tính trạng thái dynamic logic cho bản ghi hiện tại.
 *
 * @param saved Bản ghi đã lưu (cho `readOnlySaved`); `null` khi đang tạo mới.
 */
export function evaluateLogic(
  defs: LogicDefs | undefined,
  record: Record_,
  ctx: LogicContext,
  saved: Record_ | null = null,
): LogicState {
  const state: LogicState = { fields: {}, panels: {}, options: {} };

  for (const [field, item] of Object.entries(defs?.fields ?? {})) {
    const fieldState: FieldLogicState = {};
    let readOnlyIsProcessed = false;

    for (const type of ["visible", "required", "readOnlySaved", "readOnly"] as const) {
      const group = item?.[type]?.conditionGroup;

      if (!group) {
        continue;
      }

      if (type === "readOnlySaved") {
        if (!saved) {
          continue;
        }

        fieldState.readOnly = checkConditionGroup(group, saved, ctx);
        readOnlyIsProcessed = fieldState.readOnly;
        continue;
      }

      const result = checkConditionGroup(group, record, ctx);

      if (type === "required") {
        if (!readOnlyIsProcessed) {
          fieldState.required = result;
        }
      } else if (type === "readOnly") {
        fieldState.readOnly = result;
      } else {
        fieldState.visible = result;
      }
    }

    state.fields[field] = fieldState;
  }

  for (const [panel, item] of Object.entries(defs?.panels ?? {})) {
    state.panels[panel] = {};

    for (const type of ["visible", "styled"] as const) {
      const group = item?.[type]?.conditionGroup;

      if (group) {
        state.panels[panel][type] = checkConditionGroup(group, record, ctx);
      }
    }
  }

  for (const [field, items] of Object.entries(defs?.options ?? {})) {
    const matched = (items ?? []).find((item) => checkConditionGroup(item.conditionGroup, record, ctx));

    state.options[field] = matched ? (matched.optionList ?? []) : undefined;
  }

  return state;
}
