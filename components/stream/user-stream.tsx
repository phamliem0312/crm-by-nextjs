"use client";

// Stream của người dùng (trang Stream, dashlet Stream): mọi hoạt động của các bản ghi đang theo dõi + post gửi tới
// mình; đăng post tới chính mình / người dùng / nhóm / mọi người (theo quyền `message`).
// Port từ `views/stream` + `views/stream/record/edit` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MultiPicker, type Option } from "@/components/fields/link";
import type { FieldContext } from "@/components/fields/types";
import { Select } from "@/components/fields/ui";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { createPost, listUserStream, type Note, type PostData, type StreamContext, type StreamFilter, type StreamResult } from "@/lib/espo/stream";
import { NoteItem } from "./note-item";
import { PostForm } from "./post-form";

type Target = NonNullable<PostData["targetType"]>;

/** Đối tượng nhận post người dùng được chọn (như `views/stream/record/edit`). */
export function postTargetOptions(ctx: FieldContext): Target[] {
  const message = ctx.acl.getPermissionLevel("message");
  const list: Target[] = ["self"];

  if (message === "team" || message === "all") {
    list.push("users", "teams");
  }

  if (message === "all") {
    list.push("all");
  }

  return list;
}

/** Danh sách note của stream người dùng (dùng cho trang và dashlet). */
export function UserStreamList({
  ctx,
  maxSize: initialMaxSize,
  filter = "all",
  skipOwn = false,
  queryKeyExtra = [],
  compact = false,
  refetchInterval = false,
}: {
  ctx: FieldContext;
  maxSize: number;
  filter?: StreamFilter;
  skipOwn?: boolean;
  queryKeyExtra?: unknown[];
  compact?: boolean;
  /** Tự làm mới (dashlet Stream). */
  refetchInterval?: number | false;
}) {
  const { t } = ctx;
  const queryClient = useQueryClient();
  const [maxSize, setMaxSize] = useState(initialMaxSize);
  const queryKey = ["stream", "@user", filter, skipOwn, ...queryKeyExtra];
  const stream = useQuery({
    queryKey: [...queryKey, maxSize],
    queryFn: ({ signal }) => listUserStream({ maxSize, filter, skipOwn }, signal),
    placeholderData: keepPreviousData,
    refetchInterval,
  });
  const streamCtx: StreamContext = {
    t,
    metadata: ctx.metadata,
    userId: ctx.user.id,
    parent: null,
    language: String(ctx.preferences.language ?? ctx.settings.language ?? ""),
  };
  const list = (stream.data?.list ?? []) as Note[];
  const total = stream.data?.total ?? 0;
  const hasMore = total < 0 ? list.length >= maxSize : total > list.length;

  const patchNote = (next: Note) =>
    queryClient.setQueriesData<StreamResult>({ queryKey }, (data) =>
      data ? { ...data, list: data.list.map((item) => (item.id === next.id ? next : item)) } : data,
    );

  return (
    <>
      {list.length ? (
        <div className={`divide-y divide-slate-100 ${compact ? "[&_article]:py-2" : ""}`}>
          {list.map((note) => (
            <NoteItem
              key={note.id}
              ctx={ctx}
              note={note}
              stream={streamCtx}
              onChange={patchNote}
              onRemoved={() => queryClient.invalidateQueries({ queryKey })}
            />
          ))}
        </div>
      ) : (
        <p className="px-4 py-4 text-sm text-slate-500">{stream.isLoading ? t("Loading...") : t("No Data")}</p>
      )}
      {hasMore && (
        <div className="border-t border-slate-100 px-4 py-2">
          <button type="button" onClick={() => setMaxSize(maxSize + initialMaxSize)} className="text-sm font-medium text-blue-600 hover:underline">
            {t("Show more")}
          </button>
        </div>
      )}
    </>
  );
}

const FILTERS: StreamFilter[] = ["all", "posts", "updates"];

export function UserStream({ ctx }: { ctx: FieldContext }) {
  const { t } = ctx;
  const queryClient = useQueryClient();
  const targets = postTargetOptions(ctx);
  const [target, setTarget] = useState<Target>("self");
  const [users, setUsers] = useState<Option[]>([]);
  const [teams, setTeams] = useState<Option[]>([]);
  const [filter, setFilter] = useState<StreamFilter>("all");
  const pageSize = typeof ctx.settings.recordsPerPage === "number" ? ctx.settings.recordsPerPage : 20;

  async function post(data: { post: string | null; attachmentsIds: string[] }) {
    if ((target === "users" && !users.length) || (target === "teams" && !teams.length)) {
      toast.errorText(t(target === "users" ? "users" : "teams", "fields", "Note") + ": " + t("required", "validationMessages"));

      return false;
    }

    try {
      await createPost({
        post: data.post,
        attachmentsIds: data.attachmentsIds,
        targetType: target,
        ...(target === "users" ? { usersIds: users.map((item) => item.id) } : {}),
        ...(target === "teams" ? { teamsIds: teams.map((item) => item.id) } : {}),
      });
      toast.success(t("Posted"));
      setUsers([]);
      setTeams([]);
      await queryClient.invalidateQueries({ queryKey: ["stream", "@user"] });

      return true;
    } catch (error) {
      toast.error(error);

      return false;
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("Stream")}
          {filter !== "all" && <span className="text-lg font-normal text-slate-500"> · {t(filter, "filters", "Note")}</span>}
        </h1>
        <Menu
          label={`${t("Stream")}: ${t("Filter")}`}
          trigger={<i className="fas fa-filter text-xs" aria-hidden />}
          items={FILTERS.map((item) => ({ label: t(item, "filters", "Note"), checked: filter === item, onSelect: () => setFilter(item) }))}
        />
      </div>

      {ctx.acl.checkScope("Note", "create") && (
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
          <PostForm
            ctx={ctx}
            placeholder={t("writeMessage", "messages", "Note")}
            storageKey="espo-next-stream-post-user"
            onSubmit={post}
            extra={
              <div className="flex flex-col gap-2">
                <Select
                  aria-label={t("targetType", "fields", "Note")}
                  className="w-56"
                  value={target}
                  onChange={(event) => setTarget(event.target.value as Target)}
                >
                  {targets.map((item) => (
                    <option key={item} value={item}>
                      {t.option(item, "targetType", "Note")}
                    </option>
                  ))}
                </Select>
                {target === "users" && <MultiPicker ctx={ctx} foreignScope="User" selected={users} onChange={setUsers} />}
                {target === "teams" && <MultiPicker ctx={ctx} foreignScope="Team" selected={teams} onChange={setTeams} />}
              </div>
            }
          />
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <UserStreamList key={filter} ctx={ctx} maxSize={pageSize} filter={filter} />
      </section>
    </div>
  );
}
