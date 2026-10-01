"use client";

// Trang chi tiết dùng chung: panel theo layout `detail`, side panel mặc định, relationship panel,
// sửa nhanh từng field (PATCH), follow/star, xoá. Dynamic logic ẩn/hiện field và panel.
// Tương đương `views/detail` + `views/record/detail` của classic.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { extraSaveAttributes, FieldValue, getFieldType, prepareValuesForSave } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { evaluateLogic, type LogicDefs } from "@/lib/espo/dynamic-logic";
import { getFieldActualAttributeList, getFieldAttributeList, getFieldDefs } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import {
  buildBottomPanels,
  buildDefaultSideFields,
  buildDetailPanels,
  type BottomPanelsLayout,
  type DetailLayoutPanel,
} from "@/lib/espo/layout";
import { buildExtraPanels, type PanelLayout } from "@/lib/espo/side-panels";
import { StreamPanel } from "@/components/stream/stream-panel";
import { deleteRecord, getRecord, setFollowed, setStarred, updateRecord, type EspoRecord } from "@/lib/espo/records";
import { classicHref, recordEditHref, scopeListHref } from "@/lib/espo/routes";
import { validateField } from "@/lib/espo/validation";
import { ExtraPanel } from "./activity-panels";
import { BottomPanels } from "./bottom-panels";
import { useLayout } from "./hooks";
import { FieldCell, PanelGrid } from "./panels";
import { RelationshipPanel } from "./relationship-panel";
import { RecordHeaderActions } from "./record-actions";
import { LoadingBlock, PageMessage } from "./scope-gate";

export function DetailView({ scope, id }: { scope: string; id: string }) {
  const ctx = useFieldContext();
  const layout = useLayout<DetailLayoutPanel[]>(scope, "detail");
  const sideLayout = useLayout<{ name: string }[]>(scope, "defaultSidePanel", { optional: true });
  const bottomLayout = useLayout<BottomPanelsLayout>(scope, "bottomPanelsDetail", { optional: true });
  const sidePanelsLayout = useLayout<PanelLayout>(scope, "sidePanelsDetail", { optional: true });
  const record = useQuery({
    queryKey: ["record", scope, id],
    queryFn: ({ signal }) => getRecord(scope, id, signal),
    meta: { silent: true },
    retry: false,
  });

  if (record.error instanceof EspoApiError && (record.error.status === 404 || record.error.status === 403)) {
    return (
      <PageMessage
        icon={record.error.status === 404 ? "fas fa-question" : "fas fa-lock"}
        title={ctx?.t(record.error.status === 404 ? "Not found" : "Access denied") ?? ""}
      />
    );
  }

  if (!ctx || !layout.data || !record.data || sideLayout.isLoading || bottomLayout.isLoading || sidePanelsLayout.isLoading) {
    return record.error ? <PageMessage icon="fas fa-exclamation-triangle" title={ctx?.t("Error") ?? "Error"} /> : <LoadingBlock />;
  }

  return (
    <DetailContent
      ctx={ctx}
      scope={scope}
      record={record.data}
      layout={layout.data}
      sideLayout={sideLayout.data ?? null}
      bottomLayout={bottomLayout.data ?? null}
      sidePanelsLayout={sidePanelsLayout.data ?? null}
    />
  );
}

