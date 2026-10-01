"use client";

// Panel Stream của trang chi tiết: đăng post, note đã ghim, lọc (tất cả / post / cập nhật), tải thêm.
// Port từ `views/stream/panel` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FieldContext } from "@/components/fields/types";
import { PanelCard } from "@/components/record/activity-panels";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import type { EspoRecord } from "@/lib/espo/records";
import { createPost, listStream, type Note, type StreamContext, type StreamFilter, type StreamResult } from "@/lib/espo/stream";
import { NoteItem } from "./note-item";
import { PostForm } from "./post-form";

const FILTERS: StreamFilter[] = ["all", "posts", "updates"];

function readFilter(scope: string): StreamFilter {
  try {
    const value = localStorage.getItem(`espo-next-stream-filter-${scope}`);

    return FILTERS.includes(value as StreamFilter) ? (value as StreamFilter) : "all";
  } catch {
    return "all";
  }
}

export function StreamPanel({
  ctx,
  scope,
  record,
  canEditParent,
  onFollowed,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  canEditParent: boolean;
  /** Đăng post thì tự theo dõi bản ghi (preference `followEntityOnStreamPost`). */
  onFollowed?: () => void;
}) {
  const { t } = ctx;
  const queryClient = useQueryClient();
  const pageSize = typeof ctx.settings.recordsPerPageSmall === "number" ? ctx.settings.recordsPerPageSmall : 5;
  const [maxSize, setMaxSize] = useState(pageSize);
  const [filter, setFilterState] = useState<StreamFilter>(() => readFilter(scope));
  const [quote, setQuote] = useState<string | undefined>(undefined);
  const queryKey = ["stream", scope, record.id];
  const stream = useQuery({
    queryKey: [...queryKey, filter, maxSize],
    queryFn: ({ signal }) => listStream(scope, record.id, { maxSize, filter }, signal),
    placeholderData: keepPreviousData,
  });

  const streamCtx: StreamContext = {
    t,
    metadata: ctx.metadata,
    userId: ctx.user.id,
    parent: { scope, id: record.id },
    language: String(ctx.preferences.language ?? ctx.settings.language ?? ""),
  };
  const allowInternal =
    ctx.user.type !== "portal" &&
    !!((ctx.metadata.streamDefs as Record<string, { allowInternalNotes?: boolean }> | undefined)?.[scope]?.allowInternalNotes);
  const canPost = ctx.acl.checkScope("Note", "create");

  function setFilter(next: StreamFilter) {
    setFilterState(next);
    setMaxSize(pageSize);

    try {
      localStorage.setItem(`espo-next-stream-filter-${scope}`, next);
    } catch {
      // Không lưu được lựa chọn thì vẫn lọc bình thường.
    }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  /** Cập nhật một note trong cache (reaction, sửa, ghim) mà không tải lại cả stream. */
  function patchNote(next: Note) {
    queryClient.setQueriesData<StreamResult>({ queryKey }, (data) =>
      data
        ? {
            ...data,
            list: data.list.map((item) => (item.id === next.id ? next : item)),
            pinnedList: data.pinnedList?.map((item) => (item.id === next.id ? next : item)),
          }
        : data,
    );
  }

  async function post(data: { post: string | null; attachmentsIds: string[]; isInternal: boolean }) {
    try {
      await createPost({ ...data, parentType: scope, parentId: record.id, isInternal: allowInternal && data.isInternal });
      toast.success(t("Posted"));
      setQuote(undefined);
      await refresh();

      if (ctx.preferences.followEntityOnStreamPost) {
        onFollowed?.();
      }

      return true;
    } catch (error) {
      toast.error(error);

      return false;
    }
  }

  const list = (stream.data?.list ?? []) as Note[];
  const pinned = (stream.data?.pinnedList ?? []) as Note[];
  const total = stream.data?.total ?? 0;

  const renderNote = (note: Note, pinnedSection = false) => (
    <NoteItem
      key={`${pinnedSection ? "p" : "n"}-${note.id}`}
      ctx={ctx}
      note={note}
      stream={streamCtx}
      canEditParent={canEditParent}
      pinnedSection={pinnedSection}
      onChange={patchNote}
      onRemoved={() => refresh()}
      onPinnedChange={() => refresh()}
      onQuote={(text) => {
        const quoted = `> ${text.split(/\r?\n/).join("\n> ")}\n\n`;

        setQuote((current) => `${current ? `${current}\n` : ""}${quoted}`);
      }}
    />
  );

  return (
    <PanelCard
      id="panel-stream"
      title={
        <>
          {t("Stream")}
          {filter !== "all" && <span className="font-normal text-slate-500"> · {t(filter, "filters", "Note")}</span>}
        </>
      }
      actions={
        <Menu
          label={`${t("Stream")}: ${t("Filter")}`}
          trigger={<i className="fas fa-filter text-xs" aria-hidden />}
          items={FILTERS.map((item) => ({
            label: t(item, "filters", "Note"),
            checked: filter === item,
            onSelect: () => setFilter(item),
          }))}
        />
      }
    >
      {canPost && (
        <div className="border-b border-slate-100 px-4 py-3">
          <PostForm
            ctx={ctx}
            placeholder={t("writeYourCommentHere", "messages")}
            allowInternal={allowInternal}
            storageKey={`espo-next-stream-post-${scope}-${record.id}`}
            value={quote}
            onValueChange={(next) => setQuote(next)}
            onSubmit={post}
          />
        </div>
      )}

      {pinned.length > 0 && (
        <div className="border-b border-slate-100 bg-amber-50/40">
          <p className="px-4 pt-2 text-xs font-semibold tracking-wide text-amber-700 uppercase">
            <i className="fas fa-map-pin mr-1.5" aria-hidden />
            {t("Pinned", "labels", "Note")}
          </p>
          <div className="divide-y divide-amber-100">{pinned.map((note) => renderNote(note, true))}</div>
        </div>
      )}

      {list.length ? (
        <div className={`divide-y divide-slate-100 ${stream.isFetching && stream.isPlaceholderData ? "opacity-60" : ""}`}>
          {list.map((note) => renderNote(note))}
        </div>
      ) : (
        <p className="px-4 py-3 text-sm text-slate-500">{stream.isLoading ? t("Loading...") : t("No Data")}</p>
      )}

      {total > list.length && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button type="button" onClick={() => setMaxSize(maxSize + pageSize * 2)} className="text-sm font-medium text-blue-600 hover:underline">
            {t("Show more")}
          </button>
        </div>
      )}
    </PanelCard>
  );
}
