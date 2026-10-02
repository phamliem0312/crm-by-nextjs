"use client";

// Tạo nhanh / xem nhanh bản ghi trong hộp thoại (layout `detailSmall`), như `views/modals/edit` và `views/modals/detail`
// của classic. Dùng ở Lịch (chọn khoảng thời gian → tạo; bấm sự kiện → xem).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { FieldValue, initNewValues } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { Button, ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { getEntityDefs, getFieldDefs } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { buildDefaultSideFields, buildDetailPanels, detailFieldNames, type DetailLayoutPanel } from "@/lib/espo/layout";
import { createRecord, deleteRecord, getRecord, type EspoRecord } from "@/lib/espo/records";
import { recordCreateHref, recordEditHref, recordViewHref } from "@/lib/espo/routes";
import { FormFieldCell, useFormFields } from "./form-fields";
import { useLayout } from "./hooks";
import { FieldCell, PanelGrid } from "./panels";
import { defaultValues, DuplicatesDialog, ErrorSummary } from "./record-form";
import { LoadingBlock } from "./scope-gate";

function useSmallLayouts(scope: string) {
  const layout = useLayout<DetailLayoutPanel[]>(scope, "detailSmall", { fallback: "detail" });
  const sideLayout = useLayout<{ name: string }[]>(scope, "defaultSidePanel", { optional: true });

  return { layout: layout.data ?? null, sideLayout: sideLayout.data ?? null, loading: layout.isLoading || sideLayout.isLoading };
}

/**
 * Tạo nhanh: chọn loại (khi có nhiều loại, ví dụ Meeting/Call/Task trên lịch), điền form rút gọn, lưu.
 * `attributes`: giá trị điền sẵn theo từng loại.
 */
export function QuickCreateDialog({
  ctx,
  scopes,
  attributes,
  onClose,
  onSaved,
}: {
  ctx: FieldContext;
  scopes: string[];
  attributes: (scope: string) => Values;
  onClose: () => void;
  onSaved: (record: EspoRecord, scope: string) => void;
}) {
  const { t } = ctx;
  const [scope, setScope] = useState(scopes[0]);
  const groupId = useId();

  return (
    <Dialog open onClose={onClose} title={`${t("Create")} ${t(scope, "scopeNames")}`} size="lg">
      {scopes.length > 1 && (
        <div role="radiogroup" aria-labelledby={`${groupId}-label`} className="mb-4 flex flex-wrap gap-2">
          <span id={`${groupId}-label`} className="sr-only">
            {t("Type")}
          </span>
          {scopes.map((item) => (
            <label
              key={item}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                item === scope ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <input type="radio" name={groupId} value={item} checked={item === scope} onChange={() => setScope(item)} className="accent-blue-600" />
              {t(item, "scopeNames")}
            </label>
          ))}
        </div>
      )}
      <QuickCreateForm key={scope} ctx={ctx} scope={scope} initial={attributes(scope)} onCancel={onClose} onSaved={(record) => onSaved(record, scope)} />
    </Dialog>
  );
}

function QuickCreateForm({
  ctx,
  scope,
  initial,
  onCancel,
  onSaved,
}: {
  ctx: FieldContext;
  scope: string;
  initial: Values;
  onCancel: () => void;
  onSaved: (record: EspoRecord) => void;
}) {
  const { layout, sideLayout, loading } = useSmallLayouts(scope);

  if (loading || !layout) {
    return <LoadingBlock />;
  }

  return <QuickCreateContent ctx={ctx} scope={scope} layout={layout} sideLayout={sideLayout} initial={initial} onCancel={onCancel} onSaved={onSaved} />;
}

