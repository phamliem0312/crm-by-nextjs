"use client";

// Lịch (FullCalendar): tải sự kiện theo khoảng đang xem (`GET Activities`), kéo thả/đổi độ dài để dời lịch (PATCH),
// chọn khoảng để tạo mới, bấm sự kiện để xem nhanh. Dùng cho trang Lịch và dashlet Calendar.
// Tương đương `crm:views/calendar/calendar` của classic.
import type { CalendarApi, DatesSetArg, EventClickArg, EventDropArg, EventInput, EventSourceFuncArg } from "@fullcalendar/core";
import allLocales from "@fullcalendar/core/locales-all";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { QuickCreateDialog, QuickViewDialog } from "@/components/record/quick-dialogs";
import { toast } from "@/components/ui/toaster";
import {
  allDayScopes,
  calendarColors,
  calendarSlots,
  createAttributes,
  droppedAttributes,
  eventTimeFormat,
  fetchCalendarItems,
  MODE_VIEWS,
  onlyDateScopes,
  selectionValues,
  toCalendarEvent,
  wallNow,
  wallToDate,
  wallToSystem,
  type CalendarEventProps,
  type Selection,
} from "@/lib/espo/calendar";
import dayjs from "@/lib/espo/dayjs";
import { updateRecord } from "@/lib/espo/records";

export type CalendarHandle = { api: () => CalendarApi | null; refetch: () => void };

export type CalendarRange = { title: string; date: string; isToday: boolean };

/** Mã ngôn ngữ FullCalendar từ ngôn ngữ của Espo (`vi_VN` → `vi`, `pt_BR` → `pt-br`). */
function localeCode(language: string): string {
  const [lang, region] = language.split("_");
  const full = `${lang}-${(region ?? "").toLowerCase()}`;

  return allLocales.some((locale) => locale.code === full) ? full : lang;
}

export const CalendarView = forwardRef<
  CalendarHandle,
  {
    ctx: FieldContext;
    /** Chế độ của classic (month, agendaWeek…). */
    viewMode: string;
    initialDate: string | null;
    /** Loại đang bật (lọc). */
    scopes: string[];
    /** Mọi loại hiện được trên lịch (để tô màu ổn định). */
    allScopes: string[];
    userId?: string | null;
    userName?: string | null;
    teamIdList?: string[] | null;
    height?: string;
    onRangeChange?: (range: CalendarRange) => void;
    onLoading?: (loading: boolean) => void;
  }
