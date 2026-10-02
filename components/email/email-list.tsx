"use client";

// Trang Email: cột thư mục (Inbox, Important, Sent, Drafts, thư mục riêng, thư mục nhóm, Archive, Trash) kèm số
// chưa đọc, danh sách email theo thư mục, tìm kiếm/lọc, chọn nhiều + hành động hộp thư, kéo email vào thư mục.
// Tương đương `views/email/list` + `views/email/record/list` + `views/email-folder/list-side` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import type { FieldContext } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { useLayout } from "@/components/record/hooks";
import { LoadingBlock } from "@/components/record/scope-gate";
import { SearchPanel } from "@/components/record/search-panel";
import { ShortDateTime } from "@/components/stream/note-item";
import { Button, ConfirmDialog } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import {
  canDropToFolder,
  dropAction,
  emailIsRead,
  emailMassActions,
  FOLDER,
  folderEntries,
  folderWhere,
  isGroupFolder,
  isInTrash,
  markRead,
  subjectStyle,
  type EmailMassAction,
} from "@/lib/espo/email";
import { interpolate } from "@/lib/espo/i18n";
import { deleteRecord, listRecords, massAction, type EspoRecord, type ListResult } from "@/lib/espo/records";
import { classicHref, recordViewHref } from "@/lib/espo/routes";
import { buildSearchParams, parseListState, serializeListState, type ListState, type SearchState, type SortState } from "@/lib/espo/search";
import { runMailboxAction, type MailboxAction } from "./email-actions";
import { MoveFolderDialog } from "./folder-dialog";
import { ImportEmlDialog } from "./import-eml-dialog";
import { foldersDisabled, useEmailFolders, useNotReadCounts, useRefreshEmails } from "./hooks";

const SORT: SortState = { orderBy: "dateSent", order: "desc" };

const SELECT = [
  "name",
  "subject",
  "personStringData",
  "dateSent",
  "parentId",
  "parentType",
  "parentName",
  "isRead",
  "isImportant",
  "inTrash",
  "inArchive",
  "hasAttachment",
  "isUsers",
  "groupFolderId",
  "groupStatusFolder",
  "folderId",
  "status",
  "sentById",
  "createdById",
  "assignedUserId",
  "isReplied",
  "isAutoReply",
];

const DRAG_TYPE = "application/x-espo-email";

export function EmailListPage() {
  const ctx = useFieldContext();
  const filtersLayout = useLayout<string[]>("Email", "filters", { optional: true });

  if (!ctx || filtersLayout.isLoading) {
    return <LoadingBlock />;
  }

  return <EmailList ctx={ctx} filterFields={filtersLayout.data ?? []} />;
}

const MASS_LABELS: Record<EmailMassAction, string> = {
  retrieveFromTrash: "retrieveFromTrash",
  moveToTrash: "moveToTrash",
  moveToArchive: "moveToArchive",
  moveToFolder: "moveToFolder",
  markAsImportant: "markAsImportant",
  markAsNotImportant: "markAsNotImportant",
  markAsRead: "markAsRead",
  markAsNotRead: "markAsNotRead",
};

const MASS_ICONS: Partial<Record<EmailMassAction, string>> = {
  moveToTrash: "far fa-trash-can",
  moveToArchive: "far fa-caret-square-down",
  moveToFolder: "far fa-folder",
  markAsImportant: "far fa-star",
  markAsRead: "far fa-envelope-open",
};

function massActionToMailbox(action: EmailMassAction): MailboxAction | null {
  switch (action) {
    case "markAsRead":
      return { kind: "read", value: true };
    case "markAsNotRead":
      return { kind: "read", value: false };
    case "markAsImportant":
      return { kind: "important", value: true };
    case "markAsNotImportant":
      return { kind: "important", value: false };
    case "moveToTrash":
      return { kind: "trash", value: true };
    case "retrieveFromTrash":
      return { kind: "trash", value: false };
    case "moveToArchive":
      return { kind: "folder", folderId: FOLDER.archive };
    default:
      return null;
  }
}

