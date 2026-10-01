"use client";

// Form sửa/tạo dùng chung: layout `detail` + cột bên (người phụ trách, team, người tham dự), giá trị mặc định
// (entityDefs + createAttributeMap), dynamic logic, validate, lưu bằng POST/PATCH, xử lý 409 trùng bản ghi.
// Tương đương `views/edit` + `views/record/edit` của classic.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { getFieldType, initNewValues } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { resolveDefaultValue } from "@/lib/espo/defaults";
import { getEntityDefs, getFieldDefs, isFieldAvailable } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { buildDefaultSideFields, buildDetailPanels, detailFieldNames, type DetailLayoutPanel } from "@/lib/espo/layout";
import { changedAttributes, createRecord, getRecord, linkRecords, updateRecord, type EspoRecord } from "@/lib/espo/records";
import { recordViewHref, scopeListHref } from "@/lib/espo/routes";
import { buildExtraPanels } from "@/lib/espo/side-panels";
import { FormFieldCell, useFormFields } from "./form-fields";
import { useLayout } from "./hooks";
import { PanelGrid } from "./panels";
import { LoadingBlock, PageMessage } from "./scope-gate";

type Relate = { scope: string; id: string; link: string; name?: string };

/**
 * Port `Model.setRelate` của classic: bản ghi tạo từ panel quan hệ được điền sẵn field ứng với link ngược
 * (ví dụ tạo Contact từ panel `Account.contacts` → field `accounts`/`account` của Contact trỏ về Account đó).
 */
function relateValues(ctx: FieldContext, scope: string, relate: Relate): Values {
  const foreign = getEntityDefs(ctx.metadata, relate.scope).links?.[relate.link]?.foreign;
  const defs = foreign ? getFieldDefs(ctx.metadata, scope, foreign) : undefined;

  if (!foreign || !defs) {
    return {};
  }

  const name = relate.name ?? relate.id;

  if (defs.type === "link" || defs.type === "linkOne") {
    return { [`${foreign}Id`]: relate.id, [`${foreign}Name`]: name };
  }

  if (defs.type === "linkMultiple") {
    return { [`${foreign}Ids`]: [relate.id], [`${foreign}Names`]: { [relate.id]: name } };
  }

  if (defs.type === "linkParent") {
    return { [`${foreign}Id`]: relate.id, [`${foreign}Type`]: relate.scope, [`${foreign}Name`]: name };
  }

  return {};
}

function parseJsonParam<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    const data: unknown = JSON.parse(value);

    return data && typeof data === "object" && !Array.isArray(data) ? (data as T) : null;
  } catch {
    return null;
  }
}

export function RecordForm({ scope, id }: { scope: string; id?: string }) {
  const ctx = useFieldContext();
  const layout = useLayout<DetailLayoutPanel[]>(scope, "detail");
  const sideLayout = useLayout<{ name: string }[]>(scope, "defaultSidePanel", { optional: true });
  const record = useQuery({
    queryKey: ["record", scope, id],
    queryFn: ({ signal }) => getRecord(scope, id!, signal),
    enabled: !!id,
    meta: { silent: true },
    retry: false,
  });

  if (id && record.error instanceof EspoApiError) {
    return <PageMessage icon="fas fa-exclamation-triangle" title={ctx?.t(record.error.status === 404 ? "Not found" : "Access denied") ?? ""} />;
  }

  if (!ctx || !layout.data || sideLayout.isLoading || (id && !record.data)) {
    return <LoadingBlock />;
  }

  return (
    <FormContent
      key={id ?? "new"}
      ctx={ctx}
      scope={scope}
      layout={layout.data}
      sideLayout={sideLayout.data ?? null}
      saved={record.data ?? null}
    />
  );
}

