// Test logic lịch (sự kiện, màu, cả ngày, kéo thả, chọn khoảng) trên metadata chụp từ Espo thật.
import { describe, expect, it } from "vitest";
import appUserAdmin from "./__fixtures__/app-user-admin.json";
import appUserLimited from "./__fixtures__/app-user-limited.json";
import metadataPhase3 from "./__fixtures__/metadata-phase3.json";
import metadataPhase4 from "./__fixtures__/metadata-phase4.json";
import metadataRecords from "./__fixtures__/metadata-records.json";
import { Acl } from "./acl";
import {
  allDayScopes,
  calendarColors,
  calendarScopes,
  calendarSlots,
  createAttributes,
  droppedAttributes,
  eventTimeFormat,
  resolveMode,
  selectionValues,
  shadeColor,
  toCalendarEvent,
  wallNow,
  wallToSystem,
  type CalendarContext,
} from "./calendar";
import type { AppUserData, Metadata } from "./types";

const phase3 = metadataPhase3 as unknown as Metadata & { entityDefs: Record<string, unknown> };
const records = metadataRecords as unknown as Metadata & { entityDefs: Record<string, unknown> };
const phase4 = metadataPhase4 as unknown as Metadata;
const metadata: Metadata = {
  scopes: { ...records.scopes, ...phase3.scopes, ...phase4.scopes },
  entityDefs: { ...records.entityDefs, ...phase3.entityDefs },
  clientDefs: { ...(records.clientDefs as object), ...(phase3.clientDefs as object), ...(phase4.clientDefs as object) },
};
const admin = appUserAdmin as unknown as AppUserData;
const limited = appUserLimited as unknown as AppUserData;
const scopes = ["Meeting", "Call", "Task"];
const ctx = (timeZone: string): CalendarContext => ({
  timeZone,
  allDayScopes: allDayScopes(metadata, scopes),
  colors: calendarColors(metadata, scopes),
  metadata,
  isAgenda: true,
});

describe("calendar setup", () => {
  it("lists readable calendar scopes", () => {
    expect(calendarScopes({ calendarEntityList: ["Meeting", "Call", "Task"] }, metadata, new Acl(admin.acl, admin.user))).toEqual(scopes);
    expect(calendarScopes({ calendarEntityList: ["Meeting", "Call", "Task"] }, metadata, new Acl(limited.acl, limited.user))).toEqual([]);
  });

  it("marks one-day scopes and colors", () => {
    expect(allDayScopes(metadata, scopes)).toEqual(["Task"]);
    expect(calendarColors(metadata, scopes)).toMatchObject({ Meeting: "#558BBD", Call: "#CF605D", Task: "#70c173" });
    expect(calendarColors({ clientDefs: { Calendar: { colors: {}, additionalColorList: ["#111111", "#222222"] } } }, ["A", "B", "C"])).toEqual({
      A: "#111111",
      B: "#222222",
      C: "#111111",
    });
    expect(shadeColor("#558BBD", 0.4)).toBe("#99b9d7");
  });

  it("reads slots and modes", () => {
    expect(calendarSlots({}, metadata)).toEqual({ slotMinutes: 30, scrollHour: 6 });
    expect(calendarSlots({ calendarSlotDuration: 15, calendarScrollHour: null }, metadata)).toEqual({ slotMinutes: 15, scrollHour: 8 });
    expect(resolveMode("month", [])).toMatchObject({ viewMode: "month", teamIdList: null });
    expect(resolveMode("view-v1", [{ id: "v1", name: "Sales", mode: "basicWeek", teamIdList: ["t1"] }])).toMatchObject({
      viewMode: "basicWeek",
      teamIdList: ["t1"],
    });
    expect(resolveMode("nope", []).viewMode).toBe("agendaWeek");
    expect(eventTimeFormat("hh:mm a")).toMatchObject({ hour12: true });
  });
});