function QuickCreateContent({
  ctx,
  scope,
  layout,
  sideLayout,
  initial,
  onCancel,
  onSaved,
}: {
  ctx: FieldContext;
  scope: string;
  layout: DetailLayoutPanel[];
  sideLayout: { name: string }[] | null;
  initial: Values;
  onCancel: () => void;
  onSaved: (record: EspoRecord) => void;
}) {
  const { t, metadata, acl } = ctx;
  const queryClient = useQueryClient();
  const baseId = useId();
  const [values, setValues] = useState<Values>(() =>
    initNewValues(getEntityDefs(metadata, scope).fields ?? {}, { ...defaultValues(ctx, scope), ...initial }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[] | null>(null);
  const panels = useMemo(() => buildDetailPanels(layout, { scope, metadata, acl, t }), [layout, scope, metadata, acl, t]);
  const mainFields = useMemo(() => detailFieldNames(panels), [panels]);
  const sideFields = useMemo(
    () => buildDefaultSideFields(sideLayout, { scope, metadata, acl }).filter((field) => !mainFields.includes(field)),
    [sideLayout, scope, metadata, acl, mainFields],
  );
  const fields = useMemo(() => [...mainFields, ...sideFields], [mainFields, sideFields]);
  const form = useFormFields({ ctx, scope, fields, values, saved: null });

  async function save(skipDuplicateCheck = false) {
    const found = form.validate();

    setErrors(found);

    if (Object.keys(found).length) {
      document.getElementById(`${baseId}-${Object.keys(found)[0]}`)?.focus();

      return;
    }

    setSaving(true);

    try {
      const record = await createRecord(scope, form.collectData(), { skipDuplicateCheck });

      toast.success(t("Created"));
      await queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
      onSaved(record);
    } catch (error) {
      if (error instanceof EspoApiError && error.isDuplicate) {
        setDuplicates(error.list ?? []);
      } else {
        toast.error(error);
      }
    } finally {
      setSaving(false);
    }
  }

  const cell = (name: string, label: string, noLabel = false) => (
    <FormFieldCell
      ctx={ctx}
      scope={scope}
      name={name}
      label={label}
      noLabel={noLabel}
      values={values}
      setValues={setValues}
      errors={errors}
      form={form}
      inputId={`${baseId}-${name}`}
    />
  );

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <ErrorSummary errors={errors} />
      <PanelGrid
        panels={panels}
        t={t}
        isFieldVisible={form.isVisible}
        isPanelVisible={(panel) => form.logic.panels[panel.name]?.visible !== false}
        renderCell={(item) => cell(item.name, item.label, item.noLabel)}
      />
      {sideFields.filter(form.isVisible).length > 0 && (
        <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {sideFields.filter(form.isVisible).map((field) => (
            <div key={field}>{cell(field, t(field, "fields", scope))}</div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`${recordCreateHref(scope, metadata)}?${new URLSearchParams({ attributes: JSON.stringify(form.collectData()) }).toString()}`}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {t("Full Form")}
        </Link>
        <div className="flex gap-2">
          <Button onClick={onCancel} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
            {t("Save")}
          </Button>
        </div>
      </div>
      <DuplicatesDialog
        ctx={ctx}
        scope={scope}
        duplicates={duplicates}
        busy={saving}
        onCancel={() => setDuplicates(null)}
        onConfirm={() => {
          setDuplicates(null);
          void save(true);
        }}
      />
    </form>
  );
}

/** Xem nhanh một bản ghi (layout `detailSmall`): mở trang đầy đủ, sửa, xoá. */
export function QuickViewDialog({
  ctx,
  scope,
  id,
  onClose,
  onRemoved,
}: {
  ctx: FieldContext;
  scope: string;
  id: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const { t, metadata, acl } = ctx;
  const { layout, sideLayout, loading } = useSmallLayouts(scope);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const record = useQuery({
    queryKey: ["record", scope, id],
    queryFn: ({ signal }) => getRecord(scope, id, signal),
    retry: false,
  });
  const panels = useMemo(() => (layout ? buildDetailPanels(layout, { scope, metadata, acl, t }) : []), [layout, scope, metadata, acl, t]);
  const sideFields = useMemo(() => {
    const main = detailFieldNames(panels);

    return buildDefaultSideFields(sideLayout, { scope, metadata, acl }).filter((field) => !main.includes(field));
  }, [panels, sideLayout, scope, metadata, acl]);
  const data = record.data;
  const hasField = (field: string) => !!getFieldDefs(metadata, scope, field);
  const canEdit = !!data && acl.checkScope(scope, "edit") && acl.checkRecord(scope, data, "edit", { hasField }) !== false;
  const canDelete = !!data && acl.checkScope(scope, "delete") && acl.checkRecord(scope, data, "delete", { hasField }) !== false;

  async function remove() {
    setBusy(true);

    try {
      await deleteRecord(scope, id);
      toast.success(t("Removed"));
      onRemoved();
    } catch (error) {
      toast.error(error);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  const value = (name: string, label: string, noLabel = false) => {
    const defs = getFieldDefs(metadata, scope, name);

    return defs && data ? (
      <FieldCell label={label} noLabel={noLabel}>
        <FieldValue ctx={ctx} scope={scope} name={name} defs={defs} values={data} mode="detail" />
      </FieldCell>
    ) : null;
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={data ? String(data.name ?? "") || t(scope, "scopeNames") : t(scope, "scopeNames")}
      footer={
        <>
          {canDelete && (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="mr-auto text-red-600">
              <i className="fas fa-trash text-xs" aria-hidden />
              {t("Remove")}
            </Button>
          )}
          {canEdit && (
            <Link
              href={recordEditHref(scope, id, metadata)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <i className="fas fa-pen text-xs" aria-hidden />
              {t("Edit")}
            </Link>
          )}
          <Link
            href={recordViewHref(scope, id, metadata)}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
          >
            {t("View")}
          </Link>
        </>
      }
    >
      {record.error ? (
        <p className="text-sm text-slate-600">{t(record.error instanceof EspoApiError && record.error.status === 403 ? "Access denied" : "Not found")}</p>
      ) : loading || !data ? (
        <LoadingBlock />
      ) : (
        <div className="flex flex-col gap-4">
          <PanelGrid
            panels={panels}
            t={t}
            isFieldVisible={() => true}
            isPanelVisible={() => true}
            renderCell={(cell) => value(cell.name, cell.label, cell.noLabel)}
          />
          {sideFields.length > 0 && (
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">{sideFields.map((field) => <div key={field}>{value(field, t(field, "fields", scope))}</div>)}</div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={t("Remove")}
        message={t("removeRecordConfirmation", "messages")}
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Dialog>
  );
}