/** Giá trị mặc định khi tạo mới: `default` của field, nhắc nhở theo Preferences, người phụ trách = người dùng hiện tại. */
export function defaultValues(ctx: FieldContext, scope: string): Values {
  const values: Values = {};
  const fields = getEntityDefs(ctx.metadata, scope).fields ?? {};

  for (const [name, defs] of Object.entries(fields)) {
    const getDefault = getFieldType(defs).getDefault;

    if (getDefault && !defs.readOnly && isFieldAvailable(ctx.metadata, scope, name)) {
      Object.assign(values, getDefault(ctx, scope, name));
    }

    if (defs.default === undefined || defs.default === null || defs.readOnly || !isFieldAvailable(ctx.metadata, scope, name)) {
      continue;
    }

    // "javascript: return this.dateTime.getToday();"… → giá trị thật; biểu thức lạ → bỏ qua.
    const value = resolveDefaultValue(defs.default, ctx.dateTime);

    if (value !== undefined) {
      values[name] = value;
    }
  }

  if (fields.assignedUser && !fields.assignedUser.readOnly && ctx.acl.checkField(scope, "assignedUser", "edit")) {
    values.assignedUserId = ctx.user.id;
    values.assignedUserName = ctx.user.name ?? ctx.user.userName;
  }

  if (fields.currency && !values.currency) {
    values.currency = ctx.settings.defaultCurrency;
  }

  return values;
}

