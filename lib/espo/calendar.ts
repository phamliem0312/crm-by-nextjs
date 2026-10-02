// Lịch: chuyển dữ liệu `GET Activities` thành sự kiện FullCalendar, màu theo loại, sự kiện cả ngày, kéo thả/đổi độ dài,
// chọn khoảng để tạo mới. Port từ `crm:views/calendar/calendar` (convertToFcEvent, handleAllDay, fillColor, eventDrop,
// select) và `crm:views/calendar/modals/edit` của classic.
//
// FullCalendar chạy ở `timeZone: "UTC"` và nhận giờ "trên đồng hồ" theo múi giờ người dùng (UTC-coercion):
// không cần plugin múi giờ, mọi phép tính ngày làm bằng dayjs theo múi giờ của Espo.
import type { Acl } from "./acl";
import { espoGet } from "./client";
import dayjs, { type Dayjs } from "./dayjs";
import { getEntityDefs } from "./entity";
import type { Metadata, Preferences, Settings } from "./types";

/** Chế độ của classic → view FullCalendar. */
export const MODE_VIEWS: Record<string, string> = {
  month: "dayGridMonth",
  agendaWeek: "timeGridWeek",
  agendaDay: "timeGridDay",
  basicWeek: "dayGridWeek",
  basicDay: "dayGridDay",
  listWeek: "listWeek",
};

export const DEFAULT_MODE = "agendaWeek";

const WALL = "YYYY-MM-DDTHH:mm:ss";
const SYSTEM = "YYYY-MM-DD HH:mm:ss";
const DATE = "YYYY-MM-DD";

type CalendarDefs = {
  colors?: Record<string, string>;
  scopeList?: string[];
  modeList?: string[];
  allDayScopeList?: string[];
  additionalColorList?: string[];
  slotDuration?: number;
};

export function calendarDefs(metadata: Metadata): CalendarDefs {
  return (metadata.clientDefs?.Calendar ?? {}) as CalendarDefs;
}

/** Entity hiện trên lịch: `calendarEntityList` của Settings, bỏ entity không có quyền đọc. */
export function calendarScopes(settings: Settings, metadata: Metadata, acl: Acl): string[] {
  const list = Array.isArray(settings.calendarEntityList)
    ? settings.calendarEntityList.map(String)
    : (calendarDefs(metadata).scopeList ?? ["Meeting", "Call", "Task"]);

  return list.filter((scope) => !metadata.scopes?.[scope]?.disabled && acl.checkScope(scope, "read"));
}

