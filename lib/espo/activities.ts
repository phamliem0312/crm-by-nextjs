// Panel Activities/History/Tasks của CRM. Port logic thuần từ `crm:views/record/panels/activities`
// (setupActionList, getCreateActivityAttributes) và `.../panels/tasks`.
import type { Acl } from "./acl";
import { espoGet } from "./client";
import { getEntityDefs, getFieldDefs } from "./entity";
import type { ListResult } from "./records";
import { searchParamsQuery } from "./search";
import type { Metadata, Settings } from "./types";

export type ActivityPanelType = "activities" | "history";

export type ActivityCreateOption = {
  scope: string;
  /** Link của bản ghi cha tới entity này (`clientDefs.<Scope>.activityDefs.link`), nếu có. */
  link: string | null;
  /** Trạng thái đầu tiên của `activityStatusList`/`historyStatusList` (Planned / Held). */
  status: string | null;
};

type ActivityDefs = { link?: string; activitiesCreate?: boolean; historyCreate?: boolean };

function scopeStatusList(metadata: Metadata, scope: string, key: string): string[] {
  const value = (metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.[key];

  return Array.isArray(value) ? value.map(String) : [];
}

/** Entity hiện trong panel (`activitiesEntityList`/`historyEntityList` của Settings). */
export function activityScopes(settings: Settings, type: ActivityPanelType): string[] {
  const list = settings[`${type}EntityList`];

  return Array.isArray(list) ? list.map(String) : [];
}

export function checkParentTypeAvailability(metadata: Metadata, scope: string, parentType: string): boolean {
  return (getFieldDefs(metadata, scope, "parent")?.entityList ?? []).includes(parentType);
}

/** Nút "Schedule Meeting", "Log Call"… của panel (theo quyền tạo và link có sẵn). */
export function activityCreateOptions(
  type: ActivityPanelType,
  parentScope: string,
  ctx: { metadata: Metadata; acl: Acl; settings: Settings },
): ActivityCreateOption[] {
  const parentLinks = getEntityDefs(ctx.metadata, parentScope).links ?? {};

  return activityScopes(ctx.settings, type).flatMap((scope) => {
    const defs = ((ctx.metadata.clientDefs?.[scope] as Record<string, unknown> | undefined)?.activityDefs ?? {}) as ActivityDefs;

    if (!defs[`${type}Create`] || !ctx.acl.checkScope(scope, "create")) {
      return [];
    }

    const link = defs.link ?? null;

    if (link ? !parentLinks[link] : parentScope !== "User" && !checkParentTypeAvailability(ctx.metadata, scope, parentScope)) {
      return [];
    }

    return [{ scope, link, status: scopeStatusList(ctx.metadata, scope, `${type}StatusList`)[0] ?? null }];
  });
}

/**
 * Attribute điền sẵn cho hoạt động mới tạo từ panel (port `getCreateActivityAttributes`):
 * Contact → parent là Account của contact (trừ B2C), Lead → parent là chính lead, entity khác → parent là bản ghi cha
 * nếu entity đích nhận loại parent đó; kèm danh sách contacts của bản ghi cha.
 */
export function activityCreateAttributes(
  parentScope: string,
  parent: Record<string, unknown>,
  scope: string,
  status: string | null,
  ctx: { metadata: Metadata; b2cMode?: boolean },
): Record<string, unknown> {
  const attributes: Record<string, unknown> = {};

  if (status) {
    attributes.status = status;
  }

  if (parentScope === "User") {
    attributes.assignedUserId = parent.id;
    attributes.assignedUserName = parent.name;

    return attributes;
  }

  if (parentScope === "Contact") {
    const hasContactLink = !!getEntityDefs(ctx.metadata, scope).links?.contacts || !!getEntityDefs(ctx.metadata, scope).links?.contact;

    if (parent.accountId && !ctx.b2cMode && hasContactLink) {
      attributes.parentType = "Account";
      attributes.parentId = parent.accountId;
      attributes.parentName = parent.accountName;
    }
  } else if (parentScope === "Lead") {
    attributes.parentType = "Lead";
    attributes.parentId = parent.id;
    attributes.parentName = parent.name;
  }

  if (parentScope !== "Account" && Array.isArray(parent.contactsIds)) {
    attributes.contactsIds = parent.contactsIds;
    attributes.contactsNames = parent.contactsNames;
  }

  if (!attributes.parentId) {
    if (checkParentTypeAvailability(ctx.metadata, scope, parentScope)) {
      attributes.parentType = parentScope;
      attributes.parentId = parent.id;
      attributes.parentName = parent.name;
    }
  } else if (typeof attributes.parentType === "string" && !checkParentTypeAvailability(ctx.metadata, scope, attributes.parentType)) {
    attributes.parentType = null;
    attributes.parentId = null;
    attributes.parentName = null;
  }

  return attributes;
}

/** Hoạt động có thể đặt Held/Not Held ngay trong panel (đang ở trạng thái "activity", không phải "history"). */
export function canSetHeldInPanel(metadata: Metadata, scope: string, status: unknown): boolean {
  const history = scopeStatusList(metadata, scope, "historyStatusList");

  return history.includes("Held") && history.includes("Not Held") && !history.includes(String(status ?? ""));
}

/** Task chưa hoàn thành/huỷ thì có nút "Complete". */
export function canCompleteTask(metadata: Metadata, status: unknown): boolean {
  const done = [...scopeStatusList(metadata, "Task", "completedStatusList"), ...scopeStatusList(metadata, "Task", "canceledStatusList")];

  return !(done.length ? done : ["Completed", "Canceled"]).includes(String(status ?? ""));
}

/** Link liệt kê Task của bản ghi cha: Account dùng `tasksPrimary` (task gắn trực tiếp), còn lại `tasks`. */
export function tasksLink(parentScope: string, metadata: Metadata): string | null {
  const links = getEntityDefs(metadata, parentScope).links ?? {};

  if (parentScope === "Account" && links.tasksPrimary) {
    return "tasksPrimary";
  }

  return links.tasks ? "tasks" : null;
}

/** Hoạt động sắp tới của người dùng hiện tại (dashlet Activities). */
export function listUpcomingActivities(
  params: { maxSize: number; entityTypeList: string[]; futureDays: number; includeShared?: boolean },
  signal?: AbortSignal,
): Promise<ListResult> {
  const query = new URLSearchParams({ maxSize: String(params.maxSize), futureDays: String(params.futureDays) });

  for (const scope of params.entityTypeList) {
    query.append("entityTypeList[]", scope);
  }

  if (params.includeShared) {
    query.set("includeShared", "true");
  }

  return espoGet<ListResult>(`Activities/upcoming?${query.toString()}`, { signal });
}

export function listActivities(
  parentScope: string,
  id: string,
  type: ActivityPanelType,
  params: { maxSize: number; offset?: number; entityType?: string | null },
  signal?: AbortSignal,
): Promise<ListResult> {
  const query = searchParamsQuery({ maxSize: params.maxSize, offset: params.offset ?? 0, orderBy: "dateStart", order: "desc" });
  const entityType = params.entityType ? `&entityType=${encodeURIComponent(params.entityType)}` : "";

  return espoGet<ListResult>(
    `Activities/${encodeURIComponent(parentScope)}/${encodeURIComponent(id)}/${type}?${query}${entityType}`,
    { signal },
  );
}
