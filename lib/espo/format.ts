// Định dạng ngày giờ và số theo settings/preferences. Port từ `date-time` (@956) và `number-util` (@37581)
// của UI classic; moment → dayjs (cùng token định dạng: YYYY, MM, DD, HH, hh, mm, A…).
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { Preferences, Settings } from "./types";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const INTERNAL_DATE_FORMAT = "YYYY-MM-DD";
export const INTERNAL_DATE_TIME_FORMAT = "YYYY-MM-DD HH:mm";
export const INTERNAL_DATE_TIME_FULL_FORMAT = "YYYY-MM-DD HH:mm:ss";

const READABLE_DATE_FORMAT: Record<string, string> = { "DD.MM.YYYY": "DD MMM", "DD/MM/YYYY": "DD MMM" };
const READABLE_SHORT_DATE_FORMAT: Record<string, string> = { "DD.MM.YYYY": "D MMM", "DD/MM/YYYY": "D MMM" };

/** Giá trị preference rỗng (null, "", -1) nghĩa là dùng setting chung. */
function preferred<T>(preference: T | null | undefined, setting: T | undefined, fallback: T): T {
  if (preference !== null && preference !== undefined && preference !== "" && preference !== -1) {
    return preference;
  }

  return setting ?? fallback;
}

export class DateTimeFormat {
  readonly dateFormat: string;
  readonly timeFormat: string;
  /** `null` = UTC (giống classic: timeZone "UTC" được coi như không đặt). */
  readonly timeZone: string | null;
  readonly systemTimeZone: string;
  readonly weekStart: number;

  constructor(settings: Settings, preferences: Preferences = {}) {
    this.dateFormat = preferred(preferences.dateFormat, settings.dateFormat, "MM/DD/YYYY");
    this.timeFormat = preferred(preferences.timeFormat, settings.timeFormat, "HH:mm");
    this.systemTimeZone = settings.timeZone || "UTC";

    const timeZone = preferred(preferences.timeZone, settings.timeZone, "UTC");

    this.timeZone = timeZone === "UTC" ? null : timeZone;
    this.weekStart = preferred(preferences.weekStart, settings.weekStart, 1);
  }

  getTimeZone(): string {
    return this.timeZone ?? "UTC";
  }

  getDateTimeFormat(): string {
    return `${this.dateFormat} ${this.timeFormat}`;
  }

  getReadableDateFormat(): string {
    return READABLE_DATE_FORMAT[this.dateFormat] ?? "MMM DD";
  }

  getReadableShortDateFormat(): string {
    return READABLE_SHORT_DATE_FORMAT[this.dateFormat] ?? "MMM D";
  }

  hasMeridian(): boolean {
    return /A/i.test(this.timeFormat);
  }

  /** `2026-09-30` → `09/30/2026` (theo định dạng người dùng). */
  toDisplayDate(value: string | null | undefined): string {
    if (!value) {
      return "";
    }

    const date = dayjs(value, INTERNAL_DATE_FORMAT, true);

    return date.isValid() ? date.format(this.dateFormat) : "";
  }

  /** Ngược lại với `toDisplayDate`; `null` nếu không hợp lệ (classic trả -1). */
  fromDisplayDate(value: string): string | null {
    const date = dayjs(value, this.dateFormat, true);

    return date.isValid() ? date.format(INTERNAL_DATE_FORMAT) : null;
  }

  /** Giá trị hệ thống (UTC) → dayjs theo múi giờ người dùng. */
  toDayjs(value: string): Dayjs {
    // Không truyền mảng định dạng: customParseFormat khi đó parse theo giờ máy, bỏ qua `utc`.
    const format = value.length > INTERNAL_DATE_TIME_FORMAT.length ? INTERNAL_DATE_TIME_FULL_FORMAT : INTERNAL_DATE_TIME_FORMAT;
    const date = dayjs.utc(value, format);

    return this.timeZone ? date.tz(this.timeZone) : date;
  }

  /** `2026-09-30 08:00:00` (UTC) → chuỗi hiển thị theo múi giờ người dùng. */
  toDisplay(value: string | null | undefined): string {
    if (!value) {
      return "";
    }

    const date = this.toDayjs(value);

    return date.isValid() ? date.format(this.getDateTimeFormat()) : "";
  }

  /** Chuỗi hiển thị theo múi giờ người dùng → giá trị hệ thống UTC `YYYY-MM-DD HH:mm:00`. */
  fromDisplay(value: string): string | null {
    const date = this.timeZone
      ? dayjs.tz(value, this.getDateTimeFormat(), this.timeZone)
      : dayjs.utc(value, this.getDateTimeFormat(), true);

    if (!date.isValid()) {
      return null;
    }

    return `${date.utc().format(INTERNAL_DATE_TIME_FORMAT)}:00`;
  }

  /** Ngày hôm nay theo múi giờ người dùng, dạng hệ thống. */
  getToday(now: Date = new Date()): string {
    return dayjs(now).tz(this.getTimeZone()).format(INTERNAL_DATE_FORMAT);
  }

  /** Giờ hiện tại (UTC) dạng hệ thống; `multiplicity` làm tròn xuống theo số phút. */
  getNow(multiplicity?: number, now: Date = new Date()): string {
    let date = dayjs.utc(now);

    if (multiplicity) {
      const unix = date.unix();

      date = dayjs.unix(unix - (unix % (multiplicity * 60))).utc();
    }

    return date.format(INTERNAL_DATE_TIME_FORMAT);
  }
}

export class NumberFormat {
  readonly thousandSeparator: string;
  readonly decimalMark: string;
  private readonly maxDecimalPlaces = 10;

  constructor(settings: Settings, preferences: Preferences = {}) {
    // Classic ưu tiên preference nếu có key (kể cả chuỗi rỗng = không phân cách hàng nghìn).
    this.thousandSeparator = preferences.thousandSeparator ?? settings.thousandSeparator ?? ".";
    this.decimalMark = preferences.decimalMark || settings.decimalMark || ",";
  }

  private groupThousands(value: string): string {
    return value.replace(/\B(?=(\d{3})+(?!\d))/g, this.thousandSeparator);
  }

  formatInt(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return "";
    }

    return this.groupThousands(value.toString());
  }

  /** `decimalPlaces` không truyền: giữ tối đa 10 chữ số thập phân, không thêm số 0. */
  formatFloat(value: number | null | undefined, decimalPlaces?: number): string {
    if (value === null || value === undefined) {
      return "";
    }

    const places = decimalPlaces ?? this.maxDecimalPlaces;
    const factor = Math.pow(10, places);
    const rounded = decimalPlaces === 0 ? Math.round(value) : Math.round(value * factor) / factor;
    const parts = rounded.toString().split(".");

    parts[0] = this.groupThousands(parts[0]);

    if (decimalPlaces === 0) {
      return parts[0];
    }

    if (decimalPlaces) {
      parts[1] = (parts[1] ?? "").padEnd(decimalPlaces, "0");
    }

    return parts.join(this.decimalMark);
  }
}
