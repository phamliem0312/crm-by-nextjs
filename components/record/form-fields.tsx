"use client";

// Phần dùng chung của form sửa/tạo (RecordForm, chuyển đổi Lead): dynamic logic, quyền sửa từng field,
// validate, gom attribute để lưu và render ô nhập.
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { applyFormChange, extraSaveAttributes, FieldValue, getFieldType, prepareValuesForSave } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { evaluateLogic, type LogicDefs } from "@/lib/espo/dynamic-logic";
import { getFieldActualAttributeList, getFieldDefs } from "@/lib/espo/entity";
import { validateFields } from "@/lib/espo/validation";
import { FieldCell } from "./panels";

export type FormState = ReturnType<typeof useFormFields>;

export function useFormFields({
  ctx,
  scope,
  fields,
  values,
  saved,
}: {
  ctx: FieldContext;
  scope: string;
  fields: string[];
  values: Values;
  saved: Values | null;
}) {
  const { metadata, acl, t } = ctx;
  const isNew = !saved;
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

  const isVisible = (field: string) => logic.fields[field]?.visible !== false;
  const isRequired = (field: string) => logic.fields[field]?.required ?? !!getFieldDefs(metadata, scope, field)?.required;
  const isReadOnly = (field: string) => {
    const defs = getFieldDefs(metadata, scope, field);

    return (
      !defs ||
      !!defs.readOnly ||
      !!defs.clientReadOnly ||
      (!isNew && !!defs.readOnlyAfterCreate) ||
      logic.fields[field]?.readOnly === true ||
      !acl.checkField(scope, field, "edit") ||
      !getFieldType(defs).Edit
    );
  };
  const editableFields = fields.filter((field) => isVisible(field) && !isReadOnly(field));

  /** Lỗi theo field (rỗng = hợp lệ). */
  const validate = () => validateFields(editableFields, values, { scope, metadata, t, isRequired: (field) => isRequired(field) });

  /**
   * Attribute gửi lên server: attribute "thật" của field sửa được (và attribute field đó điều khiển, ví dụ
   * duration → dateEnd). Bản ghi mới gửi kèm mọi attribute khác đã có (createAttributeMap, setRelate…).
   */
  const collectData = (): Values => {
    const prepared = prepareValuesForSave(
      editableFields.map((name) => ({ name, defs: getFieldDefs(metadata, scope, name)! })),
      values,
    );
    const data: Values = {};

    for (const field of editableFields) {
      const defs = getFieldDefs(metadata, scope, field)!;

      for (const attribute of [...getFieldActualAttributeList(metadata, scope, field), ...extraSaveAttributes(field, defs)]) {
        // Attribute chưa từng có giá trị thì không gửi (server dùng mặc định); gửi null cho linkMultiple
        // (`usersIds` của Meeting) bị server từ chối.
        if (prepared[attribute] !== undefined) {
          data[attribute] = prepared[attribute];
        }
      }
    }

    if (isNew) {
      for (const [key, value] of Object.entries(values)) {
        if (!(key in data) && value !== undefined) {
          data[key] = value;
        }
      }
    }

    return data;
  };

  return { formFields, logic, isVisible, isRequired, isReadOnly, editableFields, validate, collectData };
}

/** Một ô của form: chỉ đọc (hiển thị) hoặc ô nhập theo loại field. */
export function FormFieldCell({
  ctx,
  scope,
  name,
  label,
  noLabel = false,
  values,
  setValues,
  errors,
  form,
  inputId,
}: {
  ctx: FieldContext;
  scope: string;
  name: string;
  label: string;
  noLabel?: boolean;
  values: Values;
  setValues: Dispatch<SetStateAction<Values>>;
  errors: Record<string, string>;
  form: FormState;
  inputId: string;
}) {
  const defs = getFieldDefs(ctx.metadata, scope, name)!;
  const error = errors[name];

  if (form.isReadOnly(name)) {
    return (
      <FieldCell label={label} noLabel={noLabel}>
        <FieldValue ctx={ctx} scope={scope} name={name} defs={defs} values={values} mode="detail" />
      </FieldCell>
    );
  }

  const Edit = getFieldType(defs).Edit!;

  return (
    <FieldCell label={label} htmlFor={inputId} noLabel={noLabel} required={form.isRequired(name)} error={error} errorId={`${inputId}-error`}>
      <Edit
        ctx={ctx}
        scope={scope}
        name={name}
        defs={defs}
        values={values}
        onChange={(patch) => setValues((current) => applyFormChange(form.formFields, current, { ...current, ...patch }))}
        inputId={inputId}
        invalid={!!error}
        required={form.isRequired(name)}
        optionList={form.logic.options[name]}
        describedBy={error ? `${inputId}-error` : undefined}
      />
    </FieldCell>
  );
}
