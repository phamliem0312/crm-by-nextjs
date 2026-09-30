// Thông tin field/attribute của entity. Port từ `field-manager` của UI classic (espo-main.js @11295).
import type { Metadata } from "./types";

/** `metadata.fields[<type>]`: định nghĩa chung của một loại field. */
export type FieldTypeDefs = {
  actualFields?: string[];
  notActualFields?: string[];
  naming?: "suffix" | "prefix";
  filter?: boolean;
  notSortable?: boolean;
  textFilter?: boolean;
  fields?: Record<string, FieldDefs>;
  [key: string]: unknown;
};

/** `entityDefs.<Scope>.fields.<field>`. */
export type FieldDefs = {
  type: string;
  required?: boolean;
  readOnly?: boolean;
  readOnlyAfterCreate?: boolean;
  disabled?: boolean;
  utility?: boolean;
  notStorable?: boolean;
  layoutListDisabled?: boolean;
  layoutDetailDisabled?: boolean;
  orderDisabled?: boolean;
  options?: string[];
  translation?: string;
  default?: unknown;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  entity?: string;
  entityList?: string[];
  link?: string;
  field?: string;
  view?: string;
  style?: Record<string, string>;
  displayAsLabel?: boolean;
  decimalPlaces?: number;
  additionalAttributeList?: string[];
  fullNameAdditionalAttributeList?: string[];
  inlineEditDisabled?: boolean;
  [key: string]: unknown;
};

export type LinkDefs = {
  type: "belongsTo" | "hasMany" | "hasOne" | "belongsToParent" | "hasChildren" | "manyMany" | string;
  entity?: string;
  foreign?: string;
  disabled?: boolean;
  utility?: boolean;
  [key: string]: unknown;
};

export type EntityDefs = {
  fields?: Record<string, FieldDefs>;
  links?: Record<string, LinkDefs>;
  collection?: { orderBy?: string; order?: "asc" | "desc"; textFilterFields?: string[] };
  [key: string]: unknown;
};

const upperFirst = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function fieldTypeDefs(metadata: Metadata, type: string): FieldTypeDefs | undefined {
  return (metadata.fields as Record<string, FieldTypeDefs> | undefined)?.[type];
}

export function getEntityDefs(metadata: Metadata, scope: string): EntityDefs {
  return ((metadata.entityDefs as Record<string, EntityDefs> | undefined)?.[scope] ?? {}) as EntityDefs;
}

export function getFieldDefs(metadata: Metadata, scope: string, field: string): FieldDefs | undefined {
  return getEntityDefs(metadata, scope).fields?.[field];
}

export function getFieldType(metadata: Metadata, scope: string, field: string): string | undefined {
  return getFieldDefs(metadata, scope, field)?.type;
}

/** Attribute "thật" của một field, ví dụ `accountId` (link), `billingAddressCity` (address). */
export function getActualAttributeList(metadata: Metadata, type: string, field: string): string[] {
  const defs = fieldTypeDefs(metadata, type);

  if (!defs) {
    return [];
  }

  if (!defs.actualFields) {
    return [field];
  }

  return defs.actualFields.map((part) =>
    defs.naming === "prefix" ? part + upperFirst(field) : field + upperFirst(part),
  );
}

/** Attribute chỉ để hiển thị, ví dụ `accountName`. */
export function getNotActualAttributeList(metadata: Metadata, type: string, field: string): string[] {
  const defs = fieldTypeDefs(metadata, type);

  if (!defs?.notActualFields) {
    return [];
  }

  return defs.notActualFields.map((part) => {
    if (defs.naming === "prefix") {
      return part === "" ? field : part + upperFirst(field);
    }

    return field + upperFirst(part);
  });
}

function union(...lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

export function getAttributeList(metadata: Metadata, type: string, field: string): string[] {
  return union(getActualAttributeList(metadata, type, field), getNotActualAttributeList(metadata, type, field));
}

function additionalAttributes(metadata: Metadata, scope: string, field: string): string[] {
  const defs = getFieldDefs(metadata, scope, field);

  if (!defs) {
    return [];
  }

  const isPrefix = fieldTypeDefs(metadata, defs.type)?.naming === "prefix";
  const additional = (defs.additionalAttributeList ?? []).map((part) =>
    isPrefix ? part + upperFirst(field) : field + upperFirst(part),
  );

  return union(additional, defs.fullNameAdditionalAttributeList ?? []);
}

/** Mọi attribute của một field trong một entity (kể cả attribute bổ sung). */
export function getFieldAttributeList(metadata: Metadata, scope: string, field: string): string[] {
  const type = getFieldType(metadata, scope, field);

  return type ? union(getAttributeList(metadata, type, field), additionalAttributes(metadata, scope, field)) : [];
}

export function getFieldActualAttributeList(metadata: Metadata, scope: string, field: string): string[] {
  const type = getFieldType(metadata, scope, field);

  return type ? union(getActualAttributeList(metadata, type, field), additionalAttributes(metadata, scope, field)) : [];
}

/** Field không bị tắt, không phải utility, không bị ẩn bởi entityAcl. Port `isEntityTypeFieldAvailable`. */
export function isFieldAvailable(metadata: Metadata, scope: string, field: string): boolean {
  const defs = getFieldDefs(metadata, scope, field);

  if (!defs || defs.disabled || defs.utility) {
    return false;
  }

  const aclDefs = (metadata.entityAcl as Record<string, { fields?: Record<string, Record<string, boolean>> }> | undefined)?.[
    scope
  ]?.fields?.[field];

  return !(aclDefs?.onlyAdmin || aclDefs?.forbidden || aclDefs?.internal);
}

/** Field có sắp xếp được không (loại field `notSortable`, hoặc `orderDisabled`/`notStorable`). */
export function isFieldSortable(metadata: Metadata, scope: string, field: string): boolean {
  const defs = getFieldDefs(metadata, scope, field);

  if (!defs || defs.orderDisabled || defs.notStorable) {
    return false;
  }

  return !fieldTypeDefs(metadata, defs.type)?.notSortable;
}

/** Field có bộ lọc nâng cao không (`metadata.fields[type].filter`). */
export function isFieldFilterable(metadata: Metadata, type: string): boolean {
  return !!fieldTypeDefs(metadata, type)?.filter;
}

/** Danh sách attribute cần `select` để hiển thị các field (luôn có `id`). */
export function getSelectAttributes(metadata: Metadata, scope: string, fields: string[]): string[] {
  return union(["id"], ...fields.map((field) => getFieldAttributeList(metadata, scope, field)));
}

/** Link của một field link/linkMultiple → entity đích. */
export function getLinkEntity(metadata: Metadata, scope: string, link: string): string | undefined {
  return getEntityDefs(metadata, scope).links?.[link]?.entity;
}
