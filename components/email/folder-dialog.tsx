"use client";

// Hộp "Move to Folder" (`views/email-folder/modals/select-folder`).
import type { FieldContext } from "@/components/fields/types";
import { Button, Dialog } from "@/components/ui/dialog";
import { moveFolderOptions } from "@/lib/espo/email";
import { useEmailFolders } from "./hooks";

export function MoveFolderDialog({
  ctx,
  params,
  onSelect,
  onClose,
}: {
  ctx: FieldContext;
  params: { isGroup: boolean; noArchive: boolean; currentFolderId: string | null } | null;
  onSelect: (folderId: string) => void;
  onClose: () => void;
}) {
  const { t } = ctx;
  const folders = useEmailFolders(!!params);
  const options = params && folders.data ? moveFolderOptions(folders.data, params, t) : [];

  return (
    <Dialog
      open={!!params}
      onClose={onClose}
      title={t("Move to Folder", "labels", "Email")}
      size="sm"
      footer={<Button onClick={onClose}>{t("Cancel")}</Button>}
    >
      {folders.isLoading ? (
        <p className="text-slate-500">{t("Loading...")}</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label={t("Move to Folder", "labels", "Email")}>
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                disabled={option.disabled}
                onClick={() => onSelect(option.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <i className={`${option.icon} w-4 text-center text-slate-400`} aria-hidden />
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
