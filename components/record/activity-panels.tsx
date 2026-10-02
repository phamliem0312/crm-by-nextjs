"use client";

// Panel Activities / History / Tasks / người tham dự / Converted To ở trang chi tiết.
// Tương đương `crm:views/record/panels/activities|history|tasks`, `crm:views/meeting/record/panels/attendees`,
// `crm:views/lead/record/panels/converted-to` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { teamAssignChecker } from "@/components/email/hooks";
import { translateOption } from "@/components/fields/basic";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { ScopeIcon } from "@/components/shell/scope-icon";
import { toast } from "@/components/ui/toaster";
import {
  activityCreateAttributes,
  activityCreateOptions,
  canCompleteTask,
  canSetHeldInPanel,
  listActivities,
  tasksLink,
  type ActivityPanelType,
} from "@/lib/espo/activities";
import { archiveEmailAttributes, composeAddressSource, composeEmailAttributes, loadComposeAddresses } from "@/lib/espo/email";
import { getFieldDefs } from "@/lib/espo/entity";
import { listLinked, updateRecord, type EspoRecord } from "@/lib/espo/records";
import { recordCreateHref, recordViewHref } from "@/lib/espo/routes";
import type { PanelDef } from "@/lib/espo/side-panels";
import { FieldCell } from "./panels";

function pageSize(ctx: FieldContext): number {
  return typeof ctx.settings.recordsPerPageSmall === "number" ? ctx.settings.recordsPerPageSmall : 5;
}

/** Khung panel nhỏ: tiêu đề + nút, nội dung bên dưới. */
export function PanelCard({
  id,
  title,
  actions,
  children,
}: {
  id: string;
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs" aria-labelledby={id}>
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-slate-100 px-4 py-1.5">
        <h2 id={id} className="text-sm font-semibold text-slate-800">
          {title}
        </h2>
        {actions && <div className="flex flex-wrap justify-end gap-0.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function PanelIconLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      <i className={`${icon} text-xs`} aria-hidden />
    </Link>
  );
}

function createHref(
  ctx: FieldContext,
  scope: string,
  parentScope: string,
  parent: EspoRecord,
  link: string | null,
  attributes: Record<string, unknown>,
): string {
  const params = new URLSearchParams({ attributes: JSON.stringify(attributes) });

  if (link) {
    params.set("relate", JSON.stringify({ scope: parentScope, id: parent.id, link, name: String(parent.name ?? "") }));
  }

  return `${recordCreateHref(scope, ctx.metadata)}?${params.toString()}`;
}

function statusBadge(ctx: FieldContext, scope: string, status: unknown) {
  if (typeof status !== "string" || !status) {
    return null;
  }

  const defs = getFieldDefs(ctx.metadata, scope, "status");

  return defs ? <Badge style={defs.style?.[status] ?? null}>{translateOption(ctx, scope, "status", defs, status)}</Badge> : null;
}

/** Một dòng hoạt động: icon loại, tên (link), thời gian, trạng thái, người phụ trách, nút thao tác. */
function ActivityRow({
  ctx,
  item,
  scope,
  actions,
  dateField,
}: {
  ctx: FieldContext;
  item: EspoRecord;
  scope: string;
  actions?: ReactNode;
  dateField: string;
}) {
  const clientDefs = ctx.metadata.clientDefs?.[scope];
  const date = item[dateField] ?? item[`${dateField}Date`];

  return (
    <li className="flex gap-3 px-4 py-2.5">
      <span className="mt-0.5 text-slate-400" title={ctx.t(scope, "scopeNames")}>
        <ScopeIcon iconClass={clientDefs?.iconClass ?? null} color={clientDefs?.color ?? null} label={ctx.t(scope, "scopeNames")} />
      </span>
      <div className="min-w-0 flex-1">
        <Link href={recordViewHref(scope, item.id, ctx.metadata)} className="block truncate text-sm font-medium text-blue-700 hover:underline">
          {String(item.name ?? "") || item.id}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {typeof date === "string" && date && (
            <span>{date.length > 10 ? ctx.dateTime.toDisplay(date) : ctx.dateTime.toDisplayDate(date)}</span>
          )}
          {statusBadge(ctx, scope, item.status)}
          {typeof item.assignedUserName === "string" && item.assignedUserName && <span>{item.assignedUserName}</span>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-start gap-0.5">{actions}</div>}
    </li>
  );
}

function RowButton({ label, icon, onClick, disabled }: { label: string; icon: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
    >
      <i className={`${icon} text-xs`} aria-hidden />
    </button>
  );
}

function ShowMore({ ctx, onClick }: { ctx: FieldContext; onClick: () => void }) {
  return (
    <div className="border-t border-slate-100 px-4 py-2">
      <button type="button" onClick={onClick} className="text-sm font-medium text-blue-600 hover:underline">
        {ctx.t("Show more")}
      </button>
    </div>
  );
}

function EmptyOrLoading({ ctx, loading }: { ctx: FieldContext; loading: boolean }) {
  return <p className="px-4 py-3 text-sm text-slate-500">{loading ? ctx.t("Loading...") : ctx.t("No Data")}</p>;
}

/** Panel Activities (sắp tới) hoặc History (đã diễn ra) gộp Meeting/Call/Email… qua API `Activities`. */
export function ActivitiesPanel({
  ctx,
  scope,
  record,
  panel,
  type,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  panel: PanelDef;
  type: ActivityPanelType;
}) {
  const queryClient = useQueryClient();
  const [maxSize, setMaxSize] = useState(pageSize(ctx));
  const [busy, setBusy] = useState(false);
  const queryKey = ["related", scope, record.id, `@${type}`];
  const list = useQuery({
    queryKey: [...queryKey, maxSize],
    queryFn: ({ signal }) => listActivities(scope, record.id, type, { maxSize }, signal),
    placeholderData: keepPreviousData,
  });
  const options = activityCreateOptions(type, scope, ctx);

  async function setStatus(item: EspoRecord, status: string) {
    setBusy(true);

    try {
      await updateRecord(String(item._scope), item.id, { status });
      toast.success(ctx.t("Saved"));
      await queryClient.invalidateQueries({ queryKey: ["related", scope, record.id] });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;

  return (
    <PanelCard
      id={`panel-${panel.name}`}
      title={panel.label}
      actions={[
        <EmailPanelButton key="email" ctx={ctx} scope={scope} record={record} panel={panel} type={type} />,
        ...options.map((option) => {
        const label = ctx.t(`${type === "history" ? "Log" : "Schedule"} ${option.scope}`, "labels", option.scope);
        const attributes = activityCreateAttributes(scope, record, option.scope, option.status, {
          metadata: ctx.metadata,
          b2cMode: !!ctx.settings.b2cMode,
        });

        return (
          <PanelIconLink
            key={option.scope}
            href={createHref(ctx, option.scope, scope, record, option.link, attributes)}
            label={label}
            icon={ctx.metadata.clientDefs?.[option.scope]?.iconClass ?? "fas fa-plus"}
          />
        );
        }),
      ]}
    >
      {items.length ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const itemScope = String(item._scope ?? "");
            const canEdit = ctx.acl.checkScope(itemScope, "edit") && ctx.acl.checkField(itemScope, "status", "edit");

            return (
              <ActivityRow
                key={`${itemScope}-${item.id}`}
                ctx={ctx}
                item={item}
                scope={itemScope}
                dateField={itemScope === "Email" ? "dateSent" : "dateStart"}
                actions={
                  type === "activities" && canEdit && canSetHeldInPanel(ctx.metadata, itemScope, item.status) ? (
                    <>
                      <RowButton
                        label={`${ctx.t("Set Held", "labels", itemScope)}: ${String(item.name ?? "")}`}
                        icon="fas fa-check"
                        disabled={busy}
                        onClick={() => setStatus(item, "Held")}
                      />
                      <RowButton
                        label={`${ctx.t("Set Not Held", "labels", itemScope)}: ${String(item.name ?? "")}`}
                        icon="fas fa-ban"
                        disabled={busy}
                        onClick={() => setStatus(item, "Not Held")}
                      />
                    </>
                  ) : null
                }
              />
            );
          })}
        </ul>
      ) : (
        <EmptyOrLoading ctx={ctx} loading={list.isLoading} />
      )}
      {total > items.length && <ShowMore ctx={ctx} onClick={() => setMaxSize(maxSize + pageSize(ctx) * 2)} />}
    </PanelCard>
  );
}

