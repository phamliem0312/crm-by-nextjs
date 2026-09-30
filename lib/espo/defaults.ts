// Giá trị mặc định của field khi tạo mới. Port `Model.parseDefaultValue` + `helpers/model/default-value-provider`
// của classic: `default` dạng "javascript: …" chỉ nhận vài biểu thức ngày giờ cố định (không chạy JS tuỳ ý).
import dayjs from "./dayjs";
import { INTERNAL_DATE_FORMAT, INTERNAL_DATE_TIME_FORMAT, type DateTimeFormat } from "./format";

const NOW = /^return this\.dateTime\.getNow\(([0-9]+)\);$/;
const SHIFT_TODAY = /^return this\.dateTime\.getDateShiftedFromToday\(([0-9]+), '([a-z]+)'\);$/;
const SHIFT_NOW = /^return this\.dateTime\.getDateTimeShiftedFromNow\(([0-9]+), '([a-z]+)', ([0-9]+)\);$/;

type Unit = "minutes" | "hours" | "days" | "weeks" | "months" | "years";

const UNITS = new Set<Unit>(["minutes", "hours", "days", "weeks", "months", "years"]);

/**
 * Giá trị mặc định có dùng được không; `undefined` = bỏ qua (để server tự áp mặc định).
 * `now` truyền vào cho test.
 */
export function resolveDefaultValue(value: unknown, dateTime: DateTimeFormat, now: Date = new Date()): unknown {
  if (typeof value !== "string" || !value.startsWith("javascript:")) {
    return value;
  }

  const code = value.slice(11).trim();

  if (code === "return this.dateTime.getToday();") {
    return dateTime.getToday(now);
  }

  const matchNow = NOW.exec(code);

  if (matchNow) {
    return `${dateTime.getNow(Number(matchNow[1]), now)}:00`;
  }

  const matchToday = SHIFT_TODAY.exec(code);

  if (matchToday && UNITS.has(matchToday[2] as Unit)) {
    return dayjs(now).tz(dateTime.getTimeZone()).add(Number(matchToday[1]), matchToday[2] as Unit).format(INTERNAL_DATE_FORMAT);
  }

  const matchShift = SHIFT_NOW.exec(code);

  if (matchShift && UNITS.has(matchShift[2] as Unit)) {
    const multiplicity = Number(matchShift[3]);
    let unix = dayjs(now).unix();

    if (multiplicity) {
      unix -= unix % (multiplicity * 60);
    }

    return `${dayjs.unix(unix).utc().add(Number(matchShift[1]), matchShift[2] as Unit).format(INTERNAL_DATE_TIME_FORMAT)}:00`;
  }

  return undefined;
}
