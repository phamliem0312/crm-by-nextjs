// Nhắc nhở của Meeting/Call/Task (field `reminders`, jsonArray). Port từ `crm:views/meeting/fields/reminders`.
import type { Translator } from "./i18n";
import type { Metadata } from "./types";

export type Reminder = { type: string; seconds: number };

/** "15m trước", "1d 2h trước", "đúng giờ" (giống `stringifySeconds` của classic). */
export function stringifyReminderSeconds(totalSeconds: number, t: Translator): string {
  if (!totalSeconds) {
    return t("on time", "labels", "Meeting");
  }

  const units: [number, string][] = [
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
    [1, "s"],
  ];
  let rest = totalSeconds;
  const parts: string[] = [];

  for (const [size, unit] of units) {
    const amount = Math.floor(rest / size);

    rest %= size;

    if (amount) {
      parts.push(`${amount}${t(unit, "durationUnits")}`);
    }
  }

  return `${parts.join(" ")} ${t("before", "labels", "Meeting")}`;
}

export function reminderTypeOptions(metadata: Metadata): string[] {
  const defs = (metadata.entityDefs as Record<string, { fields?: Record<string, { options?: unknown[] }> }> | undefined)?.Reminder;

  return (defs?.fields?.type?.options ?? ["Popup", "Email"]).map(String);
}

export function reminderSecondsOptions(metadata: Metadata): number[] {
  const defs = (metadata.entityDefs as Record<string, { fields?: Record<string, { options?: unknown[] }> }> | undefined)?.Reminder;

  return (defs?.fields?.seconds?.options ?? [0, 300, 600, 900, 1800, 3600, 7200, 10800, 18000, 86400]).map(Number);
}

export function defaultReminder(metadata: Metadata): Reminder {
  const fields = (metadata.entityDefs as Record<string, { fields?: Record<string, { default?: unknown }> }> | undefined)?.Reminder
    ?.fields;

  return {
    type: typeof fields?.type?.default === "string" ? fields.type.default : "Popup",
    seconds: typeof fields?.seconds?.default === "number" ? fields.seconds.default : 0,
  };
}

/**
 * Các mốc chọn được cho một nhắc nhở: chỉ những mốc còn trước ngày bắt đầu (nếu biết), luôn giữ mốc đang chọn.
 * Sự kiện cả ngày (datetimeOptional chỉ có ngày) chỉ nhận mốc 0 hoặc ≥ 2 giờ, như classic.
 */
export function availableReminderSeconds(
  options: number[],
  current: number,
  startUtc: Date | null,
  now: Date,
  allDay = false,
): number[] {
  let list = [...options];

  if (allDay) {
    list = list.filter((seconds) => !seconds || seconds >= 7200);
  }

  if (!list.includes(current)) {
    list.push(current);
  }

  return list
    .filter((seconds) => seconds === current || !startUtc || now.getTime() + seconds * 1000 < startUtc.getTime())
    .sort((a, b) => a - b);
}

export function parseReminders(value: unknown): Reminder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({ type: String(item.type ?? "Popup"), seconds: Number(item.seconds ?? 0) || 0 }));
}
