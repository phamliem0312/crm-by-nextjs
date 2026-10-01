"use client";

// Cập nhật hàng loạt: chọn field (layout `massUpdate`), nhập giá trị, gửi `MassAction` action `update`.
import { useId, useState } from "react";
import { getFieldType, prepareValuesForSave } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { Select } from "@/components/fields/ui";
import { toast } from "@/components/ui/toaster";
import { Button, Dialog } from "@/components/ui/dialog";
import { getFieldActualAttributeList, getFieldDefs, isFieldAvailable } from "@/lib/espo/entity";
import { interpolate } from "@/lib/espo/i18n";
import { massAction } from "@/lib/espo/records";
import { validateFields } from "@/lib/espo/validation";

export function MassUpdateDialog({
  ctx,
  scope,
  ids,
  fields,
  open,
  onClose,
  onDone,
}: {
  ctx: FieldContext;
  scope: string;
  ids: string[];
  /** Layout `massUpdate`. */
  fields: string[];
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t } = ctx;
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const baseId = useId();

  const available = fields.filter((field) => {
    const defs = getFieldDefs(ctx.metadata, scope, field);

    return (
      !!defs &&
      !defs.readOnly &&
      isFieldAvailable(ctx.metadata, scope, field) &&
      ctx.acl.checkField(scope, field, "edit") &&
      !!getFieldType(defs).Edit
    );
  });

  async function submit() {
    const found = validateFields(selected, values, { scope, metadata: ctx.metadata, t });

    setErrors(found);

    if (Object.keys(found).length) {
      return;
    }

    const prepared = prepareValuesForSave(
      selected.map((name) => ({ name, defs: getFieldDefs(ctx.metadata, scope, name) ?? { type: "" } })),
      values,
    );
    const data: Values = {};

    for (const field of selected) {
      for (const attribute of getFieldActualAttributeList(ctx.metadata, scope, field)) {
        data[attribute] = prepared[attribute] ?? null;
      }
    }

    setBusy(true);

    try {
      const result = await massAction(scope, "update", ids, data);

      toast.success(interpolate(t("massUpdateResult", "messages"), { count: result?.count ?? ids.length }));
      onDone();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("Mass Update")}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || !selected.length}>
            {t("Update")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          aria-label={t("Add Field")}
          value=""
          onChange={(event) => event.target.value && setSelected([...selected, event.target.value])}
        >
          <option value="">{t("Add Field")}</option>
          {available
            .filter((field) => !selected.includes(field))
            .map((field) => (
              <option key={field} value={field}>
                {t(field, "fields", scope)}
              </option>
            ))}
        </Select>

        {selected.map((field) => {
          const defs = getFieldDefs(ctx.metadata, scope, field);
          const Edit = defs ? getFieldType(defs).Edit : undefined;
          const inputId = `${baseId}-${field}`;

          if (!defs || !Edit) {
            return null;
          }

          return (
            <div key={field} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor={inputId} className="text-[13px] font-medium text-slate-700">
                  {t(field, "fields", scope)}
                </label>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  aria-label={`${t("Remove")}: ${t(field, "fields", scope)}`}
                  onClick={() => setSelected(selected.filter((item) => item !== field))}
                >
                  <i className="fas fa-times text-xs" aria-hidden />
                </button>
              </div>
              <Edit
                ctx={ctx}
                scope={scope}
                name={field}
                defs={defs}
                values={values}
                onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
                inputId={inputId}
                invalid={!!errors[field]}
                required={false}
                describedBy={errors[field] ? `${inputId}-error` : undefined}
              />
              {errors[field] && (
                <p id={`${inputId}-error`} className="text-xs text-red-600">
                  {errors[field]}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