>(function CalendarView({ ctx, viewMode, initialDate, scopes, allScopes, userId, userName, teamIdList, height = "100%", onRangeChange, onLoading }, ref) {
  const { metadata, acl, dateTime, settings, preferences } = ctx;
  const calendarRef = useRef<FullCalendar>(null);
  const timeZone = dateTime.getTimeZone();
  const [creating, setCreating] = useState<Selection | null | false>(false);
  const [viewing, setViewing] = useState<{ scope: string; id: string } | null>(null);
  const oneDay = useMemo(() => allDayScopes(metadata, allScopes), [metadata, allScopes]);
  const dateOnly = useMemo(() => onlyDateScopes(metadata, allScopes), [metadata, allScopes]);
  const colors = useMemo(() => calendarColors(metadata, allScopes), [metadata, allScopes]);
  const { slotMinutes, scrollHour } = calendarSlots(preferences, metadata);
  const creatable = scopes.filter((scope) => !dateOnly.includes(scope) && acl.checkScope(scope, "create"));
  const isAgenda = viewMode.startsWith("agenda");
  const language = String(preferences.language || settings.language || "en_US");

  useImperativeHandle(ref, () => ({
    api: () => calendarRef.current?.getApi() ?? null,
    refetch: () => calendarRef.current?.getApi().refetchEvents(),
  }));

  // Nguồn sự kiện đổi (loại, người dùng, team, agenda) → FullCalendar tự tải lại.
  const events = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      if (!scopes.length) {
        return [];
      }

      const items = await fetchCalendarItems({
        from: wallToSystem(info.start, timeZone),
        to: wallToSystem(info.end, timeZone),
        scopeList: scopes,
        userId,
        teamIdList,
        agenda: isAgenda,
      });
      const context = { timeZone, allDayScopes: oneDay, colors, metadata, isAgenda };

      return items.map((item) => {
        const event = toCalendarEvent(item, context);
        const editable = acl.checkScope(item.scope, "edit");

        return {
          ...event,
          editable,
          startEditable: editable && !dateOnly.includes(item.scope),
          durationEditable: editable && !oneDay.includes(item.scope) && !event.allDay,
        };
      });
    },
    [scopes, userId, teamIdList, isAgenda, timeZone, oneDay, colors, metadata, acl, dateOnly],
  );

  async function save(scope: string, id: string, attributes: Record<string, unknown>, revert: () => void) {
    try {
      await updateRecord(scope, id, attributes);
      toast.success(ctx.t("Saved"));
      calendarRef.current?.getApi().refetchEvents();
    } catch (error) {
      revert();
      toast.error(error);
    }
  }

  function onDrop(info: EventDropArg) {
    const props = info.event.extendedProps as CalendarEventProps;
    const attributes = droppedAttributes(props, info.delta, info.event.allDay, { timeZone, onlyDateScopes: dateOnly });

    if (!attributes) {
      info.revert();

      return;
    }

    void save(props.scope, props.recordId, attributes, info.revert);
  }

  function onResize(info: EventResizeDoneArg) {
    const props = info.event.extendedProps as CalendarEventProps;
    const end = info.event.end;

    if (!end) {
      info.revert();

      return;
    }

    const attributes = props.dateEndDate
      ? { dateEndDate: dayjs.utc(wallToDate(end)).subtract(1, "day").format("YYYY-MM-DD") }
      : { dateEnd: wallToSystem(end, timeZone) };

    void save(props.scope, props.recordId, attributes, info.revert);
  }

  function onDatesSet(arg: DatesSetArg) {
    const api = calendarRef.current?.getApi();
    const today = wallNow(timeZone).slice(0, 10);
    const start = wallToDate(arg.view.currentStart);
    const end = wallToDate(arg.view.currentEnd);
    let title = arg.view.title;

    if (userId && userName) {
      title += ` (${userName})`;
    }

    onRangeChange?.({
      title,
      date: api ? wallToDate(api.getDate()) : start,
      isToday: start <= today && today < end,
    });
  }

  return (
    <div className="espo-calendar h-full" style={{ height }}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView={MODE_VIEWS[viewMode] ?? MODE_VIEWS.agendaWeek}
        initialDate={initialDate ?? undefined}
        headerToolbar={false}
        height="100%"
        timeZone="UTC"
        now={() => wallNow(timeZone)}
        locales={allLocales}
        locale={localeCode(language)}
        firstDay={dateTime.weekStart}
        weekNumbers
        weekNumberCalculation="ISO"
        weekText=""
        allDayText=""
        nowIndicator
        slotDuration={{ minutes: slotMinutes }}
        snapDuration={{ minutes: slotMinutes }}
        slotLabelInterval={{ hours: 1 }}
        scrollTime={`${String(scrollHour).padStart(2, "0")}:00:00`}
        slotLabelFormat={eventTimeFormat(dateTime.timeFormat)}
        eventTimeFormat={eventTimeFormat(dateTime.timeFormat)}
        dayMaxEvents
        longPressDelay={300}
        selectable={creatable.length > 0}
        selectMirror
        events={events}
        loading={onLoading}
        datesSet={onDatesSet}
        eventAllow={(span, event) => !!event && span.allDay === event.allDay}
        eventDrop={onDrop}
        eventResize={onResize}
        eventClick={(info: EventClickArg) => {
          info.jsEvent.preventDefault();

          const props = info.event.extendedProps as CalendarEventProps;

          setViewing({ scope: props.scope, id: props.recordId });
        }}
        select={(info) => {
          setCreating(selectionValues(info.start, info.end, info.allDay, timeZone));
          calendarRef.current?.getApi().unselect();
        }}
        eventContent={
          teamIdList?.length
            ? (arg) => {
                const props = arg.event.extendedProps as CalendarEventProps;
                const names = (props.userIdList ?? []).map((id) => props.userNameMap?.[id] ?? id).sort((a, b) => a.localeCompare(b));

                return (
                  <div className="overflow-hidden px-0.5 text-xs">
                    {arg.timeText && <div className="font-medium">{arg.timeText}</div>}
                    <div className="truncate">{arg.event.title}</div>
                    {names.map((name) => (
                      <div key={name} className="truncate opacity-80">
                        <i className="fas fa-user mr-1 text-[9px]" aria-hidden />
                        {name}
                      </div>
                    ))}
                  </div>
                );
              }
            : undefined
        }
      />

      {creating !== false && creatable.length > 0 && (
        <QuickCreateDialog
          ctx={ctx}
          scopes={creatable}
          attributes={(scope) => ({
            ...createAttributes(scope, creating, { metadata, allDayScopes: oneDay }),
            ...(userId ? { assignedUserId: userId, assignedUserName: userName ?? userId } : {}),
          })}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            calendarRef.current?.getApi().refetchEvents();
          }}
        />
      )}

      {viewing && (
        <QuickViewDialog
          ctx={ctx}
          scope={viewing.scope}
          id={viewing.id}
          onClose={() => setViewing(null)}
          onRemoved={() => {
            setViewing(null);
            calendarRef.current?.getApi().refetchEvents();
          }}
        />
      )}
    </div>
  );
});
