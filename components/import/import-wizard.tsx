"use client";

// Nhập dữ liệu (`/Import`): bước 1 chọn entity, file CSV, cách làm (tạo/cập nhật) và tham số đọc file (xem trước 3 dòng);
// bước 2 ghép cột với field, chọn cột để tìm bản ghi cần cập nhật, giá trị mặc định, rồi chạy.
// Tương đương `views/import/index` + `step1` + `step2` của classic.
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getFieldType } from "@/components/fields/registry";
import type { FieldContext, Values } from "@/components/fields/types";
import { Checkbox, IconButton, Select, TextInput, XIcon } from "@/components/fields/ui";
import { useFieldContext } from "@/components/fields/use-field-context";
import { FieldCell } from "@/components/record/panels";
import { ErrorSummary } from "@/components/record/record-form";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { Button, Dialog } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { getFieldActualAttributeList, getFieldDefs } from "@/lib/espo/entity";
import {
  csvToArray,
  defaultImportParams,
  DELIMITERS,
  formatSample,
  guessAttribute,
  importableScopes,
  importAttributeLabel,
  importAttributeList,
  importFieldList,
  IMPORT_PARAM_KEYS,
  mappingRows,
  personNameFormats,
  runImport,
  saveImportDefaults,
  uploadImportFile,
  type ImportParams,
} from "@/lib/espo/import";
import { validateFields } from "@/lib/espo/validation";

/** Mẫu "New import with same params" (trang kết quả lưu vào đây rồi mở `/Import`). */
export const SAME_PARAMS_KEY = "espo-next-import-same-params";

type MappingState = {
  /** Attribute của từng cột (`null` = bỏ qua). */
  attributeList: (string | null)[];
  /** Chỉ số cột dùng để tìm bản ghi cập nhật. */
  updateBy: number[];
  defaultFieldList: string[];
  defaultValues: Values;
};

type SavedForm = Partial<ImportParams> & { attributeList?: (string | null)[]; updateBy?: number[]; defaultValues?: Values; defaultFieldList?: string[] };

function readSavedForm(): SavedForm | null {
  try {
    const value = sessionStorage.getItem(SAME_PARAMS_KEY);

    return value ? (JSON.parse(value) as SavedForm) : null;
  } catch {
    return null;
  }
}

export function ImportWizard() {
  const ctx = useFieldContext();

  if (!ctx) {
    return <LoadingBlock />;
  }

  if (!ctx.acl.checkScope("Import")) {
    return <PageMessage icon="fas fa-lock" title={ctx.t("Access denied")} />;
  }

  return <WizardContent ctx={ctx} />;
}