function EmailList({ ctx, filterFields }: { ctx: FieldContext; filterFields: string[] }) {
  const { t, acl, user } = ctx;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const refresh = useRefreshEmails();
  const noFolders = foldersDisabled(ctx);
  const folderId = noFolders ? null : searchParams.get("folder") || FOLDER.inbox;
  const state = useMemo(() => parseListState(new URLSearchParams(searchParams.toString()), SORT), [searchParams]);
  const stateKey = searchParams.toString();
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({ key: stateKey, ids: [] });
  const selected = selection.key === stateKey ? selection.ids : [];
  const setSelected = (ids: string[]) => setSelection({ key: stateKey, ids });
  const [moving, setMoving] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [importingEml, setImportingEml] = useState(false);
  const pageSize = typeof ctx.settings.recordsPerPage === "number" ? ctx.settings.recordsPerPage : 20;
  const folders = useEmailFolders(!noFolders);
  const counts = useNotReadCounts(!noFolders);
  const entries = useMemo(() => folderEntries(folders.data ?? [], t), [folders.data, t]);

  const navigate = useCallback(
    (next: ListState, nextFolder: string | null) => {
      const params = serializeListState(next, SORT);

      if (nextFolder && nextFolder !== FOLDER.inbox) {
        params.set("folder", nextFolder);
      }

      const query = params.toString();

      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const search = useMemo(() => buildSearchParams(state, { timeZone: ctx.dateTime.getTimeZone() }), [state, ctx.dateTime]);
  const queryKey = useMemo(() => ["emailList", folderId, state, pageSize] as const, [folderId, state, pageSize]);
  const list = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      listRecords(
        "Email",
        {
          ...search,
          where: [...folderWhere(folderId), ...(search.where ?? [])],
          select: SELECT,
          maxSize: pageSize,
          offset: (state.page - 1) * pageSize,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    document.title = `${t("Email", "scopeNamesPlural")} · ${ctx.settings.applicationName || "EspoCRM"}`;
  }, [t, ctx.settings.applicationName]);

  const records = list.data?.list ?? [];
  const total = list.data?.total ?? 0;
  // Email không đếm tổng (total -1 = còn nữa, -2 = hết), như "Show more" của classic.
  const hasMore = total === -1 || (total > 0 && (state.page - 1) * pageSize + records.length < total);
  const allSelected = records.length > 0 && records.every((record) => selected.includes(record.id));
  const canCreate = acl.checkScope("Email", "create");
  const canDelete = acl.checkScope("Email", "delete");
  const massActions = emailMassActions(folderId);

  /** Cập nhật ngay các dòng trong list (trước khi tải lại). */
  const patchRows = (ids: string[], patch: Record<string, unknown>) =>
    queryClient.setQueryData<ListResult>(queryKey, (current) =>
      current ? { ...current, list: current.list.map((record) => (ids.includes(record.id) ? { ...record, ...patch } : record)) } : current,
    );

  async function act(ids: string[], action: MailboxAction) {
    if (!ids.length) {
      return;
    }

    setBusy(true);

    try {
      const moved = await runMailboxAction(ctx, ids, action);

      if (action.kind === "read") {
        patchRows(ids, { isRead: action.value });
        await queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] });
      } else if (action.kind === "important" && !(folderId === FOLDER.important && !action.value)) {
        patchRows(ids, { isImportant: action.value });
      } else if (moved) {
        setSelected([]);
        await refresh();
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    setBusy(true);

    try {
      await markRead({ all: true }, true);
      patchRows(
        records.map((record) => record.id),
        { isRead: true },
      );
      await queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] });
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeEmails(ids: string[]) {
    setBusy(true);

    try {
      if (ids.length === 1) {
        await deleteRecord("Email", ids[0]);
        toast.success(t("Removed"));
      } else {
        const result = await massAction("Email", "delete", ids);

        toast.success(interpolate(t("massRemoveResult", "messages"), { count: result?.count ?? ids.length }));
      }

      setSelected([]);
      await refresh();
    } catch (error) {
      toast.error(error);
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  function runMass(action: EmailMassAction, ids: string[]) {
    if (action === "moveToFolder") {
      setMoving(ids);

      return;
    }

    const mailbox = massActionToMailbox(action);

    if (mailbox) {
      void act(ids, mailbox);
    }
  }

  // ——— Kéo thả vào thư mục ———

  function onDragStart(event: DragEvent, record: EspoRecord) {
    const ids = selected.includes(record.id) ? selected : [record.id];

    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
  }

  function dropAllowed(target: string, droppable: boolean) {
    return !!folderId && droppable && canDropToFolder(folderId, target);
  }

  function onDrop(event: DragEvent, target: string) {
    event.preventDefault();
    setDropTarget(null);

    let ids: string[] = [];

    try {
      ids = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as string[];
    } catch {
      return;
    }

    const action = dropAction(folderId!, target);

    switch (action.kind) {
      case "important":
        void act(ids, { kind: "important", value: true });
        break;
      case "trash":
        void act(ids, { kind: "trash", value: true });
        break;
      case "retrieveAndMove":
        void act(ids, { kind: "retrieveAndMove", folderId: action.folderId });
        break;
      case "move":
        void act(ids, { kind: "folder", folderId: action.folderId });
        break;
    }
  }

  const moveParams = moving
    ? {
        isGroup: !!folderId && (isGroupFolder(folderId) || folderId === FOLDER.all),
        noArchive: folderId === FOLDER.all,
        currentFolderId: folderId,
      }
    : null;

  const headerMenu: MenuItem[] = [
    ...(canCreate && acl.checkScope("Import")
      ? [
          { label: t("Archive Email", "labels", "Email"), icon: "fas fa-plus", onSelect: () => router.push("/Email/create") },
          { label: t("Import EML", "labels", "Email"), icon: "fas fa-upload", onSelect: () => setImportingEml(true) },
        ]
      : []),
    ...(folderId ? [{ label: t("Mark all as read", "labels", "Email"), icon: "far fa-envelope-open", onSelect: () => void markAllRead() }] : []),
    { kind: "divider" as const },
    ...(acl.checkScope("EmailTemplate", "read")
      ? [{ label: t("Email Templates", "labels", "Email"), onSelect: () => window.location.assign(classicHref("#EmailTemplate")) }]
      : []),
    ...(!noFolders ? [{ label: t("Folders", "labels", "Email"), icon: "far fa-folder", onSelect: () => window.location.assign(classicHref("#EmailFolder")) }] : []),
    { label: t("Filters", "labels", "Email"), onSelect: () => window.location.assign(classicHref("#EmailFilter")) },
    ...(acl.checkScope("EmailAccountScope")
      ? [{ label: t("Email Accounts", "labels", "Email"), onSelect: () => window.location.assign(classicHref("#EmailAccount")) }]
      : []),
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("Email", "scopeNamesPlural")}</h1>
        <div className="flex items-center gap-2">
          <Menu
            label={t("Actions")}
            triggerClassName="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-xs hover:bg-slate-50 hover:text-slate-800"
            items={headerMenu}
          />
          {canCreate && (
            <Link
              href="/Email/compose"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700"
            >
              <i className="fas fa-pen text-xs" aria-hidden />
              {t("Compose", "labels", "Email")}
            </Link>
          )}
        </div>
      </div>

      <div className={noFolders ? "" : "grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]"}>
        {!noFolders && (
          <nav aria-label={t("Folders", "labels", "Email")} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {entries.map((entry) => {
                const count = counts.data?.[entry.id] ?? 0;
                const current = entry.id === folderId;
                const droppable = dropAllowed(entry.id, entry.droppable);

                return (
                  <li key={entry.id} className={entry.groupStart ? "lg:mt-2 lg:border-t lg:border-slate-200 lg:pt-2" : ""}>
                    <button
                      type="button"
                      aria-current={current ? "page" : undefined}
                      title={entry.title ?? undefined}
                      onClick={() => navigate({ ...state, page: 1 }, entry.id)}
                      onDragOver={(event) => {
                        if (droppable && event.dataTransfer.types.includes(DRAG_TYPE)) {
                          event.preventDefault();
                          setDropTarget(entry.id);
                        }
                      }}
                      onDragLeave={() => setDropTarget((value) => (value === entry.id ? null : value))}
                      onDrop={(event) => droppable && onDrop(event, entry.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm whitespace-nowrap ${
                        dropTarget === entry.id
                          ? "bg-blue-100 text-blue-900 ring-2 ring-blue-400"
                          : current
                            ? "bg-blue-50 font-medium text-blue-800"
                            : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <i className={`${entry.icon} w-4 text-center text-xs ${current ? "text-blue-600" : "text-slate-400"}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-slate-200 px-1.5 text-xs font-medium text-slate-700 tabular-nums">
                          <span className="sr-only">{t("Not Read", "labels")}: </span>
                          {count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <div className="flex min-w-0 flex-col gap-3">
          <SearchPanel
            ctx={ctx}
            scope="Email"
            state={state}
            filterFields={filterFields}
            onChange={(next: SearchState) => navigate({ ...state, ...next, page: 1 }, folderId)}
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
              <span className="font-medium text-blue-900">
                {t("Selected", "labels")}: {selected.length}
              </span>
              <span className="flex-1" />
              {massActions
                .filter((action) => MASS_ICONS[action])
                .map((action) => (
                  <Button key={action} disabled={busy} onClick={() => runMass(action, selected)}>
                    <i className={`${MASS_ICONS[action]} text-xs`} aria-hidden />
                    <span className="hidden sm:inline">{t(MASS_LABELS[action], "massActions", "Email")}</span>
                  </Button>
                ))}
              <Menu
                label={t("Actions")}
                triggerClassName="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 shadow-xs hover:bg-slate-50"
                items={[
                  ...massActions
                    .filter((action) => !MASS_ICONS[action])
                    .map((action) => ({ label: t(MASS_LABELS[action], "massActions", "Email"), onSelect: () => runMass(action, selected) })),
                  ...(canDelete
                    ? [{ kind: "divider" as const }, { label: t("Remove"), icon: "fas fa-trash", danger: true, onSelect: () => setConfirmDelete(selected) }]
                    : []),
                ]}
              />
              <Button variant="ghost" onClick={() => setSelected([])}>
                {t("Cancel")}
              </Button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <ul className={`divide-y divide-slate-100 ${list.isFetching && list.isPlaceholderData ? "opacity-60" : ""}`} aria-busy={list.isFetching}>
              <li className="flex items-center gap-3 bg-slate-50 px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                <input
                  type="checkbox"
                  className="size-4 accent-blue-600"
                  aria-label={t("Select")}
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : records.map((record) => record.id))}
                />
                <span>{folderId ? (entries.find((entry) => entry.id === folderId)?.name ?? "") : t("Email", "scopeNamesPlural")}</span>
              </li>
              {records.map((record) => (
                <EmailRow
                  key={record.id}
                  ctx={ctx}
                  record={record}
                  checked={selected.includes(record.id)}
                  onCheck={(checked) => setSelected(checked ? [...selected, record.id] : selected.filter((id) => id !== record.id))}
                  draggable={!!folderId && folderId !== FOLDER.drafts}
                  onDragStart={(event) => onDragStart(event, record)}
                  busy={busy}
                  onAction={(action) => (action === "moveToFolder" ? setMoving([record.id]) : action === "remove" ? setConfirmDelete([record.id]) : void act([record.id], action))}
                  canDelete={canDelete}
                  userId={user.id}
                  folderId={folderId}
                />
              ))}
            </ul>

            {list.isLoading && <LoadingBlock />}
            {!list.isLoading && !records.length && <p className="px-4 py-10 text-center text-sm text-slate-500">{t("No Data")}</p>}

            {(state.page > 1 || hasMore) && (
              <nav aria-label="Pagination" className="flex items-center justify-end gap-1 border-t border-slate-200 px-4 py-2 text-sm text-slate-600">
                <Button
                  variant="ghost"
                  disabled={state.page <= 1}
                  onClick={() => navigate({ ...state, page: state.page - 1 }, folderId)}
                  aria-label={t("Previous Page", "labels")}
                >
                  <i className="fas fa-chevron-left text-xs" aria-hidden />
                </Button>
                <span className="px-2 tabular-nums">{state.page}</span>
                <Button
                  variant="ghost"
                  disabled={!hasMore}
                  onClick={() => navigate({ ...state, page: state.page + 1 }, folderId)}
                  aria-label={t("Next Page", "labels")}
                >
                  <i className="fas fa-chevron-right text-xs" aria-hidden />
                </Button>
              </nav>
            )}
          </div>
        </div>
      </div>

      {importingEml && <ImportEmlDialog ctx={ctx} onClose={() => setImportingEml(false)} />}

      <MoveFolderDialog
        ctx={ctx}
        params={moveParams}
        onClose={() => setMoving(null)}
        onSelect={(target) => {
          const ids = moving ?? [];

          setMoving(null);
          void act(ids, { kind: "folder", folderId: target });
        }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={t("Remove")}
        message={
          <span className="whitespace-pre-line">
            {t(confirmDelete && confirmDelete.length > 1 ? "removeSelectedRecordsConfirmation" : "removeRecordConfirmation", "messages", "Email")}
          </span>
        }
        confirmLabel={t("Remove")}
        cancelLabel={t("Cancel")}
        danger
        busy={busy}
        onConfirm={() => confirmDelete && removeEmails(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

type RowAction = MailboxAction | "moveToFolder" | "remove";

/** Một dòng email: người gửi/nhận, tiêu đề (đậm khi chưa đọc), đính kèm, parent, ngày gửi. */
function EmailRow({
  ctx,
  record,
  checked,
  onCheck,
  draggable,
  onDragStart,
  busy,
  onAction,
  canDelete,
  userId,
  folderId,
}: {
  ctx: FieldContext;
  record: EspoRecord;
  checked: boolean;
  onCheck: (checked: boolean) => void;
  draggable: boolean;
  onDragStart: (event: DragEvent) => void;
  busy: boolean;
  onAction: (action: RowAction) => void;
  canDelete: boolean;
  userId: string;
  folderId: string | null;
}) {
  const { t, metadata } = ctx;
  const read = emailIsRead(record, userId);
  const style = subjectStyle(record);
  const subject = String(record.name ?? "") || t("No Subject", "labels", "Email");
  const important = !!record.isImportant;
  const inTrash = isInTrash(record);
  const isDraft = record.status === "Draft";
  const mailbox = !!record.isUsers || !!record.groupFolderId;

  const menu: MenuItem[] = [
    ...(mailbox && !isDraft
      ? [
          read
            ? { label: t("markAsNotRead", "massActions", "Email"), onSelect: () => onAction({ kind: "read", value: false }) }
            : { label: t("markAsRead", "massActions", "Email"), icon: "far fa-envelope-open", onSelect: () => onAction({ kind: "read", value: true }) },
        ]
      : []),
    ...(record.isUsers
      ? [
          important
            ? { label: t("Unmark Importance", "labels", "Email"), onSelect: () => onAction({ kind: "important", value: false }) }
            : { label: t("Mark as Important", "labels", "Email"), icon: "far fa-star", onSelect: () => onAction({ kind: "important", value: true }) },
        ]
      : []),
    ...(mailbox
      ? [
          inTrash
            ? { label: t("Retrieve from Trash", "labels", "Email"), onSelect: () => onAction({ kind: "trash", value: false }) }
            : { label: t("Move to Trash", "labels", "Email"), icon: "far fa-trash-can", onSelect: () => onAction({ kind: "trash", value: true }) },
        ]
      : []),
    ...(mailbox && !inTrash && folderId !== FOLDER.archive && !isDraft
      ? [{ label: t("moveToArchive", "actions", "Email"), icon: "far fa-caret-square-down", onSelect: () => onAction({ kind: "folder", folderId: FOLDER.archive }) }]
      : []),
    ...(!isDraft ? [{ label: t("Move to Folder", "labels", "Email"), icon: "far fa-folder", onSelect: () => onAction("moveToFolder") }] : []),
    ...(canDelete ? [{ kind: "divider" as const }, { label: t("Remove"), icon: "fas fa-trash", danger: true, onSelect: () => onAction("remove") }] : []),
  ];

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      className={`flex items-center gap-3 px-3 py-2 ${checked ? "bg-blue-50/60" : read ? "hover:bg-slate-50" : "bg-white hover:bg-slate-50"}`}
    >
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-blue-600"
        aria-label={`${t("Select")}: ${subject}`}
        checked={checked}
        onChange={(event) => onCheck(event.target.checked)}
      />
      {record.isUsers ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction({ kind: "important", value: !important })}
          aria-pressed={important}
          aria-label={important ? t("Unmark Importance", "labels", "Email") : t("Mark as Important", "labels", "Email")}
          title={important ? t("Unmark Importance", "labels", "Email") : t("Mark as Important", "labels", "Email")}
          className={`shrink-0 rounded p-1 text-sm ${important ? "text-amber-500" : "text-slate-300 hover:text-slate-500"}`}
        >
          <i className={important ? "fas fa-star" : "far fa-star"} aria-hidden />
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden />
      )}
      <div className="grid min-w-0 flex-1 gap-x-4 gap-y-0.5 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
        <span className={`truncate text-sm ${read ? "text-slate-600" : "font-semibold text-slate-900"}`}>
          {isDraft ? <span className="text-red-600">{t("Draft", "options", "Email")}</span> : String(record.personStringData ?? "")}
        </span>
        <span className="flex min-w-0 items-center gap-2">
          {!read && <span className="size-2 shrink-0 rounded-full bg-blue-600" aria-label={t("Not Read", "labels")} />}
          <Link
            href={recordViewHref("Email", record.id, metadata)}
            className={`truncate text-sm hover:underline ${read ? "text-slate-800" : "font-semibold text-slate-900"} ${
              style === "important" ? "text-amber-700" : style === "trash" ? "text-slate-400" : style === "archive" ? "text-sky-700" : ""
            }`}
          >
            {subject}
          </Link>
          {!!record.hasAttachment && <i className="fas fa-paperclip shrink-0 text-xs text-slate-400" aria-label={t("hasAttachment", "fields", "Email")} />}
          {typeof record.parentName === "string" && record.parentName && typeof record.parentType === "string" && (
            <Link
              href={recordViewHref(record.parentType, String(record.parentId), metadata)}
              className="hidden max-w-48 shrink-0 truncate rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200 md:inline"
            >
              {record.parentName}
            </Link>
          )}
        </span>
        <span className="text-xs whitespace-nowrap text-slate-500 sm:text-right sm:text-sm">
          <ShortDateTime ctx={ctx} value={typeof record.dateSent === "string" ? record.dateSent : null} />
        </span>
      </div>
      <Menu label={`${t("Actions")}: ${subject}`} items={menu} />
    </li>
  );
}
