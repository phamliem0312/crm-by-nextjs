import { describe, expect, it } from "vitest";
import adminFixture from "./__fixtures__/app-user-admin.json";
import { DateTimeFormat, NumberFormat } from "./format";
import type { Preferences, Settings } from "./types";

// settings thật của bản cài: dateFormat DD.MM.YYYY, timeFormat HH:mm, timeZone UTC,
// thousandSeparator ",", decimalMark ".".
const settings = adminFixture.settings as Settings;

describe("DateTimeFormat with the installed settings", () => {
  const format = new DateTimeFormat(settings, adminFixture.preferences as Preferences);

  it("reads the formats from settings", () => {
    expect(format.dateFormat).toBe(settings.dateFormat);
    expect(format.timeFormat).toBe(settings.timeFormat);
    expect(format.timeZone).toBeNull();
  });

  it("formats dates", () => {
    expect(format.toDisplayDate("2026-09-30")).toBe("30.09.2026");
    expect(format.fromDisplayDate("30.09.2026")).toBe("2026-09-30");
    expect(format.toDisplay("2026-09-30 08:05:00")).toBe("30.09.2026 08:05");
    expect(format.fromDisplay("30.09.2026 08:05")).toBe("2026-09-30 08:05:00");
  });

  it("uses the readable format map", () => {
    expect(format.getReadableDateFormat()).toBe("DD MMM");
  });
});

describe("DateTimeFormat with a time zone", () => {
  const format = new DateTimeFormat(
    { dateFormat: "MM/DD/YYYY", timeFormat: "hh:mm A", timeZone: "UTC" },
    { timeZone: "Asia/Ho_Chi_Minh", dateFormat: "DD/MM/YYYY", weekStart: -1 },
  );

  it("lets preferences override settings, except empty values", () => {
    expect(format.dateFormat).toBe("DD/MM/YYYY");
    expect(format.timeFormat).toBe("hh:mm A");
    expect(format.getTimeZone()).toBe("Asia/Ho_Chi_Minh");
    expect(format.weekStart).toBe(1);
    expect(format.hasMeridian()).toBe(true);
  });

  it("converts between UTC and the user's zone", () => {
    expect(format.toDisplay("2026-09-30 20:30:00")).toBe("01/10/2026 03:30 AM");
    expect(format.fromDisplay("01/10/2026 03:30 AM")).toBe("2026-09-30 20:30:00");
  });

  it("computes today in the user's zone", () => {
    expect(format.getToday(new Date("2026-09-30T18:00:00Z"))).toBe("2026-10-01");
  });

  it("rejects invalid input", () => {
    expect(format.toDisplayDate("not a date")).toBe("");
    expect(format.toDisplay("")).toBe("");
    expect(format.fromDisplayDate("31/02/2026")).toBeNull();
  });

  it("rounds now down to the multiplicity", () => {
    expect(format.getNow(15, new Date("2026-09-30T10:07:40Z"))).toBe("2026-09-30 10:00");
    expect(format.getNow(undefined, new Date("2026-09-30T10:07:40Z"))).toBe("2026-09-30 10:07");
  });
});

describe("NumberFormat", () => {
  it("uses the installed separators", () => {
    const format = new NumberFormat(settings);

    expect(format.formatInt(1234567)).toBe("1,234,567");
    expect(format.formatFloat(1234.5, 2)).toBe("1,234.50");
  });

  it("lets preferences override settings", () => {
    const format = new NumberFormat(settings, { thousandSeparator: ".", decimalMark: "," });

    expect(format.formatInt(1234567)).toBe("1.234.567");
    expect(format.formatFloat(1234.567, 2)).toBe("1.234,57");
  });

  it("allows an empty thousand separator", () => {
    expect(new NumberFormat(settings, { thousandSeparator: "" }).formatInt(1234567)).toBe("1234567");
  });

  it("formats floats like classic", () => {
    const format = new NumberFormat({ thousandSeparator: " ", decimalMark: "," });

    expect(format.formatFloat(0.1 + 0.2)).toBe("0,3");
    expect(format.formatFloat(2.5, 0)).toBe("3");
    expect(format.formatFloat(1000)).toBe("1 000");
    expect(format.formatFloat(null)).toBe("");
    expect(format.formatInt(undefined)).toBe("");
  });
});
