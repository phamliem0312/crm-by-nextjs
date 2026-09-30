"use client";

// Form sửa/tạo dùng chung: layout `detail`, giá trị mặc định (entityDefs + createAttributeMap), dynamic logic,
// validate (required, pattern, min/max…), lưu bằng POST/PATCH, xử lý 409 trùng bản ghi.
// Tương đương `views/edit` + `views/record/edit` của classic.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import {
  applyFormChange,
  extraSaveAttributes,
  FieldValue,
  getFieldType,
  prepareValuesForSave,
} from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { resolveDefaultValue } from "@/lib/espo/defaults";
import { evaluateLogic, type LogicDefs } from "@/lib/espo/dynamic-logic";
import { getEntityDefs, getFieldActualAttributeList, getFieldDefs, isFieldAvailable } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { buildDetailPanels, detailFieldNames, type DetailLayoutPanel } from "@/lib/espo/layout";
import { changedAttributes, createRecord, getRecord, linkRecords, updateRecord, type EspoRecord } from "@/lib/espo/records";
import { recordViewHref, scopeListHref } from "@/lib/espo/routes";
import { validateFields } from "@/lib/espo/validation";
import { useLayout } from "./hooks";
import { FieldCell, PanelGrid } from "./panels";
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

  if (!ctx || !layout.data || (id && !record.data)) {
    return <LoadingBlock />;
  }

  return <FormContent key={id ?? "new"} ctx={ctx} scope={scope} layout={layout.data} saved={record.data ?? null} />;
}

/** Giá trị mặc định khi tạo mới: `default` của field, người phụ trách = người dùng hiện tại. */
function defaultValues(ctx: FieldContext, scope: string): Values {
  const values: Values = {};
  const fields = getEntityDefs(ctx.metadata, scope).fields ?? {};

  for (const [name, defs] of Object.entries(fields)) {
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

function FormContent({
  ctx,
  scope,
  layout,
  saved,
}: {
  ctx: FieldContext;
  scope: string;
  layout: DetailLayoutPanel[];
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
      : {
          ...defaultValues(ctx, scope),
          ...(relate ? relateValues(ctx, scope, relate) : {}),
          ...(parseJsonParam<Values>(searchParams.get("attributes")) ?? {}),
        },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[] | null>(null);

  const panels = useMemo(() => buildDetailPanels(layout, { scope, metadata, acl, t }), [layout, scope, metadata, acl, t]);
  const fields = useMemo(() => detailFieldNames(panels), [panels]);
  const formFields = useMemo(
    () => fields.map((name) => ({ name, defs: getFieldDefs(metadata, scope, name)! })).filter((field) => !!field.defs),
    [fields, metadata, scope],
  );
  const logic = useMemo(
    () =>
      evaluateLogic(
        (metadata.logicDefs as Record<string, LogicDefs> | undefined)?.[scope],
        values,
        { userId: ctx.user.id, teamsIds: ctx.user.teamsIds ?? [], dateTime: ctx.dateTime },
        saved,
      ),
    [metadata, scope, values, ctx.user, ctx.dateTime, saved],
  );

  useEffect(() => {
    document.title = `${isNew ? t("Create") : String(saved?.name ?? "")} · ${t(scope, "scopeNames")}`;
  }, [isNew, saved, scope, t]);

  const isVisible = (field: string) => logic.fields[field]?.visible !== false;
  const isRequired = (field: string) => logic.fields[field]?.required ?? !!getFieldDefs(metadata, scope, field)?.required;
  const isReadOnly = (field: string) => {
    const defs = getFieldDefs(metadata, scope, field);

    return (
      !defs ||
      !!defs.readOnly ||
      (!isNew && !!defs.readOnlyAfterCreate) ||
      logic.fields[field]?.readOnly === true ||
      !acl.checkField(scope, field, "edit") ||
      !getFieldType(defs.type).Edit
    );
  };

  const editableFields = fields.filter((field) => isVisible(field) && !isReadOnly(field));

  async function save(skipDuplicateCheck = false) {
    const found = validateFields(editableFields, values, { scope, metadata, t, isRequired: (field) => isRequired(field) });

    setErrors(found);

    if (Object.keys(found).length) {
      document.getElementById(`${baseId}-${Object.keys(found)[0]}`)?.focus();

      return;
    }

    const prepared = prepareValuesForSave(
      editableFields.map((name) => ({ name, type: getFieldDefs(metadata, scope, name)!.type })),
      values,
    );
    const data: Values = {};

    // Chỉ gửi attribute "thật" của field sửa được (và attribute field đó điều khiển, ví dụ duration → dateEnd),
    // cộng các attribute nhận từ createAttributeMap khi tạo mới.
    for (const field of editableFields) {
      const defs = getFieldDefs(metadata, scope, field)!;

      for (const attribute of [...getFieldActualAttributeList(metadata, scope, field), ...extraSaveAttributes(field, defs)]) {
        data[attribute] = prepared[attribute] ?? null;
      }
    }

    if (isNew) {
      for (const [key, value] of Object.entries(values)) {
        if (!(key in data) && value !== undefined) {
          data[key] = value;
        }
      }
    }

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

  const cancelHref = relate
    ? recordViewHref(relate.scope, relate.id, metadata)
    : saved
      ? recordViewHref(scope, saved.id, metadata)
      : scopeListHref(scope, metadata);

  return (
    <form
      noValidate
      className="mx-auto flex max-w-5xl flex-col gap-5"
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

      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <ul className="list-disc pl-4">
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <PanelGrid
        panels={panels}
        t={t}
        isFieldVisible={isVisible}
        isPanelVisible={(panel) => logic.panels[panel.name]?.visible !== false}
        renderCell={(cell) => {
          const defs = getFieldDefs(metadata, scope, cell.name)!;
          const inputId = `${baseId}-${cell.name}`;
          const error = errors[cell.name];

          if (isReadOnly(cell.name)) {
            return (
              <FieldCell label={cell.label} noLabel={cell.noLabel}>
                <FieldValue ctx={ctx} scope={scope} name={cell.name} defs={defs} values={values} mode="detail" />
              </FieldCell>
            );
          }

          const Edit = getFieldType(defs.type).Edit!;

          return (
            <FieldCell
              label={cell.label}
              htmlFor={inputId}
              noLabel={cell.noLabel}
              required={isRequired(cell.name)}
              error={error}
              errorId={`${inputId}-error`}
            >
              <Edit
                ctx={ctx}
                scope={scope}
                name={cell.name}
                defs={defs}
                values={values}
                onChange={(patch) => setValues((current) => applyFormChange(formFields, current, { ...current, ...patch }))}
                inputId={inputId}
                invalid={!!error}
                required={isRequired(cell.name)}
                optionList={logic.options[cell.name]}
                describedBy={error ? `${inputId}-error` : undefined}
              />
            </FieldCell>
          );
        }}
      />

      <Dialog
        open={!!duplicates}
        onClose={() => setDuplicates(null)}
        title={t("duplicate", "messages")}
        footer={
          <>
            <Button onClick={() => setDuplicates(null)} disabled={saving}>
              {t("Cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => {
                setDuplicates(null);
                void save(true);
              }}
            >
              {t("Save")}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-1.5">
          {(duplicates ?? []).map((item) => (
            <li key={String(item.id)}>
              <a
                href={recordViewHref(scope, String(item.id), metadata)}
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
    </form>
  );
}
