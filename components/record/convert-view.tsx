"use client";

// Chuyển đổi bản ghi (Lead → Account/Contact/Opportunity): chọn entity cần tạo, form điền sẵn từ
// `<Scope>/action/getConvertAttributes`, layout `detailConvert`, gửi `<Scope>/action/convert`.
// Port từ `crm:views/lead/convert` của classic; dùng cho mọi scope có `convertEntityList`.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { initNewValues } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { Button } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { getEntityDefs } from "@/lib/espo/entity";
import { EspoApiError } from "@/lib/espo/errors";
import { buildDetailPanels, detailFieldNames, type DetailLayoutPanel } from "@/lib/espo/layout";
import { canConvert, convertScopes } from "@/lib/espo/record-actions";
import { getRecord, postAction, type EspoRecord } from "@/lib/espo/records";
import { recordViewHref, scopeListHref } from "@/lib/espo/routes";
import { FormFieldCell, useFormFields, type FormState } from "./form-fields";
import { useLayout } from "./hooks";
import { PanelGrid } from "./panels";
import { defaultValues, DuplicatesDialog, ErrorSummary } from "./record-form";
import { LoadingBlock, PageMessage } from "./scope-gate";

export function ConvertView({ scope, id }: { scope: string; id: string }) {
  const ctx = useFieldContext();
  const record = useQuery({
    queryKey: ["record", scope, id],
    queryFn: ({ signal }) => getRecord(scope, id, signal),
    meta: { silent: true },
    retry: false,
  });
  const targets = useMemo(
    () => (ctx ? convertScopes(ctx.metadata, ctx.acl, scope, !!ctx.settings.b2cMode) : []),
    [ctx, scope],
  );
  const attributes = useQuery({
    queryKey: ["convertAttributes", scope, id],
    queryFn: () => postAction<Record<string, Values>>(scope, "getConvertAttributes", { id }),
    enabled: !!ctx && targets.length > 0,
    staleTime: 0,
  });

  if (record.error instanceof EspoApiError) {
    return <PageMessage icon="fas fa-lock" title={ctx?.t(record.error.status === 404 ? "Not found" : "Access denied") ?? ""} />;
  }

  if (!ctx || !record.data || (targets.length > 0 && !attributes.data)) {
    return attributes.error ? <PageMessage icon="fas fa-exclamation-triangle" title={ctx?.t("Error") ?? "Error"} /> : <LoadingBlock />;
  }

  const canEdit = ctx.acl.checkScope(scope, "edit") && ctx.acl.checkRecord(scope, record.data, "edit", { hasField: () => true }) !== false;

  if (!canConvert(ctx.metadata, scope, record.data, canEdit) || !targets.length) {
    return <PageMessage icon="fas fa-lock" title={ctx.t("Access denied")} />;
  }

  return <ConvertContent ctx={ctx} scope={scope} record={record.data} targets={targets} attributes={attributes.data ?? {}} />;
}

type TargetForm = { values: Values; setValues: Dispatch<SetStateAction<Values>>; form: FormState | null };