function WizardContent({ ctx }: { ctx: FieldContext }) {
  const { t, settings, preferences } = ctx;
  const [saved] = useState(readSavedForm);
  const [step, setStep] = useState<1 | 2>(1);
  const [params, setParams] = useState<ImportParams>(() => ({ ...defaultImportParams(settings, preferences), ...(saved ?? {}) }) as ImportParams);
  const [file, setFile] = useState<{ name: string; contents: string; preview: string } | null>(null);
  const [mapping, setMapping] = useState<MappingState | null>(() =>
    saved?.attributeList
      ? {
          attributeList: saved.attributeList,
          updateBy: saved.updateBy ?? [],
          defaultFieldList: saved.defaultFieldList ?? [],
          defaultValues: saved.defaultValues ?? {},
        }
      : null,
  );

  // Mẫu chỉ dùng một lần (đọc ở trên, xoá sau khi đã mở trang).
  useEffect(() => {
    try {
      sessionStorage.removeItem(SAME_PARAMS_KEY);
    } catch {
      // Không có sessionStorage: không có gì để xoá.
    }
  }, []);

  useEffect(() => {
    document.title = `${t("Import", "scopeNames")} · ${settings.applicationName || "EspoCRM"}`;
  }, [t, settings.applicationName]);

  const preview = useMemo(() => (file ? csvToArray(file.preview, params.delimiter, params.textQualifier) : []), [file, params.delimiter, params.textQualifier]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("Import", "scopeNames")}</h1>
          <ol className="mt-1 flex gap-2 text-sm text-slate-500" aria-label={t("Import", "scopeNames")}>
            {([1, 2] as const).map((item) => (
              <li key={item} aria-current={step === item ? "step" : undefined} className={step === item ? "font-medium text-blue-700" : ""}>
                {t(`Step ${item}`, "labels", "Import")}
                {item === 1 ? <span className="mx-2 text-slate-300">›</span> : null}
              </li>
            ))}
          </ol>
        </div>
        <Link
          href="/Import/list"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-xs hover:bg-slate-50"
        >
          <i className="fas fa-list text-xs" aria-hidden />
          {t("Import Results", "labels", "Import")}
        </Link>
      </div>

      {step === 1 ? (
        <StepOne
          ctx={ctx}
          params={params}
          onParams={(next) => {
            // Đổi entity/cách làm → ghép cột lại từ đầu.
            if (next.entityType !== params.entityType || next.action !== params.action) {
              setMapping((current) => (current && next.entityType === params.entityType ? { ...current, updateBy: [] } : null));
            }

            setParams(next);
          }}
          file={file}
          onFile={setFile}
          preview={preview}
          onNext={() => setStep(2)}
        />
      ) : (
        <StepTwo
          ctx={ctx}
          params={params}
          preview={preview}
          contents={file?.contents ?? ""}
          mapping={mapping}
          onMapping={setMapping}
          onBack={() => setStep(1)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
      <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-800">{title}</h2>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function StepOne({
  ctx,
  params,
  onParams,
  file,
  onFile,
  preview,
  onNext,
}: {
  ctx: FieldContext;
  params: ImportParams;
  onParams: (params: ImportParams) => void;
  file: { name: string; contents: string; preview: string } | null;
  onFile: (file: { name: string; contents: string; preview: string }) => void;
  preview: string[][];
  onNext: () => void;
}) {
  const { t, metadata, acl, settings, user, preferences } = ctx;
  const baseId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paramsChanged, setParamsChanged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopes = useMemo(() => importableScopes(metadata, acl, t), [metadata, acl, t]);
  const importDefs = (metadata.clientDefs?.Import ?? {}) as { dateFormatList?: string[]; timeFormatList?: string[] };
  const timeZones = Array.isArray(ctx.appParams.timeZoneList) ? (ctx.appParams.timeZoneList as string[]) : ["UTC"];
  const currencies = Array.isArray(settings.currencyList) ? (settings.currencyList as string[]) : [];
  const id = (name: string) => `${baseId}-${name}`;

  const set = <K extends keyof ImportParams>(key: K, value: ImportParams[K]) => {
    onParams({ ...params, [key]: value });

    if ((IMPORT_PARAM_KEYS as readonly string[]).includes(key)) {
      setParamsChanged(true);
    }
  };

  async function readFile(selected: File) {
    try {
      const [contents, head] = await Promise.all([selected.text(), selected.slice(0, 1024 * 512).text()]);

      onFile({ name: selected.name, contents, preview: head });
    } catch (e) {
      toast.error(e);
    }
  }

  async function saveDefaults() {
    try {
      await saveImportDefaults(user.id, preferences, params);
      toast.success(t("Saved"));
      setParamsChanged(false);
    } catch (e) {
      toast.error(e);
    }
  }

  function next() {
    if (!params.entityType) {
      setError(t("fieldIsRequired", "messages").replace("{field}", t("Entity Type", "labels", "Import")));
      document.getElementById(id("entityType"))?.focus();

      return;
    }

    if (!params.decimalMark) {
      setError(t("fieldIsRequired", "messages").replace("{field}", t("Decimal Mark", "labels", "Import")));

      return;
    }

    setError(null);
    onNext();
  }

  const select = (name: keyof ImportParams, label: string, options: { value: string; label: string }[]) => (
    <FieldCell label={label} htmlFor={id(name)}>
      <Select id={id(name)} value={String(params[name] ?? "")} onChange={(event) => set(name, event.target.value as never)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldCell>
  );

  return (
    <div className="flex flex-col gap-5">
      {error && <ErrorSummary errors={{ form: error }} />}

      <Section title={t("What to Import?", "labels", "Import")}>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldCell label={t("Entity Type", "labels", "Import")} htmlFor={id("entityType")} required>
            <Select id={id("entityType")} value={params.entityType ?? ""} onChange={(event) => set("entityType", event.target.value || null)}>
              <option value="" />
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {t(scope, "scopeNamesPlural")}
                </option>
              ))}
            </Select>
          </FieldCell>
          <FieldCell label={t("File (CSV)", "labels", "Import")} htmlFor={id("file")}>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                id={id("file")}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  const selected = event.target.files?.[0];

                  event.target.value = "";

                  if (selected) {
                    void readFile(selected);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <i className="fas fa-file-csv text-xs" aria-hidden />
                {t("Select")}
              </button>
              <span className="text-sm text-slate-600">{file ? file.name : <span className="text-slate-400">{t("utf8", "messages", "Import")}</span>}</span>
            </div>
          </FieldCell>
          {select("action", t("What to do?", "labels", "Import"), [
            { value: "create", label: t("Create Only", "labels", "Import") },
            { value: "createAndUpdate", label: t("Create and Update", "labels", "Import") },
            { value: "update", label: t("Update Only", "labels", "Import") },
          ])}
        </div>
      </Section>

      <Section title={t("Parameters", "labels", "Import")}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-end">
            <Checkbox label={t("Header Row", "labels", "Import")} checked={params.headerRow} onChange={(event) => set("headerRow", event.target.checked)} />
          </div>
          {select(
            "delimiter",
            t("Field Delimiter", "labels", "Import"),
            DELIMITERS.map((value) => ({ value, label: value })),
          )}
          {select("textQualifier", t("Text Qualifier", "labels", "Import"), [
            { value: '"', label: t("Double Quote", "labels", "Import") },
            { value: "'", label: t("Single Quote", "labels", "Import") },
          ])}
          {select(
            "dateFormat",
            t("Date Format", "labels", "Import"),
            (importDefs.dateFormatList ?? ["YYYY-MM-DD"]).map((value) => ({ value, label: formatSample(value) })),
          )}
          {select(
            "timeFormat",
            t("Time Format", "labels", "Import"),
            (importDefs.timeFormatList ?? ["HH:mm:ss"]).map((value) => ({ value, label: formatSample(value) })),
          )}
          <FieldCell label={t("Decimal Mark", "labels", "Import")} htmlFor={id("decimalMark")} required>
            <TextInput id={id("decimalMark")} maxLength={1} className="w-20" value={params.decimalMark} onChange={(event) => set("decimalMark", event.target.value)} />
          </FieldCell>
          {select(
            "personNameFormat",
            t("Person Name Format", "labels", "Import"),
            personNameFormats(settings).map((value) => ({ value, label: t.option(value, "personNameFormat", "Import") })),
          )}
          {currencies.length > 0 &&
            select(
              "currency",
              t("Currency", "labels", "Import"),
              currencies.map((value) => ({ value, label: value })),
            )}
          {select(
            "timezone",
            t("Timezone", "labels", "Import"),
            timeZones.map((value) => ({ value, label: value })),
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
          <Checkbox
            label={
              <span title={t("silentMode", "tooltips", "Import")}>
                {t("Silent Mode", "labels", "Import")}
                <span className="ml-2 text-xs text-slate-400">{t("silentMode", "tooltips", "Import")}</span>
              </span>
            }
            checked={params.silentMode}
            onChange={(event) => set("silentMode", event.target.checked)}
          />
          {!params.manualMode && (
            <Checkbox label={t("inIdle", "messages", "Import")} checked={params.idleMode} onChange={(event) => set("idleMode", event.target.checked)} />
          )}
          <Checkbox
            label={t("Skip searching for duplicates", "labels", "Import")}
            checked={params.skipDuplicateChecking}
            onChange={(event) => set("skipDuplicateChecking", event.target.checked)}
          />
          {!params.idleMode && (
            <Checkbox
              label={
                <span>
                  {t("Run Manually", "labels", "Import")}
                  <span className="ml-2 text-xs text-slate-400">{t("manualMode", "tooltips", "Import")}</span>
                </span>
              }
              checked={params.manualMode}
              onChange={(event) => set("manualMode", event.target.checked)}
            />
          )}
        </div>
        {paramsChanged && (
          <div className="mt-4">
            <Button onClick={() => void saveDefaults()}>{t("saveAsDefault", "strings", "Import")}</Button>
          </div>
        )}
      </Section>

      {preview.length > 0 && (
        <Section title={t("Preview", "labels", "Import")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {preview.slice(0, 3).map((row, index) => (
                  <tr key={index} className={index === 0 && params.headerRow ? "bg-slate-50 font-medium" : ""}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="max-w-48 truncate border-r border-slate-100 px-2 py-1.5 last:border-r-0">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="flex justify-end">
        <Button variant="primary" disabled={!file} onClick={next}>
          {t("Next", "labels", "Import")}
          <i className="fas fa-arrow-right text-xs" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function StepTwo({
  ctx,
  params,
  preview,
  contents,
  mapping,
  onMapping,
  onBack,
}: {
  ctx: FieldContext;
  params: ImportParams;
  preview: string[][];
  contents: string;
  mapping: MappingState | null;
  onMapping: (mapping: MappingState) => void;
  onBack: () => void;
}) {
  const { t, metadata, acl } = ctx;
  const router = useRouter();
  const queryClient = useQueryClient();
  const baseId = useId();
  const scope = params.entityType!;
  const rows = useMemo(() => mappingRows(preview, params.headerRow), [preview, params.headerRow]);
  const attributes = useMemo(() => importAttributeList(metadata, scope, acl, t), [metadata, scope, acl, t]);
  const fieldList = useMemo(() => importFieldList(metadata, scope, acl, t), [metadata, scope, acl, t]);
  const withUpdate = params.action === "update" || params.action === "createAndUpdate";
  const [state, setState] = useState<MappingState>(() => {
    const attributeList = rows.map((row, index) =>
      mapping?.attributeList && mapping.attributeList.length === rows.length ? (mapping.attributeList[index] ?? null) : guessAttribute(row.header ?? undefined, attributes),
    );

    return {
      attributeList,
      updateBy: mapping?.updateBy.length ? mapping.updateBy : rows.flatMap((row, index) => (row.header === "id" ? [index] : [])),
      defaultFieldList: mapping?.defaultFieldList ?? [],
      defaultValues: mapping?.defaultValues ?? {},
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [manual, setManual] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  const update = (patch: Partial<MappingState>) => {
    const next = { ...state, ...patch };

    setState(next);
    onMapping(next);
  };

  function collectDefaults(): Values {
    const values: Values = {};

    for (const field of state.defaultFieldList) {
      for (const attribute of getFieldActualAttributeList(metadata, scope, field)) {
        if (state.defaultValues[attribute] !== undefined) {
          values[attribute] = state.defaultValues[attribute];
        }
      }
    }

    return values;
  }

  async function run() {
    const found = validateFields(state.defaultFieldList, state.defaultValues, { scope, metadata, t, isRequired: () => false });

    setErrors(found);

    if (Object.keys(found).length) {
      return;
    }

    setRunning(true);
    toast.info(t("importRunning", "messages", "Import"));

    try {
      const attachmentId = await uploadImportFile(contents);
      const result = await runImport(
        {
          ...params,
          attributeList: state.attributeList.map((item) => item ?? ""),
          ...(withUpdate ? { updateBy: state.updateBy } : {}),
          defaultValues: collectDefaults(),
          defaultFieldList: state.defaultFieldList,
        },
        attachmentId,
      );

      await queryClient.invalidateQueries({ queryKey: ["recordList", "Import"] });

      if (params.manualMode) {
        setManual(result.id);

        return;
      }

      router.push(`/Import/${encodeURIComponent(result.id)}`);
    } catch (error) {
      toast.error(error);
      setRunning(false);
    }
  }

  const available = fieldList.filter((field) => !state.defaultFieldList.includes(field) && getFieldDefs(metadata, scope, field) && getFieldType(getFieldDefs(metadata, scope, field)).Edit);

  return (
    <div className="flex flex-col gap-5">
      <ErrorSummary errors={errors} />

      <Section title={t("Field Mapping", "labels", "Import")}>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                {params.headerRow && <th className="w-1/4 px-2 py-2">{t("Header Row Value", "labels", "Import")}</th>}
                <th className="w-1/3 px-2 py-2">{t("Field", "labels", "Import")}</th>
                <th className="px-2 py-2">{t("First Row Value", "labels", "Import")}</th>
                {withUpdate && <th className="w-24 px-2 py-2">{t("Update by", "labels", "Import")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={index}>
                  {params.headerRow && <td className="truncate px-2 py-1.5 text-slate-700">{row.header}</td>}
                  <td className="px-2 py-1.5">
                    <Select
                      id={`${baseId}-column-${index}`}
                      aria-label={`${t("Field", "labels", "Import")}: ${row.header ?? index + 1}`}
                      value={state.attributeList[index] ?? ""}
                      onChange={(event) => {
                        const attributeList = [...state.attributeList];

                        attributeList[index] = event.target.value || null;
                        update({ attributeList });
                      }}
                    >
                      <option value="">-{t("Skip", "labels", "Import")}-</option>
                      {attributes.map((attribute) => (
                        <option key={attribute} value={attribute}>
                          {importAttributeLabel(attribute, scope, metadata, t)}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="truncate px-2 py-1.5 text-slate-600" title={row.value}>
                    {row.value.length > 200 ? `${row.value.slice(0, 200)}...` : row.value}
                  </td>
                  {withUpdate && (
                    <td className="px-2 py-1.5">
                      <input
                        type="checkbox"
                        className="size-4 accent-blue-600"
                        aria-label={`${t("Update by", "labels", "Import")}: ${row.header ?? index + 1}`}
                        checked={state.updateBy.includes(index)}
                        onChange={(event) =>
                          update({ updateBy: event.target.checked ? [...state.updateBy, index] : state.updateBy.filter((item) => item !== index) })
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t("Default Values", "labels", "Import")}>
        <div className="flex flex-col gap-4">
          {state.defaultFieldList.map((field) => {
            const defs = getFieldDefs(metadata, scope, field);
            const Edit = defs ? getFieldType(defs).Edit : undefined;

            if (!defs || !Edit) {
              return null;
            }

            const inputId = `${baseId}-default-${field}`;

            return (
              <div key={field} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <FieldCell label={t(field, "fields", scope)} htmlFor={inputId} error={errors[field]} errorId={`${inputId}-error`}>
                    <Edit
                      ctx={ctx}
                      scope={scope}
                      name={field}
                      defs={defs}
                      values={state.defaultValues}
                      onChange={(patch) => update({ defaultValues: { ...state.defaultValues, ...patch } })}
                      inputId={inputId}
                      invalid={!!errors[field]}
                      required={false}
                    />
                  </FieldCell>
                </div>
                <IconButton label={`${t("Remove")}: ${t(field, "fields", scope)}`} onClick={() => update({ defaultFieldList: state.defaultFieldList.filter((item) => item !== field) })}>
                  <XIcon />
                </IconButton>
              </div>
            );
          })}
          <div className="flex max-w-md items-center gap-2">
            <Select aria-label={t("Add Field", "labels", "Import")} value={adding} onChange={(event) => setAdding(event.target.value)}>
              <option value="">{t("Add Field", "labels", "Import")}…</option>
              {available.map((field) => (
                <option key={field} value={field}>
                  {t(field, "fields", scope)}
                </option>
              ))}
            </Select>
            <Button
              disabled={!adding}
              onClick={() => {
                update({ defaultFieldList: [...state.defaultFieldList, adding] });
                setAdding("");
              }}
            >
              <i className="fas fa-plus text-xs" aria-hidden />
              {t("Add")}
            </Button>
          </div>
        </div>
      </Section>

      <div className="flex justify-between">
        <Button onClick={onBack} disabled={running}>
          <i className="fas fa-arrow-left text-xs" aria-hidden />
          {t("Back", "labels", "Import")}
        </Button>
        <Button variant="danger" onClick={() => void run()} disabled={running}>
          {running && <i className="fas fa-circle-notch fa-spin text-xs" aria-hidden />}
          {t("Run Import", "labels", "Import")}
        </Button>
      </div>

      <Dialog
        open={!!manual}
        onClose={() => manual && router.push(`/Import/${encodeURIComponent(manual)}`)}
        title={t("Run Manually", "labels", "Import")}
        footer={
          <Button variant="primary" onClick={() => manual && router.push(`/Import/${encodeURIComponent(manual)}`)}>
            {t("Close")}
          </Button>
        }
      >
        <p>{t("commandToRun", "strings", "Import")}:</p>
        <pre className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-sm">php command.php import --id={manual}</pre>
      </Dialog>
    </div>
  );
}