/** Entity chỉ hiện theo ngày (`calendarOneDay`, ví dụ Task: hiện ở ngày hết hạn). */
export function allDayScopes(metadata: Metadata, scopes: string[]): string[] {
  const list = [...(calendarDefs(metadata).allDayScopeList ?? [])];

  for (const scope of scopes) {
    if ((metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.calendarOneDay && !list.includes(scope)) {
      list.push(scope);
    }
  }

  return list;
}

/** Entity mà `dateStart` là kiểu date (không kéo thả theo giờ được). */
export function onlyDateScopes(metadata: Metadata, scopes: string[]): string[] {
  return scopes.filter((scope) => getEntityDefs(metadata, scope).fields?.dateStart?.type === "date");
}

/**
 * Màu theo entity: `clientDefs.Calendar.colors`, ghi đè bởi màu của scope (`clientDefs.<Scope>.color`);
 * entity không có màu lấy lần lượt từ `additionalColorList` (`getColorFromScopeName`).
 */
export function calendarColors(metadata: Metadata, scopes: string[]): Record<string, string> {
  const defs = calendarDefs(metadata);
  const base = defs.colors ?? {};
  const additional = defs.additionalColorList ?? [];
  const colors: Record<string, string> = { ...base };
  let index = 0;

  for (const scope of scopes) {
    const own = metadata.clientDefs?.[scope]?.color;

    if (own) {
      colors[scope] = own;
    } else if (!colors[scope] && additional.length) {
      colors[scope] = additional[index % additional.length];
    }

    if (!(scope in base)) {
      index++;
    }
  }

  return colors;
}

/** Làm nhạt màu (sự kiện đã xong/huỷ), port `shadeColor`. */
export function shadeColor(color: string, percent: number): string {
  if (color === "transparent" || !/^#[0-9a-f]{6}/i.test(color)) {
    return color;
  }

  const alpha = color.substring(7);
  const value = Number.parseInt(color.slice(1, 7), 16);
  const target = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const channel = (c: number) => Math.round((target - c) * p) + c;
  const r = channel(value >> 16);
  const g = channel((value >> 8) & 0xff);
  const b = channel(value & 0xff);

  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}${alpha}`;
}

export type CalendarItem = {
  scope: string;
  id: string;
  name?: string | null;
  dateStart?: string | null;
  dateEnd?: string | null;
  dateStartDate?: string | null;
  dateEndDate?: string | null;
  status?: string | null;
  color?: string | null;
  isWorkingRange?: boolean;
  userIdList?: string[];
  userNameMap?: Record<string, string>;
  [key: string]: unknown;
};

export type CalendarEventProps = {
  scope: string;
  recordId: string;
  dateStart: string | null;
  dateEnd: string | null;
  dateStartDate: string | null;
  dateEndDate: string | null;
  status: string | null;
  /** Giây giữa bắt đầu và kết thúc (để giữ độ dài khi kéo sự kiện không có `end`). */
  duration: number | null;
  allDayCopy: boolean;
  userIdList?: string[];
  userNameMap?: Record<string, string>;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start?: string;
  end?: string;
  allDay: boolean;
  color?: string;
  classNames?: string[];
  display?: string;
  groupId?: string;
  editable?: boolean;
  extendedProps: CalendarEventProps;
};

export type CalendarContext = {
  timeZone: string;
  allDayScopes: string[];
  colors: Record<string, string>;
  metadata: Metadata;
  isAgenda: boolean;
};

/** Giá trị UTC của Espo → giờ trên đồng hồ người dùng (dayjs ở UTC, chỉ dùng phần ngày giờ). */
function wallOf(value: string, timeZone: string): Dayjs {
  const local = dayjs.utc(value, value.length > 16 ? SYSTEM : "YYYY-MM-DD HH:mm").tz(timeZone);

  return dayjs.utc(local.format(WALL), WALL);
}

function wallDate(value: string): Dayjs {
  return dayjs.utc(value, DATE);
}

const statusList = (metadata: Metadata, scope: string, key: string): string[] => {
  const value = (metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.[key];

  return Array.isArray(value) ? value.map(String) : [];
};

/** Sự kiện cả ngày hay theo giờ, và khoảng hiển thị (port `handleAllDay`). */
function applyAllDay(
  scope: string,
  props: { dateStartDate: string | null; dateEndDate: string | null },
  start: Dayjs | null,
  end: Dayjs | null,
  ctx: CalendarContext,
  afterDrop = false,
): { allDay: boolean; start: Dayjs | null; end: Dayjs | null } {
  if (ctx.allDayScopes.includes(scope)) {
    let s = start;
    let e = end;

    if (!afterDrop && e) {
      s = e;

      if (!props.dateEndDate && e.hour() === 0 && e.minute() === 0) {
        s = s.subtract(1, "day");
      }
    }

    if (s && e && s.isSame(e)) {
      e = e.add(1, "day");
    }

    return { allDay: true, start: s, end: e };
  }

  if (props.dateStartDate && props.dateEndDate) {
    return { allDay: true, start, end: !afterDrop && end ? end.add(1, "day") : end };
  }

  if (!start || !end) {
    return { allDay: true, start: end ?? start, end };
  }

  if (start.format("YYYY-DD") !== end.format("YYYY-DD") && end.unix() - start.unix() >= 86400) {
    return { allDay: true, start, end: end.hour() !== 0 || end.minute() !== 0 ? end.add(1, "day") : end };
  }

  return { allDay: false, start, end };
}

/** Màu sự kiện: màu riêng của bản ghi → màu theo entity; đã xong/huỷ thì nhạt đi (`fillColor`). */
export function eventColor(scope: string, status: string | null | undefined, ownColor: string | null | undefined, ctx: CalendarContext): string | undefined {
  const color = ownColor || ctx.colors[scope];

  if (!color) {
    return undefined;
  }

  const done = [...statusList(ctx.metadata, scope, "completedStatusList"), ...statusList(ctx.metadata, scope, "canceledStatusList")];

  return status && done.includes(status) ? shadeColor(color, 0.4) : color;
}

const format = (value: Dayjs | null) => (value ? value.format(WALL) : undefined);

/** Một mục của `GET Activities` → sự kiện FullCalendar (`convertToFcEvent`). */
export function toCalendarEvent(item: CalendarItem, ctx: CalendarContext): CalendarEvent {
  const props: CalendarEventProps = {
    scope: item.scope,
    recordId: item.id,
    dateStart: item.dateStart ?? null,
    dateEnd: item.dateEnd ?? null,
    dateStartDate: item.dateStartDate ?? null,
    dateEndDate: item.dateEndDate ?? null,
    status: item.status ?? null,
    duration: null,
    allDayCopy: false,
    ...(item.userIdList ? { userIdList: item.userIdList, userNameMap: item.userNameMap ?? {} } : {}),
  };
  const start = item.dateStartDate ? wallDate(item.dateStartDate) : item.dateStart ? wallOf(item.dateStart, ctx.timeZone) : null;
  const end = item.dateEndDate ? wallDate(item.dateEndDate) : item.dateEnd ? wallOf(item.dateEnd, ctx.timeZone) : null;

  if (start && end) {
    props.duration = end.unix() - start.unix();
  }

  if (item.isWorkingRange) {
    return {
      id: `${item.scope}-${item.id}`,
      title: "",
      start: format(start),
      end: format(end),
      allDay: !ctx.isAgenda,
      display: "inverse-background",
      groupId: "nonWorking",
      extendedProps: props,
    };
  }

  const range = applyAllDay(item.scope, props, start, end, ctx);

  props.allDayCopy = range.allDay;

  const canceled = statusList(ctx.metadata, item.scope, "canceledStatusList").includes(String(item.status ?? ""));

  return {
    id: `${item.scope}-${item.id}`,
    title: item.name ?? "",
    start: range.allDay ? range.start?.format(DATE) : format(range.start),
    end: range.allDay ? range.end?.format(DATE) : format(range.end),
    allDay: range.allDay,
    color: eventColor(item.scope, item.status, item.color, ctx),
    classNames: canceled ? ["event-canceled"] : [],
    extendedProps: props,
  };
}

/** Giờ trên đồng hồ (Date từ FullCalendar ở chế độ UTC) → giá trị UTC của Espo `YYYY-MM-DD HH:mm:ss`. */
export function wallToSystem(date: Date, timeZone: string): string {
  const wall = dayjs.utc(date).format("YYYY-MM-DDTHH:mm:00");

  return dayjs.tz(wall, timeZone).utc().format(SYSTEM);
}

/** Ngày (phần ngày của Date ở chế độ UTC). */
export const wallToDate = (date: Date) => dayjs.utc(date).format(DATE);

/** Bây giờ trên đồng hồ người dùng (option `now` của FullCalendar). */
export function wallNow(timeZone: string, now: Date = new Date()): string {
  return dayjs(now).tz(timeZone).format(WALL);
}

export type Delta = { years?: number; months?: number; days?: number; milliseconds?: number };

function shift(value: Dayjs, delta: Delta): Dayjs {
  return value
    .add(delta.years ?? 0, "year")
    .add(delta.months ?? 0, "month")
    .add(delta.days ?? 0, "day")
    .add(delta.milliseconds ?? 0, "millisecond");
}

/**
 * Attribute lưu sau khi kéo sự kiện (`eventDrop`): dời mọi mốc ngày giờ theo `delta`, tính trên múi giờ người dùng
 * (đổi giờ mùa hè không làm lệch giờ trên đồng hồ). `null` = không cho kéo (entity chỉ có ngày, đổi cả ngày ↔ theo giờ).
 */
export function droppedAttributes(
  props: CalendarEventProps,
  delta: Delta,
  allDay: boolean,
  ctx: { timeZone: string; onlyDateScopes: string[] },
): Record<string, string> | null {
  if (ctx.onlyDateScopes.includes(props.scope) || allDay !== props.allDayCopy) {
    return null;
  }

  const attributes: Record<string, string> = {};
  const moveTime = (value: string) =>
    shift(dayjs.utc(value, value.length > 16 ? SYSTEM : "YYYY-MM-DD HH:mm").tz(ctx.timeZone), delta)
      .utc()
      .format("YYYY-MM-DD HH:mm:00");

  if (props.dateStart) {
    attributes.dateStart = moveTime(props.dateStart);
  }

  if (props.dateEnd) {
    attributes.dateEnd = moveTime(props.dateEnd);
  }

  if (props.dateStartDate) {
    attributes.dateStartDate = shift(dayjs.utc(props.dateStartDate, DATE), delta).format(DATE);
  }

  if (props.dateEndDate) {
    attributes.dateEndDate = shift(dayjs.utc(props.dateEndDate, DATE), delta).format(DATE);
  }

  return attributes;
}

export type Selection = {
  dateStart: string;
  dateEnd: string;
  allDay: boolean;
  dateStartDate: string | null;
  dateEndDate: string | null;
};

/** Khoảng vừa chọn trên lịch (`select`) → giá trị cho bản ghi mới. */
export function selectionValues(start: Date, end: Date, allDay: boolean, timeZone: string): Selection {
  return {
    dateStart: wallToSystem(start, timeZone),
    dateEnd: wallToSystem(end, timeZone),
    allDay,
    dateStartDate: allDay ? wallToDate(start) : null,
    dateEndDate: allDay ? dayjs.utc(end).subtract(1, "day").format(DATE) : null,
  };
}

/**
 * Attribute ban đầu của bản ghi tạo từ khoảng đã chọn (`crm:views/calendar/modals/edit.createRecordView`):
 * entity "một ngày" (Task) chỉ đặt hạn, entity có `dateStartDate` thành sự kiện cả ngày, còn lại theo giờ.
 */
export function createAttributes(scope: string, selection: Selection | null, ctx: { metadata: Metadata; allDayScopes: string[] }): Record<string, unknown> {
  if (!selection) {
    return {};
  }

  const attributes: Record<string, unknown> = { dateStart: selection.dateStart, dateEnd: selection.dateEnd };

  if (!selection.allDay) {
    return attributes;
  }

  if (ctx.allDayScopes.includes(scope)) {
    return {
      dateStart: null,
      dateEnd: null,
      dateStartDate: selection.dateEndDate !== selection.dateStartDate ? selection.dateStartDate : null,
      dateEndDate: selection.dateEndDate,
    };
  }

  if (getEntityDefs(ctx.metadata, scope).fields?.dateStartDate) {
    return { dateStart: null, dateEnd: null, dateStartDate: selection.dateStartDate, dateEndDate: selection.dateEndDate, isAllDay: true };
  }

  return { ...attributes, isAllDay: false, dateStartDate: null, dateEndDate: null };
}

/** Độ dài ô giờ (phút) và giờ cuộn tới ban đầu, theo Preferences. */
export function calendarSlots(preferences: Preferences, metadata: Metadata): { slotMinutes: number; scrollHour: number } {
  const slotMinutes = Number(preferences.calendarSlotDuration) || calendarDefs(metadata).slotDuration || 30;
  const scrollHour =
    preferences.calendarScrollHour !== null && preferences.calendarScrollHour !== undefined ? Number(preferences.calendarScrollHour) : slotMinutes < 30 ? 8 : 6;

  return { slotMinutes, scrollHour };
}

/** Lịch dùng chung theo team (`preferences.calendarViewDataList`). */
export type CalendarViewData = { id: string; name: string; mode: string; teamIdList: string[]; teamNames?: Record<string, string> };

export function customViews(preferences: Preferences): CalendarViewData[] {
  return Array.isArray(preferences.calendarViewDataList)
    ? (preferences.calendarViewDataList as CalendarViewData[]).filter((item) => item && typeof item.id === "string")
    : [];
}

/** Chế độ thật + team của một chế độ (`view-<id>` = lịch dùng chung). */
export function resolveMode(mode: string, views: CalendarViewData[]): { viewMode: string; teamIdList: string[] | null; view: CalendarViewData | null } {
  if (mode.startsWith("view-")) {
    const view = views.find((item) => item.id === mode.slice(5)) ?? null;

    return { viewMode: view?.mode && MODE_VIEWS[view.mode] ? view.mode : DEFAULT_MODE, teamIdList: view?.teamIdList?.length ? view.teamIdList : null, view };
  }

  return { viewMode: MODE_VIEWS[mode] ? mode : DEFAULT_MODE, teamIdList: null, view: null };
}

/** `GET Activities` cho một khoảng thời gian (`fetchEvents`). */
export function fetchCalendarItems(
  params: { from: string; to: string; scopeList: string[]; userId?: string | null; teamIdList?: string[] | null; agenda: boolean },
  signal?: AbortSignal,
): Promise<CalendarItem[]> {
  const query = new URLSearchParams({ from: params.from, to: params.to });

  if (params.userId) {
    query.set("userId", params.userId);
  }

  query.set("scopeList", params.scopeList.join(","));

  if (params.teamIdList?.length) {
    query.set("teamIdList", params.teamIdList.join(","));
  }

  query.set("agenda", String(params.agenda));

  return espoGet<CalendarItem[]>(`Activities?${query.toString()}`, { signal });
}

/** Định dạng giờ của sự kiện theo `timeFormat` (12h có AM/PM hoặc 24h). */
export function eventTimeFormat(timeFormat: string): { hour: "2-digit" | "numeric"; minute: "2-digit"; hour12: boolean; meridiem?: "short" } {
  return /a/i.test(timeFormat) ? { hour: "numeric", minute: "2-digit", hour12: true, meridiem: "short" } : { hour: "2-digit", minute: "2-digit", hour12: false };
}
