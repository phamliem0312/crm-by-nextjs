// Xuất dữ liệu (Export) như `views/record/list` (massActionExport) + `views/export/modals/export|idle` của classic.
import type { Acl } from "./acl";
import { espoGet } from "./client";
import { getAttributeList, getEntityDefs } from "./entity";
import { sendRequest } from "./records";
import type { SearchParams } from "./search";
import type { Metadata, Settings } from "./types";

export function canExport(scope: string, ctx: { settings: Settings; acl: Acl; metadata: Metadata }): boolean {
  if (ctx.settings.exportDisabled && !ctx.acl.isAdmin()) {
    return false;
  }

  if (ctx.acl.getPermissionLevel("exportPermission") === "no") {
    return false;
  }

  return !(ctx.metadata.clientDefs?.[scope] as Record<string, unknown> | undefined)?.exportDisabled;
}

/** Định dạng xuất (`scopes.<Scope>.exportFormatList` hoặc `app.export.formatList`). */
export function exportFormats(metadata: Metadata, scope: string): string[] {
  const own = (metadata.scopes?.[scope] as Record<string, unknown> | undefined)?.exportFormatList;
  const global = ((metadata.app as Record<string, unknown> | undefined)?.export as { formatList?: string[] } | undefined)?.formatList;
  const list = Array.isArray(own) ? own : global;

  return Array.isArray(list) && list.length ? list.map(String) : ["csv"];
}

/** Field xuất được trong danh sách (bỏ `exportDisabled`, `utility`, field không còn). */
export function exportableFields(metadata: Metadata, scope: string, fields: string[]): string[] {
  const defs = getEntityDefs(metadata, scope).fields ?? {};

  return fields.filter((field) => defs[field] && !defs[field].exportDisabled && !defs[field].utility && !defs[field].disabled);
}

/** Attribute ứng với danh sách field (như `actionExport` của modal classic). */
export function exportAttributeList(metadata: Metadata, scope: string, fields: string[]): string[] {
  const defs = getEntityDefs(metadata, scope).fields ?? {};

  return fields.flatMap((field) => {
    if (field === "id") {
      return ["id"];
    }

    return defs[field] ? getAttributeList(metadata, defs[field].type, field) : [];
  });
}

/** Xuất trên nền (idle) khi chọn "tất cả kết quả" mà số bản ghi vượt ngưỡng `exportIdleCountThreshold`. */
export function exportShouldBeIdle(total: number, allResult: boolean, settings: Settings, isPortal: boolean): boolean {
  if (!allResult || isPortal) {
    return false;
  }

  const threshold = typeof settings.exportIdleCountThreshold === "number" ? settings.exportIdleCountThreshold : 1000;

  return total === -1 || total > threshold;
}

export type ExportRequest = {
  entityType: string;
  format: string;
  /** Bản ghi đã chọn; không có thì xuất mọi kết quả theo `searchParams`. */
  ids?: string[];
  searchParams?: SearchParams;
  fieldList?: string[];
  attributeList?: string[];
  idle?: boolean;
  params?: Record<string, unknown>;
};

/** `{ id }` = attachment để tải ngay; `{ exportId }` = đang xuất trên nền, hỏi trạng thái qua `getExportStatus`. */
export function startExport(request: ExportRequest): Promise<{ id?: string; exportId?: string }> {
  return sendRequest("POST", "Export", request);
}

export type ExportStatus = { status: "Pending" | "Running" | "Success" | "Failed" | string; attachmentId?: string | null };

export function getExportStatus(id: string): Promise<ExportStatus> {
  return espoGet<ExportStatus>(`Export/${encodeURIComponent(id)}/status`);
}

export function downloadUrl(classicBasePath: string, attachmentId: string): string {
  return `${classicBasePath}/?entryPoint=download&id=${encodeURIComponent(attachmentId)}`;
}