describe("toCalendarEvent", () => {
  it("shows meetings in the user's time zone", () => {
    const event = toCalendarEvent(
      { scope: "Meeting", id: "m1", name: "Họp", dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 03:30:00", status: "Planned" },
      ctx("Asia/Ho_Chi_Minh"),
    );

    expect(event).toMatchObject({
      id: "Meeting-m1",
      title: "Họp",
      start: "2026-10-01T09:00:00",
      end: "2026-10-01T10:30:00",
      allDay: false,
      color: "#558BBD",
      classNames: [],
    });
    expect(event.extendedProps).toMatchObject({ duration: 5400, allDayCopy: false });
  });

  it("dims held/not held and strikes canceled", () => {
    const held = toCalendarEvent({ scope: "Call", id: "c1", dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 02:30:00", status: "Held" }, ctx("UTC"));
    const notHeld = toCalendarEvent({ scope: "Call", id: "c2", dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 02:30:00", status: "Not Held" }, ctx("UTC"));

    expect(held.color).toBe(shadeColor("#CF605D", 0.4));
    expect(notHeld.classNames).toEqual(["event-canceled"]);
  });

  it("puts tasks on their due day", () => {
    const due = toCalendarEvent({ scope: "Task", id: "t1", dateEnd: "2026-10-03 08:00:00", status: "Started" }, ctx("UTC"));

    expect(due).toMatchObject({ allDay: true, start: "2026-10-03", end: "2026-10-04" });

    const midnight = toCalendarEvent({ scope: "Task", id: "t2", dateEnd: "2026-10-03 17:00:00" }, ctx("Asia/Ho_Chi_Minh"));

    expect(midnight).toMatchObject({ allDay: true, start: "2026-10-03", end: "2026-10-04" });

    const dateOnly = toCalendarEvent({ scope: "Task", id: "t3", dateEndDate: "2026-10-05" }, ctx("UTC"));

    expect(dateOnly).toMatchObject({ allDay: true, start: "2026-10-05", end: "2026-10-06" });
  });

  it("handles all-day and multi-day meetings", () => {
    expect(toCalendarEvent({ scope: "Meeting", id: "m2", dateStartDate: "2026-10-01", dateEndDate: "2026-10-02" }, ctx("UTC"))).toMatchObject({
      allDay: true,
      start: "2026-10-01",
      end: "2026-10-03",
    });
    expect(toCalendarEvent({ scope: "Meeting", id: "m3", dateStart: "2026-10-01 09:00:00", dateEnd: "2026-10-03 10:00:00" }, ctx("UTC"))).toMatchObject({
      allDay: true,
      start: "2026-10-01",
      end: "2026-10-04",
    });
  });

  it("renders working ranges as background", () => {
    expect(toCalendarEvent({ scope: "WorkingTimeRange", id: "w", isWorkingRange: true, dateStart: "2026-10-01 01:00:00", dateEnd: "2026-10-01 10:00:00" }, ctx("UTC"))).toMatchObject({
      display: "inverse-background",
      groupId: "nonWorking",
    });
  });
});

describe("editing on the calendar", () => {
  it("converts wall-clock dates back to UTC", () => {
    expect(wallToSystem(new Date("2026-10-01T09:00:00Z"), "Asia/Ho_Chi_Minh")).toBe("2026-10-01 02:00:00");
    expect(wallNow("Asia/Ho_Chi_Minh", new Date("2026-10-01T20:30:00Z"))).toBe("2026-10-02T03:30:00");
  });

  it("moves events by the drop delta", () => {
    const props = toCalendarEvent({ scope: "Meeting", id: "m1", dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 03:00:00" }, ctx("Asia/Ho_Chi_Minh")).extendedProps;

    expect(droppedAttributes(props, { days: 1, milliseconds: 3_600_000 }, false, { timeZone: "Asia/Ho_Chi_Minh", onlyDateScopes: [] })).toEqual({
      dateStart: "2026-10-02 03:00:00",
      dateEnd: "2026-10-02 04:00:00",
    });
    expect(droppedAttributes(props, { days: 1 }, true, { timeZone: "UTC", onlyDateScopes: [] })).toBeNull();

    const allDay = toCalendarEvent({ scope: "Meeting", id: "m2", dateStartDate: "2026-10-01", dateEndDate: "2026-10-02" }, ctx("UTC")).extendedProps;

    expect(droppedAttributes(allDay, { months: 1 }, true, { timeZone: "UTC", onlyDateScopes: [] })).toEqual({
      dateStartDate: "2026-11-01",
      dateEndDate: "2026-11-02",
    });
  });

  it("prefills new records from a selection", () => {
    const timed = selectionValues(new Date("2026-10-01T09:00:00Z"), new Date("2026-10-01T10:00:00Z"), false, "Asia/Ho_Chi_Minh");

    expect(timed).toEqual({ dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 03:00:00", allDay: false, dateStartDate: null, dateEndDate: null });
    expect(createAttributes("Call", timed, { metadata, allDayScopes: ["Task"] })).toEqual({ dateStart: "2026-10-01 02:00:00", dateEnd: "2026-10-01 03:00:00" });

    const days = selectionValues(new Date("2026-10-01T00:00:00Z"), new Date("2026-10-03T00:00:00Z"), true, "UTC");

    expect(days).toMatchObject({ dateStartDate: "2026-10-01", dateEndDate: "2026-10-02" });
    expect(createAttributes("Meeting", days, { metadata, allDayScopes: ["Task"] })).toEqual({
      dateStart: null,
      dateEnd: null,
      dateStartDate: "2026-10-01",
      dateEndDate: "2026-10-02",
      isAllDay: true,
    });
    expect(createAttributes("Task", days, { metadata, allDayScopes: ["Task"] })).toEqual({
      dateStart: null,
      dateEnd: null,
      dateStartDate: "2026-10-01",
      dateEndDate: "2026-10-02",
    });
    expect(createAttributes("Call", days, { metadata, allDayScopes: ["Task"] })).toMatchObject({ isAllDay: false, dateStartDate: null });
  });
});
