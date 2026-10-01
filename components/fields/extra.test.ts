import { describe, expect, it } from "vitest";
import { durationField, stringifyDuration } from "./extra";
import { applyFormChange, extraSaveAttributes, initNewValues } from "./registry";

describe("stringifyDuration (port classic)", () => {
  it.each([
    [0, "0"],
    [30, "0"],
    [900, "15m"],
    [3600, "1h"],
    [5400, "1h 30m"],
    [90000, "1d 1h"],
  ])("%i → %s", (seconds, expected) => {
    expect(stringifyDuration(seconds)).toBe(expected);
  });

  it("uses translated units", () => {
    expect(stringifyDuration(5400, { h: " giờ", m: " phút" })).toBe("1 giờ 30 phút");
  });
});

describe("duration field hooks", () => {
  const defs = { type: "duration", start: "dateStart", end: "dateEnd", default: 3600 };

  it("moves the end when the start changes, keeping the duration", () => {
    const previous = { dateStart: "2026-10-01 09:00:00", dateEnd: "2026-10-01 10:30:00" };
    const next = { ...previous, dateStart: "2026-10-02 14:00:00" };

    expect(durationField.onFormChange!("duration", defs, previous, next)).toEqual({ dateEnd: "2026-10-02 15:30:00" });
  });

  it("does nothing when the start is unchanged", () => {
    const values = { dateStart: "2026-10-01 09:00:00", dateEnd: "2026-10-01 10:00:00" };

    expect(durationField.onFormChange!("duration", defs, values, { ...values, name: "x" })).toEqual({});
  });

  it("is applied by applyFormChange and saves the end attribute", () => {
    const previous = { dateStart: "2026-10-01 09:00:00", dateEnd: "2026-10-01 10:00:00" };

    expect(
      applyFormChange([{ name: "duration", defs }], previous, { ...previous, dateStart: "2026-10-01 11:00:00" }).dateEnd,
    ).toBe("2026-10-01 12:00:00");
    expect(extraSaveAttributes("duration", defs)).toEqual(["dateEnd"]);
  });
});

describe("duration onInit (new record)", () => {
  const defs = { type: "duration", start: "dateStart", end: "dateEnd", default: 3600 };

  it("computes the end from the start and the default duration", () => {
    expect(initNewValues({ duration: defs }, { dateStart: "2026-10-01 09:00:00" })).toEqual({
      dateStart: "2026-10-01 09:00:00",
      dateEnd: "2026-10-01 10:00:00",
    });
  });

  it("keeps an end that is already set", () => {
    expect(initNewValues({ duration: defs }, { dateStart: "2026-10-01 09:00:00", dateEnd: "2026-10-01 09:30:00" }).dateEnd).toBe(
      "2026-10-01 09:30:00",
    );
  });
});
