// Kiểm tra quyền phía client. Port từ `acl-manager` và `acl` của UI classic (espo-main.js @7127, @5646).
// Chỉ dùng để ẩn/hiện giao diện; server vẫn là nơi quyết định quyền thật.
import type { AclAction, AclData, AclLevel, AclScopeData, EspoUser } from "./types";

export type AclUser = Pick<EspoUser, "id" | "type"> & { teamsIds?: string[] };

/** Bản ghi đã tải (các attribute như `assignedUserId`, `teamsIds`…). */
export type AclRecord = Record<string, unknown>;

export type AclRecordOptions = {
  /** Entity có field này không (theo `entityDefs`). */
  hasField: (field: string) => boolean;
  /** Trả `null` khi chưa đủ dữ liệu để kết luận (ví dụ chưa tải `teamsIds`). */
  precise?: boolean;
};

type EntityAccess = { isOwner?: boolean | null; inTeam?: boolean | null; isShared?: boolean | null };

const FIELD_LEVELS = ["yes", "no"] as const;

function isAdmin(user: AclUser): boolean {
  return user.type === "admin" || user.type === "super-admin";
}

function has(record: AclRecord, attribute: string): boolean {
  return Object.hasOwn(record, attribute) && record[attribute] !== undefined;
}

/**
 * Port `Acl.checkScope`. `entityAccess` không truyền thì chỉ xét mức quyền, không xét quyền sở hữu.
 */
