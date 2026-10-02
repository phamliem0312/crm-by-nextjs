// Panel bên (side) và panel dưới (bottom) không phải relationship: activities, history, tasks, attendees…
// Port từ `views/record/detail-side` + `panels-container` của classic: lấy `clientDefs.<Scope>.sidePanels.<type>`
// (mục có `reference` ghép với `app.clientRecord.panels`), rồi áp layout `sidePanelsDetail`/`bottomPanelsDetail`.
import type { Acl } from "./acl";
import type { Metadata } from "./types";

/** Loại panel UI mới làm được; panel khác (view tuỳ biến của classic) bị bỏ qua. */
export type PanelKind = "activities" | "history" | "tasks" | "attendees" | "convertedTo";

export type PanelDef = {
  name: string;
  kind: PanelKind;
  label: string;
  index: number;
  /** Field hiển thị (attendees: users/contacts/leads; convertedTo: createdAccount…). */
  fields?: string[];
  /** View của classic (để nhận biết panel riêng như `crm:views/opportunity/record/panels/activities`). */
  view?: string;
};

type RawPanel = {
  name?: string;
  reference?: string;
  label?: string;
  aclScope?: string;
  disabled?: boolean;
  index?: number;
  order?: number;
  options?: { fieldList?: string[] };
  view?: string;
  [key: string]: unknown;
};

export type PanelLayout = Record<string, { index?: number; disabled?: boolean; [key: string]: unknown } | undefined>;

const KINDS: Record<string, PanelKind> = {
  activities: "activities",
  history: "history",
  tasks: "tasks",
  attendees: "attendees",
  convertedTo: "convertedTo",
};

function rawPanels(metadata: Metadata, scope: string, location: "sidePanels" | "bottomPanels", type: string): RawPanel[] {
  const clientDefs = (metadata.clientDefs?.[scope] ?? {}) as Record<string, Record<string, RawPanel[]> | undefined>;
  const references = ((metadata.app as Record<string, unknown> | undefined)?.clientRecord as { panels?: Record<string, RawPanel> } | undefined)
    ?.panels;

  return (clientDefs[location]?.[type] ?? []).map((item) =>
    item.reference ? { ...(references?.[item.reference] ?? {}), ...item } : item,
  );
}

/**
 * Panel cho một vị trí (`side` hoặc `bottom`) của trang chi tiết/sửa.
 * Layout (`sidePanelsDetail`, `bottomPanelsDetail`) bật/tắt và sắp thứ tự; panel bottom mặc định `disabled`
 * chỉ hiện khi layout bật lại (đổi chỗ từ side xuống bottom trong Layout Manager).
 */
export function buildExtraPanels(
  location: "side" | "bottom",
  ctx: { scope: string; type: "detail" | "edit"; metadata: Metadata; acl: Acl; t: (name: string, category?: string, scope?: string) => string },
  layout: PanelLayout | null | undefined,
): PanelDef[] {
  const raw = rawPanels(ctx.metadata, ctx.scope, location === "side" ? "sidePanels" : "bottomPanels", ctx.type);
  const result: PanelDef[] = [];

  raw.forEach((item, position) => {
    const name = item.name;
    const kind = name ? KINDS[name] : undefined;

    if (!name || !kind) {
      return;
    }

    const layoutItem = layout?.[name];
    const disabled = layoutItem?.disabled ?? item.disabled ?? false;

    if (disabled) {
      return;
    }

    if (item.aclScope && !ctx.acl.checkScope(item.aclScope)) {
      return;
    }

    if (kind === "tasks" && !ctx.acl.checkScope("Task", "read")) {
      return;
    }

    let fields: string[] | undefined;

    if (kind === "attendees") {
      // Như `crm:views/meeting/record/panels/attendees`: users luôn có; contacts/leads nếu được đọc.
      fields = ["users", ...["Contact", "Lead"].filter((s) => ctx.acl.checkScope(s, "read") && !ctx.metadata.scopes?.[s]?.disabled).map((s) => (s === "Contact" ? "contacts" : "leads"))];
    }

    if (kind === "convertedTo") {
      fields = ["createdAccount", "createdContact", "createdOpportunity"].filter((field) => {
        const entity = field.slice("created".length);

        return ctx.acl.checkScope(entity, "read");
      });
    }

    result.push({
      name,
      kind,
      label: ctx.t(item.label ?? name, "labels", ctx.scope),
      index: typeof layoutItem?.index === "number" ? layoutItem.index : (item.index ?? item.order ?? position + 1),
      fields,
      ...(typeof item.view === "string" ? { view: item.view } : {}),
    });
  });

  return result.sort((a, b) => a.index - b.index);
}
