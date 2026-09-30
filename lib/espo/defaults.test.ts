import { describe, expect, it } from "vitest";
import { resolveDefaultValue } from "./defaults";
import { DateTimeFormat } from "./format";

const dateTime = new DateTimeFormat({ timeZone: "UTC" }, { timeZone: "Asia/Ho_Chi_Minh" });
const now = new Date("2026-09-30T18:07:40Z"); // 01:07 ngày 01/10 ở Asia/Ho_Chi_Minh

describe("resolveDefaultValue (port default-value-provider)", () => {
  it("keeps plain values", () => {
    expect(resolveDefaultValue("Planned", dateTime, now)).toBe("Planned");
    expect(resolveDefaultValue(3600, dateTime, now)).toBe(3600);
  });

  it("evaluates the supported date expressions", () => {
    // Document.publishDate: hôm nay theo múi giờ người dùng.
    expect(resolveDefaultValue("javascript: return this.dateTime.getToday();", dateTime, now)).toBe("2026-10-01");
    // Meeting.dateStart: bây giờ, làm tròn xuống 15 phút (UTC).
    expect(resolveDefaultValue("javascript: return this.dateTime.getNow(15);", dateTime, now)).toBe("2026-09-30 18:00:00");
    expect(resolveDefaultValue("javascript: return this.dateTime.getDateShiftedFromToday(7, 'days');", dateTime, now)).toBe(
      "2026-10-08",
    );
    expect(
      resolveDefaultValue("javascript: return this.dateTime.getDateTimeShiftedFromNow(1, 'hours', 15);", dateTime, now),
    ).toBe("2026-09-30 19:00:00");
  });

  it("ignores anything else instead of running it", () => {
    expect(resolveDefaultValue("javascript: return alert(1);", dateTime, now)).toBeUndefined();
    expect(resolveDefaultValue("javascript: return this.dateTime.getDateShiftedFromToday(1, 'bogus');", dateTime, now)).toBeUndefined();
  });
});