function checkScopeData(
  user: AclUser,
  data: AclScopeData | null,
  action: AclAction | null,
  precise = false,
  entityAccess?: EntityAccess,
): boolean | null {
  const { inTeam, isOwner, isShared } = entityAccess ?? {};

  if (isAdmin(user)) {
    return data !== false;
  }

  if (data === false || data === null) {
    return false;
  }

  if (data === true || typeof data === "string") {
    return true;
  }

  if (action === null) {
    return true;
  }

  if (!(action in data)) {
    return false;
  }

  const value = data[action];

  if (value === "all" || value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  if (isOwner === undefined) {
    return true;
  }

  if (isOwner && (value === "own" || value === "team")) {
    return true;
  }

  if (isShared) {
    return true;
  }

  if (inTeam && value === "team") {
    return true;
  }

  let result: boolean | null = false;

  if (value === "team" && inTeam === null && precise) {
    result = null;
  }

  if (isOwner === null && precise) {
    result = null;
  }

  if (isShared === null) {
    result = null;
  }

  return result;
}

export class Acl {
  private readonly forbiddenCache = new Map<string, string[]>();

  constructor(
    readonly data: AclData,
    readonly user: AclUser,
    private readonly options: { aclAllowDeleteCreated?: boolean } = {},
  ) {}

  isAdmin(): boolean {
    return isAdmin(this.user);
  }

  private scopeData(scope: string): AclScopeData | null {
    return Object.hasOwn(this.data.table ?? {}, scope) ? this.data.table[scope] : null;
  }

  /** Scope có trong bảng quyền không. */
  checkScopeHasAcl(scope: string): boolean {
    return Object.hasOwn(this.data.table ?? {}, scope);
  }

  /** Mức quyền của một action, `null` nếu không có. */
  getLevel(scope: string, action: AclAction): AclLevel | null {
    const data = this.scopeData(scope);

    if (!data || typeof data !== "object" || !(action in data)) {
      return null;
    }

    return data[action] ?? null;
  }

  /** Ví dụ `getPermissionLevel("export")` hoặc `getPermissionLevel("exportPermission")`. */
  getPermissionLevel(permission: string): AclLevel {
    const key = (permission.endsWith("Permission") ? permission : `${permission}Permission`) as `${string}Permission`;

    return this.data[key] ?? "no";
  }

  /** Quyền với cả scope (không xét bản ghi cụ thể). */
  checkScope(scope: string, action: AclAction | null = null): boolean {
    return checkScopeData(this.user, this.scopeData(scope), action) === true;
  }

  /** Quyền với một bản ghi. Không xét `isEditable`/`isRemovable` của model (làm ở engine bản ghi). */
  checkRecord(
    scope: string,
    record: AclRecord,
    action: AclAction | null,
    options: AclRecordOptions,
  ): boolean | null {
    if (this.isAdmin()) {
      return true;
    }

    const data = this.scopeData(scope);
    const forbiddenFields = this.getScopeForbiddenFieldList(scope);
    const entityAccess: EntityAccess = {
      isOwner: this.checkIsOwner(record, options),
      inTeam: this.checkInTeam(record, options, forbiddenFields.includes("teams")),
      isShared:
        action === "read" || action === "stream"
          ? this.checkIsShared(record, options, forbiddenFields.includes("collaborators"))
          : false,
    };

    const result = checkScopeData(this.user, data, action, options.precise, entityAccess);

    if (action !== "delete" || result || data === false) {
      return result;
    }

    // Port `Acl.checkModelDelete`: được xoá bản ghi mình tạo nếu bật `aclAllowDeleteCreated`.
    if (data && typeof data === "object" && data.read === "no") {
      return false;
    }

    if (this.options.aclAllowDeleteCreated && record.createdById === this.user.id) {
      if (!has(record, "assignedUserId") || !record.assignedUserId || record.assignedUserId === this.user.id) {
        return true;
      }
    }

    return result;
  }

  /** Port `Acl.checkIsOwner`: `null` nếu chưa đủ dữ liệu. */
  checkIsOwner(record: AclRecord, { hasField }: AclRecordOptions): boolean | null {
    let result: boolean | null = false;

    if (hasField("assignedUser")) {
      if (record.assignedUserId === this.user.id) {
        return true;
      }

      if (!has(record, "assignedUserId")) {
        result = null;
      }
    } else if (hasField("createdBy")) {
      if (record.createdById === this.user.id) {
        return true;
      }

      if (!has(record, "createdById")) {
        result = null;
      }
    }

    if (hasField("assignedUsers")) {
      if (!has(record, "assignedUsersIds")) {
        return null;
      }

      if (((record.assignedUsersIds as string[] | null) ?? []).includes(this.user.id)) {
        return true;
      }

      result = false;
    }

    return result;
  }

  /** Port `Acl.checkInTeam`. */
  checkInTeam(record: AclRecord, { hasField }: AclRecordOptions, teamsFieldIsForbidden = false): boolean | null {
    if (!has(record, "teamsIds")) {
      if (teamsFieldIsForbidden) {
        return true;
      }

      return hasField("teams") ? null : false;
    }

    const recordTeams = (record.teamsIds as string[] | null) ?? [];

    return (this.user.teamsIds ?? []).some((id) => recordTeams.includes(id));
  }

  /** Port `Acl.checkIsShared` (field `collaborators`). */
  checkIsShared(
    record: AclRecord,
    { hasField }: AclRecordOptions,
    collaboratorsFieldIsForbidden = false,
  ): boolean | null {
    if (!has(record, "collaboratorsIds")) {
      if (collaboratorsFieldIsForbidden) {
        return true;
      }

      return hasField("collaborators") ? null : false;
    }

    return ((record.collaboratorsIds as string[] | null) ?? []).includes(this.user.id);
  }

  /**
   * Port `AclManager.checkPermission` (assignment/user/…): quyền của người dùng hiện tại với `target`.
   */
  checkPermission(permission: string, target: AclUser): boolean | null {
    if (this.isAdmin()) {
      return true;
    }

    const level = this.getPermissionLevel(permission);

    if (level === "no") {
      return target.id === this.user.id;
    }

    if (level === "team") {
      if (!target.teamsIds) {
        return null;
      }

      return target.teamsIds.some((id) => (this.user.teamsIds ?? []).includes(id));
    }

    return level === "all" || level === "yes";
  }

  getScopeForbiddenFieldList(scope: string, action: "read" | "edit" = "read", thresholdLevel: "yes" | "no" = "no"): string[] {
    return this.getForbiddenList("fields", scope, action, thresholdLevel);
  }

  getScopeForbiddenAttributeList(
    scope: string,
    action: "read" | "edit" = "read",
    thresholdLevel: "yes" | "no" = "no",
  ): string[] {
    return this.getForbiddenList("attributes", scope, action, thresholdLevel);
  }

  /** Field có được đọc/sửa không. */
  checkField(scope: string, field: string, action: "read" | "edit" = "read"): boolean {
    return !this.getScopeForbiddenFieldList(scope, action).includes(field);
  }

  private getForbiddenList(
    kind: "fields" | "attributes",
    scope: string,
    action: "read" | "edit",
    thresholdLevel: "yes" | "no",
  ): string[] {
    const key = `${kind}:${scope}:${action}:${thresholdLevel}`;
    const cached = this.forbiddenCache.get(key);

    if (cached) {
      return [...cached];
    }

    const levels = FIELD_LEVELS.slice(FIELD_LEVELS.indexOf(thresholdLevel));
    const actionData = this.data.fieldTableQuickAccess?.[scope]?.[kind]?.[action] ?? {};
    const list: string[] = [];

    for (const level of levels) {
      for (const item of actionData[level] ?? []) {
        if (!list.includes(item)) {
          list.push(item);
        }
      }
    }

    this.forbiddenCache.set(key, list);

    return [...list];
  }
}
