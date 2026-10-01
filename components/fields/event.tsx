"use client";

// Field riêng của sự kiện (Meeting/Call/Task): nhắc nhở, người tham dự kèm trạng thái chấp nhận, quá hạn.
// Port từ `crm:views/meeting/fields/reminders`, `crm:views/meeting/fields/attendees`, `crm:views/task/fields/is-overdue`.
import dayjs from "@/lib/espo/dayjs";
import { getLinkEntity } from "@/lib/espo/entity";
import {
  availableReminderSeconds,
  defaultReminder,
  parseReminders,
  reminderSecondsOptions,
  reminderTypeOptions,
  stringifyReminderSeconds,
  type Reminder,
} from "@/lib/espo/reminders";
import { linkMultipleField, MultiPicker, RecordLink, selectedOptions } from "./link";
import type { FieldContext, FieldDisplayProps, FieldEditProps, FieldType, Values } from "./types";
import { Badge, IconButton, Select, XIcon } from "./ui";

// ——— reminders ———

function RemindersDisplay({ ctx, name, values }: FieldDisplayProps) {
  const list = parseReminders(values[name]);

  return (
    <span className="flex flex-col gap-0.5">
      {list.map((item, index) => (
        <span key={index}>
          {ctx.t.option(item.type, "reminderTypes")} <span className="text-slate-500">{stringifyReminderSeconds(item.seconds, ctx.t)}</span>
        </span>
      ))}
    </span>
  );
}

/** Ngày bắt đầu (UTC) của sự kiện để giới hạn mốc nhắc nhở; sự kiện cả ngày tính từ 00:00 theo múi giờ người dùng. */
function eventStart(ctx: FieldContext, dateField: string, values: Values): { start: Date | null; allDay: boolean } {
  const dateOnly = values[`${dateField}Date`];

  if (typeof dateOnly === "string" && dateOnly) {
    return { start: dayjs.tz(dateOnly, ctx.dateTime.getTimeZone()).toDate(), allDay: true };
  }

  const value = values[dateField];

  return { start: typeof value === "string" && value ? dayjs.utc(value).toDate() : null, allDay: false };
}

function RemindersEdit({ ctx, scope, name, defs, values, onChange, inputId }: FieldEditProps) {
  const list = parseReminders(values[name]);
  const types = reminderTypeOptions(ctx.metadata);
  const secondsOptions = reminderSecondsOptions(ctx.metadata);
  const dateField = typeof defs.dateField === "string" ? defs.dateField : "dateStart";
  const { start, allDay } = eventStart(ctx, dateField, values);
  const set = (next: Reminder[]) => onChange({ [name]: next });

  return (
    <div className="flex max-w-md flex-col gap-2">
      {list.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            aria-label={`${ctx.t(name, "fields")} ${index + 1}: ${ctx.t("type", "fields")}`}
            className="w-32"
            value={item.type}
            onChange={(event) => set(list.map((it, i) => (i === index ? { ...it, type: event.target.value } : it)))}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {ctx.t.option(type, "reminderTypes")}
              </option>
            ))}
          </Select>
          <Select
            aria-label={`${ctx.t(name, "fields")} ${index + 1}`}
            className="min-w-0 flex-1"
            value={String(item.seconds)}
            onChange={(event) => set(list.map((it, i) => (i === index ? { ...it, seconds: Number(event.target.value) } : it)))}
          >
            {availableReminderSeconds(secondsOptions, item.seconds, start, new Date(), allDay).map((seconds) => (
              <option key={seconds} value={seconds}>
                {stringifyReminderSeconds(seconds, ctx.t)}
              </option>
            ))}
          </Select>
          <IconButton label={ctx.t("Remove")} onClick={() => set(list.filter((_, i) => i !== index))}>
            <XIcon />
          </IconButton>
        </div>
      ))}
      <button
        id={inputId}
        type="button"
        aria-label={`${ctx.t("Add")}: ${ctx.t(name, "fields", scope)}`}
        onClick={() => set([...list, defaultReminder(ctx.metadata)])}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-1 text-sm font-medium text-blue-600 hover:underline"
      >
        <i className="fas fa-plus text-xs" aria-hidden />
        {ctx.t("Add")}
      </button>
    </div>
  );
}