function DetailContent({
  ctx,
  scope,
  record,
  layout,
  sideLayout,
  bottomLayout,
  sidePanelsLayout,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  layout: DetailLayoutPanel[];
  sideLayout: { name: string }[] | null;
  bottomLayout: BottomPanelsLayout | null;
  sidePanelsLayout: PanelLayout | null;
}) {
  const { t, metadata, acl } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const scopeDefs = metadata.scopes?.[scope] ?? {};
  const hasField = (field: string) => !!getFieldDefs(metadata, scope, field);
  const canEdit = acl.checkScope(scope, "edit") && acl.checkRecord(scope, record, "edit", { hasField }) !== false;
  const canDelete = acl.checkScope(scope, "delete") && acl.checkRecord(scope, record, "delete", { hasField }) !== false;

  const panels = useMemo(() => buildDetailPanels(layout, { scope, metadata, acl, t }), [layout, scope, metadata, acl, t]);
  const sideFields = useMemo(() => buildDefaultSideFields(sideLayout, { scope, metadata, acl }), [sideLayout, scope, metadata, acl]);
  // Stream hiện khi scope bật stream và người dùng có quyền `stream` với bản ghi (như `detail-bottom`).
  const streamAllowed = scopeDefs.stream === true && acl.checkRecord(scope, record, "stream", { hasField }) !== false;
  const sidePanels = useMemo(
    () => buildExtraPanels("side", { scope, type: "detail", metadata, acl, t }, sidePanelsLayout),
    [scope, metadata, acl, t, sidePanelsLayout],
  );
  const extraBottomPanels = useMemo(
    () => buildExtraPanels("bottom", { scope, type: "detail", metadata, acl, t }, bottomLayout as PanelLayout | null),
    [scope, metadata, acl, t, bottomLayout],
  );
  const bottomPanels = useMemo(
    () => buildBottomPanels(bottomLayout, { scope, metadata, acl, t }, { stream: streamAllowed, extra: extraBottomPanels }),
    [bottomLayout, scope, metadata, acl, t, streamAllowed, extraBottomPanels],
  );

  const logic = useMemo(
    () =>
      evaluateLogic((metadata.logicDefs as Record<string, LogicDefs> | undefined)?.[scope], record, {
        userId: ctx.user.id,
        teamsIds: ctx.user.teamsIds ?? [],
        dateTime: ctx.dateTime,
      }),
    [metadata, scope, record, ctx.user, ctx.dateTime],
  );

  useEffect(() => {
    document.title = `${String(record.name ?? t(scope, "scopeNames"))} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [record.name, scope, t, ctx.settings.applicationName]);

  const setRecord = (next: EspoRecord) => queryClient.setQueryData(["record", scope, record.id], next);

  async function toggle(kind: "follow" | "star") {
    const current = kind === "follow" ? !!record.isFollowed : !!record.isStarred;

    try {
      await (kind === "follow" ? setFollowed : setStarred)(scope, record.id, !current);
      setRecord({ ...record, [kind === "follow" ? "isFollowed" : "isStarred"]: !current });
    } catch (error) {
      toast.error(error);
    }
  }

  async function remove() {
    setBusy(true);

    try {
      await deleteRecord(scope, record.id);
      toast.success(t("Removed"));
      await queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
      router.push(scopeListHref(scope, metadata));
    } catch (error) {
      toast.error(error);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const isFieldVisible = (field: string) => logic.fields[field]?.visible !== false;

  const renderField = (field: string, label: string, noLabel = false) => (
    <DetailField
      key={field}
      ctx={ctx}
      scope={scope}
      record={record}
      field={field}
      label={label}
      noLabel={noLabel}
      canEdit={canEdit && logic.fields[field]?.readOnly !== true}
      required={logic.fields[field]?.required}
      optionList={logic.options[field]}
      onSaved={setRecord}
    />
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href={scopeListHref(scope, metadata)} className="hover:text-slate-800 hover:underline">
              {t(scope, "scopeNamesPlural")}
            </Link>
          </nav>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight break-words">
            {String(record.name ?? "") || record.id}
            {/* Admin vẫn mở được bản ghi đã xoá mềm (để khôi phục ở classic). */}
            {record.deleted === true && (
              <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-600/20 ring-inset">
                {t("deleted", "fields")}
              </span>
            )}
            {scopeDefs.stars === true && (
              <button
                type="button"
                onClick={() => toggle("star")}
                aria-pressed={!!record.isStarred}
                aria-label={record.isStarred ? t("Unstar") : t("Star")}
                title={record.isStarred ? t("Unstar") : t("Star")}
                className={`rounded p-1 text-base ${record.isStarred ? "text-amber-500" : "text-slate-300 hover:text-slate-500"}`}
              >
                <i className={record.isStarred ? "fas fa-star" : "far fa-star"} aria-hidden />
              </button>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <RecordHeaderActions ctx={ctx} scope={scope} record={record} canEdit={canEdit} onRecordChange={setRecord} />
          {scopeDefs.stream === true && (
            <Button onClick={() => toggle("follow")} aria-pressed={!!record.isFollowed}>
              <i className={`fas ${record.isFollowed ? "fa-check" : "fa-rss"} text-xs`} aria-hidden />
              {record.isFollowed ? t("Followed") : t("Follow")}
            </Button>
          )}
          {canEdit && (
            <Link
              href={recordEditHref(scope, record.id, metadata)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
            >
              <i className="fas fa-pen text-xs" aria-hidden />
              {t("Edit")}
            </Link>
          )}
          {canDelete && (
            <Button onClick={() => setConfirmDelete(true)} aria-label={t("Remove")} title={t("Remove")}>
              <i className="fas fa-trash text-xs text-red-600" aria-hidden />
            </Button>
          )}
          <a
            href={classicHref(`#${scope}/view/${encodeURIComponent(record.id)}`)}
            className="inline-flex h-9 items-center rounded-lg px-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            title="EspoCRM Classic"
            aria-label="EspoCRM Classic"
          >
            <i className="fas fa-external-link-alt text-xs" aria-hidden />
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <PanelGrid
            panels={panels}
            t={t}
            isFieldVisible={isFieldVisible}
            isPanelVisible={(panel) => logic.panels[panel.name]?.visible !== false}
            renderCell={(cell) => renderField(cell.name, cell.label, cell.noLabel)}
          />
          <BottomPanels
            panels={bottomPanels}
            t={t}
            render={(panel) => {
              if (panel.kind === "stream") {
                return (
                  <StreamPanel
                    key="stream"
                    ctx={ctx}
                    scope={scope}
                    record={record}
                    canEditParent={canEdit}
                    onFollowed={() => setRecord({ ...record, isFollowed: true })}
                  />
                );
              }

              if (panel.kind === "relationship") {
                return <RelationshipPanel key={panel.name} ctx={ctx} scope={scope} record={record} panel={panel.panel} canEditParent={canEdit} />;
              }

              const extra = extraBottomPanels.find((item) => item.name === panel.name);

              return extra ? <ExtraPanel key={panel.name} ctx={ctx} scope={scope} record={record} panel={extra} /> : null;
            }}
          />
        </div>

        <aside className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-xs">
            {sideFields.filter(isFieldVisible).map((field) => renderField(field, t(field, "fields", scope)))}
            <CreatedModified ctx={ctx} scope={scope} record={record} />
          </section>
          {sidePanels.map((panel) => (
            <ExtraPanel
              key={panel.name}
              ctx={ctx}
              scope={scope}
              record={record}
              panel={panel}
              renderField={(field, label) => renderField(field, label)}
            />
          ))}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("Remove")}
        message={t("removeRecordConfirmation", "messages")}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

/** Ngày tạo/sửa kèm người tạo/sửa (giống "complexCreated" của classic). */
function CreatedModified({ ctx, scope, record }: { ctx: FieldContext; scope: string; record: EspoRecord }) {
  const { t } = ctx;
  const rows = [
    { label: t("Created"), at: record.createdAt, by: record.createdByName, field: "createdAt" },
    { label: t("Modified"), at: record.modifiedAt, by: record.modifiedByName, field: "modifiedAt" },
  ].filter((row) => row.at && getFieldDefs(ctx.metadata, scope, row.field));

  if (!rows.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
      {rows.map((row) => (
        <FieldCell key={row.field} label={row.label}>
          <span className="text-slate-700">
            {ctx.dateTime.toDisplay(String(row.at))}
            {row.by ? <span className="text-slate-500"> · {String(row.by)}</span> : null}
          </span>
        </FieldCell>
      ))}
    </div>
  );
}

/** Một field ở trang chi tiết, có nút sửa nhanh (PATCH chỉ field này). */
function DetailField({
  ctx,
  scope,
  record,
  field,
  label,
  noLabel,
  canEdit,
  required,
  optionList,
  onSaved,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  field: string;
  label: string;
  noLabel: boolean;
  canEdit: boolean;
  required?: boolean;
  optionList?: string[];
  onSaved: (record: EspoRecord) => void;
}) {
  const { t, metadata, acl } = ctx;
  const defs = getFieldDefs(metadata, scope, field);
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Values>(record);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!defs) {
    return null;
  }

  const Edit = getFieldType(defs).Edit;
  const inlineEditable =
    canEdit &&
    !!Edit &&
    !defs.readOnly &&
    !defs.readOnlyAfterCreate &&
    !defs.inlineEditDisabled &&
    acl.checkField(scope, field, "edit");

  async function save() {
    const validation = validateField(field, values, {
      scope,
      metadata,
      t,
      isRequired: (_, fieldDefs) => required ?? !!fieldDefs.required,
    });

    if (validation) {
      setError(validation);

      return;
    }

    const prepared = prepareValuesForSave([{ name: field, defs: defs! }], values);
    const data: Values = {};

    for (const attribute of [...getFieldActualAttributeList(metadata, scope, field), ...extraSaveAttributes(field, defs!)]) {
      data[attribute] = prepared[attribute] ?? null;
    }

    setSaving(true);

    try {
      const saved = await updateRecord(scope, record.id, data);

      // Server trả bản ghi đầy đủ; giữ attribute hiển thị (ví dụ `accountName`) từ form nếu thiếu.
      const merged = { ...record, ...Object.fromEntries(getFieldAttributeList(metadata, scope, field).map((a) => [a, prepared[a]])), ...saved };

      onSaved(merged as EspoRecord);
      setEditing(false);
      setError(null);
    } catch (e) {
      toast.error(e);
    } finally {
      setSaving(false);
    }
  }

  if (editing && Edit) {
    return (
      <FieldCell label={label} htmlFor={inputId} noLabel={noLabel} required={required ?? !!defs.required} error={error} errorId={`${inputId}-error`}>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setEditing(false);
              setValues(record);
              setError(null);
            }
          }}
        >
          <Edit
            ctx={ctx}
            scope={scope}
            name={field}
            defs={defs}
            values={values}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            inputId={inputId}
            invalid={!!error}
            required={required ?? !!defs.required}
            optionList={optionList}
            describedBy={error ? `${inputId}-error` : undefined}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" className="h-8 px-3" disabled={saving}>
              {t("Save")}
            </Button>
            <Button
              className="h-8 px-3"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setValues(record);
                setError(null);
              }}
            >
              {t("Cancel")}
            </Button>
          </div>
        </form>
      </FieldCell>
    );
  }

  return (
    <FieldCell
      label={label}
      noLabel={noLabel}
      actions={
        inlineEditable ? (
          <button
            type="button"
            onClick={() => {
              setValues(record);
              setEditing(true);
            }}
            aria-label={`${t("Edit")}: ${label}`}
            title={t("Edit")}
            className="rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-700 focus-visible:opacity-100"
          >
            <i className="fas fa-pen text-[11px]" aria-hidden />
          </button>
        ) : null
      }
    >
      <FieldValue ctx={ctx} scope={scope} name={field} defs={defs} values={record} mode="detail" />
    </FieldCell>
  );
}