/**
 * Nút soạn email (panel Activities) hoặc lưu email đã có (panel History), điền sẵn người nhận/parent như
 * `actionComposeEmail` / `actionArchiveEmail` của classic; xong thì quay lại bản ghi.
 */
function EmailPanelButton({
  ctx,
  scope,
  record,
  panel,
  type,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  panel: PanelDef;
  type: ActivityPanelType;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  if (!ctx.acl.checkScope("Email", "create")) {
    return null;
  }

  const parentCtx = { metadata: ctx.metadata, settings: ctx.settings, user: ctx.user, canAssignTeam: teamAssignChecker(ctx) };
  const label = type === "history" ? ctx.t("Archive Email", "labels", "Email") : ctx.t("Compose Email", "labels");

  async function open() {
    const go = (path: string, attributes: Record<string, unknown>) =>
      router.push(`${path}?${new URLSearchParams({ attributes: JSON.stringify(attributes), returnTo: pathname }).toString()}`);

    if (type === "history") {
      go("/Email/create", archiveEmailAttributes(scope, record, { ...parentCtx, now: `${ctx.dateTime.getNow(15)}:00` }));

      return;
    }

    let attributes = composeEmailAttributes(scope, record, parentCtx);
    const source = composeAddressSource(scope, record, ctx.metadata, panel.view);

    if (source) {
      setBusy(true);

      try {
        attributes = await loadComposeAddresses(source, scope, record, attributes);
      } catch (error) {
        toast.error(error);
      } finally {
        setBusy(false);
      }
    }

    go("/Email/compose", attributes);
  }

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
    >
      <i className={`${ctx.metadata.clientDefs?.Email?.iconClass ?? "fas fa-envelope"} text-xs`} aria-hidden />
    </button>
  );
}

