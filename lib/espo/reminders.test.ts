import { describe, expect, it } from "vitest";
import { createTranslator } from "./i18n";
import { availableReminderSeconds, parseReminders, stringifyReminderSeconds } from "./reminders";

const t = createTranslator({
  Global: { durationUnits: { d: "d", h: "h", m: "m", s: "s" } },
  Meeting: { labels: { "on time": "đúng giờ", before: "trước" } },
});

describe("stringifyReminderSeconds", () => {
  it("formats like classic", () => {
    expect(stringifyReminderSeconds(0, t)).toBe("đúng giờ");
    expect(stringifyReminderSeconds(900, t)).toBe("15m trước");
    expect(stringifyReminderSeconds(93600, t)).toBe("1d 2h trước");
    expect(stringifyReminderSeconds(3661, t)).toBe("1h 1m 1s trước");
  });
});

describe("availableReminderSeconds", () => {
  const options = [0, 300, 900, 3600, 86400];
  const now = new Date("2026-09-30T10:00:00Z");

  it("keeps only offsets before the start date, plus the current one", () => {
    const start = new Date("2026-09-30T11:00:00Z");

    expect(availableReminderSeconds(options, 300, start, now)).toEqual([0, 300, 900]);
    expect(availableReminderSeconds(options, 86400, start, now)).toEqual([0, 300, 900, 86400]);
  });

  it("allows everything without a start date and adds custom values", () => {
    expect(availableReminderSeconds(options, 120, null, now)).toEqual([0, 120, 300, 900, 3600, 86400]);
  });

  it("limits all-day events to 0 or at least two hours", () => {
    expect(availableReminderSeconds(options, 0, null, now, true)).toEqual([0, 86400]);
  });
});

describe("parseReminders", () => {
  it("normalizes server values", () => {
    expect(parseReminders([{ type: "Email", seconds: "600" }, null, "x"])).toEqual([{ type: "Email", seconds: 600 }]);
    expect(parseReminders(null)).toEqual([]);
  });
});
