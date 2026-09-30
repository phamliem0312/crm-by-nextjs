// dayjs đã nạp plugin utc/timezone/customParseFormat. Luôn import dayjs từ đây, đừng dựa vào thứ tự import
// để plugin được nạp ngầm ở module khác.
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export default dayjs;
export type { Dayjs } from "dayjs";