/** Hộp thoại "có bản ghi trùng" (409): xem các bản ghi trùng hoặc vẫn lưu. */
export function DuplicatesDialog({
  ctx,
  scope,
  duplicates,
  busy,
  onCancel,
  onConfirm,
}: {
  ctx: FieldContext;
  scope: string;
  duplicates: Record<string, unknown>[] | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t, metadata } = ctx;

  return (
    <Dialog
      open={!!duplicates}
      onClose={onCancel}
      title={t("duplicate", "messages")}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" disabled={busy} onClick={onConfirm}>
            {t("Save")}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-1.5">
        {(duplicates ?? []).map((item) => (
          <li key={String(item.id)}>
            <a
              href={recordViewHref(String(item._entityType ?? scope), String(item.id), metadata)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {String(item.name ?? item.id)}
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  if (!Object.keys(errors).length) {
    return null;
  }

  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <ul className="list-disc pl-4">
        {Object.entries(errors).map(([field, message]) => (
          <li key={field}>{message}</li>
        ))}
      </ul>
    </div>
  );
}

function FormContent({
  ctx,
  scope,
  layout,
  sideLayout,
  saved,
}: {
  ctx: FieldContext;
  scope: string;
  layout: DetailLayoutPanel[];
  sideLayout: { name: string }[] | null;
  saved: EspoRecord | null;
}) {
  const { t, metadata, acl } = ctx;
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const baseId = useId();
  const isNew = !saved;
  const relate = isNew ? parseJsonParam<Relate>(searchParams.get("relate")) : null;
  const [values, setValues] = useState<Values>(() =>
    saved
      ? { ...saved }
      : initNewValues(getEntityDefs(metadata, scope).fields ?? {}, {
          ...defaultValues(ctx, scope),
          ...(relate ? relateValues(ctx, scope, relate) : {}),
          ...(parseJsonParam<Values>(searchParams.get("attributes")) ?? {}),
        }),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[] | null>(null);

  const panels = useMemo(() => buildDetailPanels(layout, { scope, metadata, acl, t }), [layout, scope, metadata, acl, t]);
  const mainFields = useMemo(() => detailFieldNames(panels), [panels]);
  // Cột bên như classic: panel mặc định (người phụ trách, team) + panel người tham dự (Meeting/Call).
  const sideGroups = useMemo(() => {
    const defaults = buildDefaultSideFields(sideLayout, { scope, metadata, acl }).filter((field) => !mainFields.includes(field));
    const extra = buildExtraPanels("side", { scope, type: "edit", metadata, acl, t }, null)
      .filter((panel) => panel.kind === "attendees")
      .map((panel) => ({
        name: panel.name,
        label: panel.label as string | null,
        fields: (panel.fields ?? []).filter((field) => getFieldDefs(metadata, scope, field) && !mainFields.includes(field)),
      }));

    return [{ name: "default", label: null as string | null, fields: defaults }, ...extra].filter((group) => group.fields.length);
  }, [sideLayout, scope, metadata, acl, t, mainFields]);
  const fields = useMemo(() => [...mainFields, ...sideGroups.flatMap((group) => group.fields)], [mainFields, sideGroups]);
  const form = useFormFields({ ctx, scope, fields, values, saved });

  useEffect(() => {
    document.title = `${isNew ? t("Create") : String(saved?.name ?? "")} · ${t(scope, "scopeNames")}`;
  }, [isNew, saved, scope, t]);

  async function save(skipDuplicateCheck = false) {
    const found = form.validate();

    setErrors(found);

    if (Object.keys(found).length) {
      document.getElementById(`${baseId}-${Object.keys(found)[0]}`)?.focus();

      return;
    }

    const data = form.collectData();

    setSaving(true);

    try {
      let result: EspoRecord;

      if (isNew) {
        result = await createRecord(scope, data, { skipDuplicateCheck });

        // Tạo từ relationship panel: liên kết với bản ghi cha nếu createAttributeMap chưa làm việc đó.
        const linkedByAttributes = Object.values(data).some(
          (value) => value === relate?.id || (Array.isArray(value) && value.includes(relate?.id)),
        );

        if (relate && !linkedByAttributes) {
          await linkRecords(relate.scope, relate.id, relate.link, [result.id]).catch((error) => toast.error(error));
        }
      } else {
        const changes = changedAttributes(saved!, data);

        if (!Object.keys(changes).length) {
          toast.info(t("notModified", "messages"));
          router.push(recordViewHref(scope, saved!.id, metadata));

          return;
        }

        result = await updateRecord(scope, saved!.id, changes, { skipDuplicateCheck });
      }

      toast.success(t("Saved"));
      queryClient.setQueryData(["record", scope, result.id], result);
      await queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
      // Stream/hoạt động của bản ghi (và bản ghi cha) có mục mới.
      await queryClient.invalidateQueries({ queryKey: ["stream"] });

      if (relate) {
        await queryClient.invalidateQueries({ queryKey: ["related", relate.scope, relate.id] });
      }

      router.push(relate ? recordViewHref(relate.scope, relate.id, metadata) : recordViewHref(scope, result.id, metadata));
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

  const renderFieldCell = (name: string, label: string, noLabel: boolean) => (
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

  const cancelHref = relate
    ? recordViewHref(relate.scope, relate.id, metadata)
    : saved
      ? recordViewHref(scope, saved.id, metadata)
      : scopeListHref(scope, metadata);

  return (
    <form
      noValidate
      className="mx-auto flex max-w-7xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
            <Link href={scopeListHref(scope, metadata)} className="hover:text-slate-800 hover:underline">
              {t(scope, "scopeNamesPlural")}
            </Link>
            {saved && (
              <>
                <span className="mx-1.5" aria-hidden>/</span>
                <Link href={recordViewHref(scope, saved.id, metadata)} className="hover:text-slate-800 hover:underline">
                  {String(saved.name ?? saved.id)}
                </Link>
              </>
            )}
          </nav>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {isNew ? `${t("Create")} ${t(scope, "scopeNames")}` : t("Edit")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={cancelHref}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
          >
            {t("Cancel")}
          </Link>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
            {t("Save")}
          </Button>
        </div>
      </div>

      <ErrorSummary errors={errors} />

      <div className={sideGroups.length ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}>
        <PanelGrid
          panels={panels}
          t={t}
          isFieldVisible={form.isVisible}
          isPanelVisible={(panel) => form.logic.panels[panel.name]?.visible !== false}
          renderCell={(cell) => renderFieldCell(cell.name, cell.label, cell.noLabel)}
        />
        {sideGroups.length > 0 && (
          <aside className="flex flex-col gap-4">
            {sideGroups.map((group) => (
              <section key={group.name} className="rounded-xl border border-slate-200 bg-white shadow-xs">
                {group.label && <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{group.label}</h2>}
                <div className="flex flex-col gap-4 px-5 py-4">
                  {group.fields.filter(form.isVisible).map((field) => (
                    <div key={field}>{renderFieldCell(field, t(field, "fields", scope), false)}</div>
                  ))}
                </div>
              </section>
            ))}
          </aside>
        )}
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