export const remindersField: FieldType = {
  Display: RemindersDisplay,
  Edit: RemindersEdit,
  wide: false,
  hasValue: (name, values) => parseReminders(values[name]).length > 0,
  // Bản ghi mới: nhắc nhở mặc định trong Preferences (Task dùng `defaultRemindersTask`).
  getDefault: (ctx, scope, name) => {
    const value = scope === "Task" ? ctx.preferences.defaultRemindersTask : ctx.preferences.defaultReminders;

    return { [name]: parseReminders(value) };
  },
};

// ——— người tham dự (linkMultiple có cột `status`) ———

const ACCEPTANCE_ICONS: Record<string, string> = {
  success: "fas fa-check-circle text-emerald-600",
  danger: "fas fa-times-circle text-red-600",
  warning: "fas fa-question-circle text-amber-500",
};

/** Trạng thái chấp nhận của một người tham dự (`<field>Columns[id].status`). */
export function attendeeStatus(name: string, values: Values, id: string): string | null {
  const columns = values[`${name}Columns`] as Record<string, { status?: string } | undefined> | undefined;

  return columns?.[id]?.status ?? null;
}

export function acceptanceStyle(ctx: FieldContext, scope: string, status: string | null): string | null {
  const styles = (ctx.metadata.entityDefs as Record<string, { fields?: Record<string, { style?: Record<string, string> }> }>)?.[scope]
    ?.fields?.acceptanceStatus?.style;

  return status ? (styles?.[status] ?? null) : null;
}

function AttendeesDisplay({ ctx, scope, name, values, mode }: FieldDisplayProps) {
  const list = selectedOptions(name, values);
  const foreignScope = getLinkEntity(ctx.metadata, scope, name);

  return (
    <span className={mode === "list" ? "line-clamp-2" : "flex flex-col gap-1"}>
      {list.map((item, index) => {
        const status = attendeeStatus(name, values, item.id);
        const style = acceptanceStyle(ctx, scope, status);
        const label = status && status !== "None" ? ctx.t.option(status, "acceptanceStatus", scope) : null;

        return (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <RecordLink ctx={ctx} scope={foreignScope} id={item.id} name={item.name} />
            {style && ACCEPTANCE_ICONS[style] && (
              <i className={`${ACCEPTANCE_ICONS[style]} text-xs`} title={label ?? undefined} aria-label={label ?? undefined} role="img" />
            )}
            {mode === "list" && index < list.length - 1 ? ", " : ""}
          </span>
        );
      })}
    </span>
  );
}

function AttendeesEdit({ ctx, scope, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const foreignScope = getLinkEntity(ctx.metadata, scope, name);

  if (!foreignScope) {
    return null;
  }

  return (
    <MultiPicker
      ctx={ctx}
      foreignScope={foreignScope}
      selected={selectedOptions(name, values)}
      inputId={inputId}
      invalid={invalid}
      describedBy={describedBy}
      onChange={(list) => {
        const columns = (values[`${name}Columns`] ?? {}) as Record<string, unknown>;

        onChange({
          [`${name}Ids`]: list.map((item) => item.id),
          [`${name}Names`]: Object.fromEntries(list.map((item) => [item.id, item.name])),
          // Người mới thêm chưa có trạng thái (server đặt "None").
          [`${name}Columns`]: Object.fromEntries(list.filter((item) => columns[item.id]).map((item) => [item.id, columns[item.id]])),
        });
      }}
    />
  );
}

export const attendeesField: FieldType = { ...linkMultipleField, Display: AttendeesDisplay, Edit: AttendeesEdit };

// ——— Task.isOverdue ———

function OverdueDisplay({ ctx, scope, name, values }: FieldDisplayProps) {
  return values[name] === true ? <Badge style="danger">{ctx.t("overdue", "labels", scope)}</Badge> : null;
}

export const isOverdueField: FieldType = { Display: OverdueDisplay, hasValue: (name, values) => values[name] === true };