/** Panel Tasks: task gắn với bản ghi, tạo task mới, đánh dấu hoàn thành. */
export function TasksPanel({ ctx, scope, record, panel }: { ctx: FieldContext; scope: string; record: EspoRecord; panel: PanelDef }) {
  const queryClient = useQueryClient();
  const [maxSize, setMaxSize] = useState(pageSize(ctx));
  const [busy, setBusy] = useState(false);
  const link = tasksLink(scope, ctx.metadata);
  const list = useQuery({
    queryKey: ["related", scope, record.id, "@tasks", maxSize],
    queryFn: ({ signal }) =>
      listLinked(
        scope,
        record.id,
        link!,
        {
          select: ["name", "status", "dateEnd", "dateEndDate", "assignedUserId", "assignedUserName", "isOverdue"],
          maxSize,
          orderBy: "createdAt",
          order: "desc",
        },
        signal,
      ),
    enabled: !!link,
    placeholderData: keepPreviousData,
  });

  if (!link) {
    return null;
  }

  async function complete(item: EspoRecord) {
    setBusy(true);

    try {
      await updateRecord("Task", item.id, { status: "Completed" });
      toast.success(ctx.t("Saved"));
      await queryClient.invalidateQueries({ queryKey: ["related", scope, record.id] });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  const items = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  const canCreate = ctx.acl.checkScope("Task", "create");
  // Account liệt kê qua `tasksPrimary` nhưng tạo mới qua link `tasks` (như classic).
  const createLink = link === "tasksPrimary" ? "tasks" : link;
  const canEditTask = ctx.acl.checkScope("Task", "edit") && ctx.acl.checkField("Task", "status", "edit");

  return (
    <PanelCard
      id={`panel-${panel.name}`}
      title={panel.label}
      actions={
        canCreate ? (
          <PanelIconLink
            href={createHref(ctx, "Task", scope, record, createLink, activityCreateAttributes(scope, record, "Task", null, { metadata: ctx.metadata, b2cMode: !!ctx.settings.b2cMode }))}
            label={ctx.t("Create Task", "labels", "Task")}
            icon="fas fa-plus"
          />
        ) : null
      }
    >
      {items.length ? (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <ActivityRow
              key={item.id}
              ctx={ctx}
              item={item}
              scope="Task"
              dateField="dateEnd"
              actions={
                canEditTask && canCompleteTask(ctx.metadata, item.status) ? (
                  <RowButton
                    label={`${ctx.t("Complete", "labels", "Task")}: ${String(item.name ?? "")}`}
                    icon="fas fa-check"
                    disabled={busy}
                    onClick={() => complete(item)}
                  />
                ) : null
              }
            />
          ))}
        </ul>
      ) : (
        <EmptyOrLoading ctx={ctx} loading={list.isLoading} />
      )}
      {total > items.length && <ShowMore ctx={ctx} onClick={() => setMaxSize(maxSize + pageSize(ctx) * 2)} />}
    </PanelCard>
  );
}

/** Panel hiển thị vài field của bản ghi (người tham dự, Converted To). Không có giá trị nào thì ẩn. */
export function FieldsPanel({
  ctx,
  scope,
  record,
  panel,
  renderField,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  panel: PanelDef;
  /** Trang chi tiết truyền hàm render có sửa nhanh; mặc định chỉ hiển thị. */
  renderField?: (field: string, label: string) => ReactNode;
}) {
  const fields = (panel.fields ?? []).filter((field) => getFieldDefs(ctx.metadata, scope, field) && ctx.acl.checkField(scope, field));
  const hasAny = fields.some((field) => {
    const ids = record[`${field}Ids`];

    return !!record[`${field}Id`] || (Array.isArray(ids) && ids.length > 0);
  });

  if (!fields.length || (panel.kind === "convertedTo" && !hasAny)) {
    return null;
  }

  return (
    <PanelCard id={`panel-${panel.name}`} title={panel.label}>
      <div className="flex flex-col gap-4 px-4 py-3">
        {fields.map((field) =>
          renderField ? (
            renderField(field, ctx.t(field, "fields", scope))
          ) : (
            <FieldCell key={field} label={ctx.t(field, "fields", scope)}>
              <FieldValue ctx={ctx} scope={scope} name={field} defs={getFieldDefs(ctx.metadata, scope, field)!} values={record} mode="detail" />
            </FieldCell>
          ),
        )}
      </div>
    </PanelCard>
  );
}

/** Render một panel phụ theo loại. */
export function ExtraPanel(props: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  panel: PanelDef;
  renderField?: (field: string, label: string) => ReactNode;
}) {
  switch (props.panel.kind) {
    case "activities":
    case "history":
      return <ActivitiesPanel {...props} type={props.panel.kind} />;
    case "tasks":
      return <TasksPanel {...props} />;
    default:
      return <FieldsPanel {...props} />;
  }
}