function ConvertContent({
  ctx,
  scope,
  record,
  targets,
  attributes,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  targets: string[];
  attributes: Record<string, Values>;
}) {
  const { t, metadata } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [checked, setChecked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, Record<string, string>>>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<Record<string, unknown>[] | null>(null);
  const forms: Record<string, TargetForm> = {};

  useEffect(() => {
    document.title = `${t("convert", "labels", scope)} · ${String(record.name ?? "")}`;
  }, [t, scope, record.name]);

  async function convert(skipDuplicateCheck = false) {
    if (!checked.length) {
      toast.errorText(t("selectAtLeastOneRecord", "messages"));

      return;
    }

    const found: Record<string, Record<string, string>> = {};

    for (const target of checked) {
      const result = forms[target]?.form?.validate() ?? {};

      if (Object.keys(result).length) {
        found[target] = result;
      }
    }

    setErrors(found);

    if (Object.keys(found).length) {
      toast.errorText(t("Not valid"));

      return;
    }

    const records = Object.fromEntries(checked.map((target) => [target, forms[target].form!.collectData()]));

    setBusy(true);

    try {
      await postAction(scope, "convert", { id: record.id, records, ...(skipDuplicateCheck ? { skipDuplicateCheck: true } : {}) });
      toast.success(t("Converted", "labels", scope));
      await queryClient.invalidateQueries({ queryKey: ["record", scope, record.id] });
      await queryClient.invalidateQueries({ queryKey: ["stream"] });
      router.push(recordViewHref(scope, record.id, metadata));
    } catch (error) {
      if (error instanceof EspoApiError && error.isDuplicate) {
        setDuplicates(error.list ?? []);
      } else {
        toast.error(error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div>
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
          <Link href={scopeListHref(scope, metadata)} className="hover:text-slate-800 hover:underline">
            {t(scope, "scopeNamesPlural")}
          </Link>
          <span className="mx-1.5" aria-hidden>/</span>
          <Link href={recordViewHref(scope, record.id, metadata)} className="hover:text-slate-800 hover:underline">
            {String(record.name ?? record.id)}
          </Link>
        </nav>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("Convert", "labels", scope)}</h1>
      </div>

      {targets.map((target) => (
        <TargetSection
          key={target}
          ctx={ctx}
          scope={target}
          checked={checked.includes(target)}
          onCheckedChange={(value) => setChecked(value ? [...checked, target] : checked.filter((item) => item !== target))}
          initial={attributes[target] ?? {}}
          errors={errors[target] ?? {}}
          register={(form) => {
            forms[target] = form;
          }}
        />
      ))}

      <div className="flex gap-2">
        <Button variant="primary" onClick={() => void convert()} disabled={busy}>
          {busy && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
          {t("Convert", "labels", scope)}
        </Button>
        <Link
          href={recordViewHref(scope, record.id, metadata)}
          className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
        >
          {t("Cancel")}
        </Link>
      </div>

      <DuplicatesDialog
        ctx={ctx}
        scope={checked[0] ?? scope}
        duplicates={duplicates}
        busy={busy}
        onCancel={() => setDuplicates(null)}
        onConfirm={() => {
          setDuplicates(null);
          void convert(true);
        }}
      />
    </div>
  );
}

/** Một entity sẽ tạo: ô chọn + form theo layout `detailConvert`. Form vẫn giữ trạng thái khi bỏ chọn. */
function TargetSection({
  ctx,
  scope,
  checked,
  onCheckedChange,
  initial,
  errors,
  register,
}: {
  ctx: FieldContext;
  scope: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  initial: Values;
  errors: Record<string, string>;
  register: (form: TargetForm) => void;
}) {
  const layout = useLayout<DetailLayoutPanel[]>(scope, "detailConvert", { fallback: "detail" });
  const [values, setValues] = useState<Values>(() =>
    initNewValues(getEntityDefs(ctx.metadata, scope).fields ?? {}, { ...defaultValues(ctx, scope), ...initial }),
  );
  const baseId = useId();
  const panels = useMemo(
    () => (layout.data ? buildDetailPanels(layout.data, { scope, metadata: ctx.metadata, acl: ctx.acl, t: ctx.t }) : []),
    [layout.data, scope, ctx.metadata, ctx.acl, ctx.t],
  );
  const fields = useMemo(() => detailFieldNames(panels), [panels]);
  const form = useFormFields({ ctx, scope, fields, values, saved: null });

  register({ values, setValues, form: layout.data ? form : null });

  return (
    <section className="flex flex-col gap-3">
      <label className="inline-flex w-fit cursor-pointer items-center gap-2.5 text-lg font-semibold text-slate-800">
        <input type="checkbox" className="size-5 accent-blue-600" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
        {ctx.t(scope, "scopeNames")}
      </label>
      {checked &&
        (layout.data ? (
          <>
            <ErrorSummary errors={errors} />
            <PanelGrid
              panels={panels}
              t={ctx.t}
              isFieldVisible={form.isVisible}
              isPanelVisible={(panel) => form.logic.panels[panel.name]?.visible !== false}
              renderCell={(cell) => (
                <FormFieldCell
                  ctx={ctx}
                  scope={scope}
                  name={cell.name}
                  label={cell.label}
                  noLabel={cell.noLabel}
                  values={values}
                  setValues={setValues}
                  errors={errors}
                  form={form}
                  inputId={`${baseId}-${cell.name}`}
                />
              )}
            />
          </>
        ) : (
          <LoadingBlock />
        ))}
    </section>
  );
}
