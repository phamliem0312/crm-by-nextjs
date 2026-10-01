"use client";

// Bảng Kanban của list: cột theo trường trạng thái, thẻ theo layout `kanban`, kéo thả đổi nhóm/thứ tự,
// menu "Chuyển sang" cho bàn phím. Port từ `views/record/kanban` + `kanban-item` của classic.
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type DragEvent } from "react";
import { translateOption } from "@/components/fields/basic";
import { FieldValue } from "@/components/fields/registry";
import type { FieldContext } from "@/components/fields/types";
import { Badge } from "@/components/fields/ui";
import { Menu } from "@/components/ui/menu";
import { toast } from "@/components/ui/toaster";
import { getFieldDefs, getSelectAttributes, isFieldAvailable } from "@/lib/espo/entity";
import {
  getKanban,
  kanbanCanMove,
  kanbanCanReorder,
  moveKanbanItem,
  saveKanbanOrder,
  type KanbanGroup,
  type KanbanResult,
} from "@/lib/espo/kanban";
import type { ListLayoutItem } from "@/lib/espo/layout";
import { updateRecord, type EspoRecord } from "@/lib/espo/records";
import { recordCreateHref, recordViewHref } from "@/lib/espo/routes";
import type { SearchParams } from "@/lib/espo/search";
import { useLayout } from "./hooks";
import { LoadingBlock } from "./scope-gate";

type KanbanLayoutItem = ListLayoutItem & { isLarge?: boolean; isMuted?: boolean };

const GROUP_ACCENTS: Record<string, string> = {
  success: "border-t-emerald-500",
  danger: "border-t-red-500",
  warning: "border-t-amber-500",
  info: "border-t-sky-500",
  primary: "border-t-blue-600",
};

export function KanbanView({
  ctx,
  scope,
  statusField,
  searchParams,
}: {
  ctx: FieldContext;
  scope: string;
  statusField: string;
  searchParams: SearchParams;
}) {
  const { t, metadata, acl } = ctx;
  const queryClient = useQueryClient();
  const layout = useLayout<KanbanLayoutItem[]>(scope, "kanban", { fallback: "listSmall" });
  const pageSize = typeof ctx.settings.recordsPerPageKanban === "number" ? ctx.settings.recordsPerPageKanban : 5;
  const [maxSize, setMaxSize] = useState(pageSize);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ group: string; index: number } | null>(null);
  const statusDefs = getFieldDefs(metadata, scope, statusField)!;
  const canMove = kanbanCanMove(metadata, acl, scope, statusField);
  const canReorder = kanbanCanReorder(metadata, scope, ctx.user.type === "portal");
  const canCreate = canMove && acl.checkScope(scope, "create");

  const items = (layout.data ?? []).filter(
    (item) => item?.name && !item.hidden && isFieldAvailable(metadata, scope, item.name) && acl.checkField(scope, item.name),
  );
  const select = getSelectAttributes(metadata, scope, ["name", statusField, ...items.map((item) => item.name)]);
  const queryKey = ["kanban", scope, searchParams, maxSize, select];
  const board = useQuery({
    queryKey,
    queryFn: ({ signal }) => getKanban(scope, { ...searchParams, select, maxSize }, signal),
    enabled: !!layout.data,
    placeholderData: keepPreviousData,
  });

  if (!layout.data || !board.data) {
    return <LoadingBlock />;
  }

  const groups = board.data.groups;

  async function move(id: string, toGroup: string, index: number) {
    const previous = queryClient.getQueryData<KanbanResult>(queryKey);
    const from = previous?.groups.find((group) => group.list.some((item) => item.id === id));

    if (!previous || !from || (from.name === toGroup && !canReorder)) {
      return;
    }

    const next = moveKanbanItem(previous.groups, id, toGroup, index, statusField);

    queryClient.setQueryData<KanbanResult>(queryKey, { ...previous, groups: next });

    try {
      if (from.name !== toGroup) {
        await updateRecord(scope, id, { [statusField]: toGroup });
        toast.success(t("Saved"));
      }

      if (canReorder) {
        await saveKanbanOrder(scope, toGroup, next.find((group) => group.name === toGroup)!.list.map((item) => item.id));
      }
    } catch (error) {
      queryClient.setQueryData(queryKey, previous);
      toast.error(error);
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["recordList", scope] });
    }
  }

  function dropIndex(event: DragEvent<HTMLElement>, group: KanbanGroup): number {
    const cards = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-card-id]")];
    const y = event.clientY;
    const index = cards.findIndex((card) => {
      const rect = card.getBoundingClientRect();

      return y < rect.top + rect.height / 2;
    });

    return index === -1 ? group.list.length : index;
  }

  const groupLabel = (group: KanbanGroup) => group.label || translateOption(ctx, scope, statusField, statusDefs, group.name);
  const anyMore = groups.some((group) => group.total > group.list.length);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 overflow-x-auto pb-2" aria-busy={board.isFetching}>
        {groups.map((group) => {
          const style = group.style || statusDefs.style?.[group.name] || null;
          const isTarget = dropTarget?.group === group.name;

          return (
            <section
              key={group.name}
              aria-label={groupLabel(group)}
              className={`flex w-72 shrink-0 flex-col rounded-xl border border-t-4 border-slate-200 bg-slate-100/70 ${GROUP_ACCENTS[style ?? ""] ?? "border-t-slate-300"} ${
                isTarget ? "ring-2 ring-blue-400" : ""
              }`}
              onDragOver={(event) => {
                if (!dragging) {
                  return;
                }

                event.preventDefault();
                setDropTarget({ group: group.name, index: dropIndex(event, group) });
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDropTarget(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (dragging) {
                  void move(dragging, group.name, dropIndex(event, group));
                }

                setDragging(null);
                setDropTarget(null);
              }}
            >
              <header className="flex items-center justify-between gap-2 px-3 py-2.5">
                <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                  <span className="truncate">{groupLabel(group)}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500 tabular-nums">{group.total}</span>
                </h2>
                {canCreate && (
                  <Link
                    href={`${recordCreateHref(scope, metadata)}?${new URLSearchParams({ attributes: JSON.stringify({ [statusField]: group.name }) })}`}
                    aria-label={`${t("Create")}: ${groupLabel(group)}`}
                    title={t("Create")}
                    className="inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-slate-800"
                  >
                    <i className="fas fa-plus text-xs" aria-hidden />
                  </Link>
                )}
              </header>
              <ul className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {group.list.map((record, index) => (
                  <li
                    key={record.id}
                    data-card-id={record.id}
                    draggable={canMove}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", record.id);
                      setDragging(record.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    className={`rounded-lg border border-slate-200 bg-white p-3 shadow-xs ${canMove ? "cursor-grab active:cursor-grabbing" : ""} ${
                      dragging === record.id ? "opacity-40" : ""
                    } ${isTarget && dropTarget?.index === index && dragging !== record.id ? "border-t-2 border-t-blue-500" : ""}`}
                  >
                    <KanbanCard
                      ctx={ctx}
                      scope={scope}
                      record={record}
                      items={items}
                      moveMenu={
                        canMove ? (
                          <Menu
                            label={`${t("Move Over")}: ${String(record.name ?? record.id)}`}
                            items={groups
                              .filter((target) => target.name !== group.name)
                              .map((target) => ({ label: groupLabel(target), onSelect: () => void move(record.id, target.name, 0) }))}
                          />
                        ) : null
                      }
                    />
                  </li>
                ))}
                {!group.list.length && <li className="px-1 py-3 text-center text-xs text-slate-400">{t("No Data")}</li>}
              </ul>
            </section>
          );
        })}
      </div>
      {anyMore && (
        <button type="button" onClick={() => setMaxSize(maxSize + pageSize)} className="self-start text-sm font-medium text-blue-600 hover:underline">
          {t("Show more")}
        </button>
      )}
    </div>
  );
}

function KanbanCard({
  ctx,
  scope,
  record,
  items,
  moveMenu,
}: {
  ctx: FieldContext;
  scope: string;
  record: EspoRecord;
  items: KanbanLayoutItem[];
  moveMenu: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      {items.map((item, index) => {
        const defs = getFieldDefs(ctx.metadata, scope, item.name)!;
        const className = `${item.isLarge ? "text-base font-semibold text-slate-900" : ""} ${item.isMuted ? "text-xs text-slate-500" : ""} ${
          item.align === "right" ? "text-right" : ""
        }`;

        if (item.link || index === 0) {
          return (
            <div key={item.name} className="flex items-start justify-between gap-2">
              <Link href={recordViewHref(scope, record.id, ctx.metadata)} className="min-w-0 font-medium break-words text-blue-700 hover:underline">
                {String(record[item.name] ?? record.name ?? "") || record.id}
              </Link>
              {moveMenu}
            </div>
          );
        }

        return (
          <div key={item.name} className={className}>
            {defs.type === "enum" && typeof record[item.name] === "string" ? (
              <Badge style={defs.style?.[String(record[item.name])] ?? null}>
                {translateOption(ctx, scope, item.name, defs, String(record[item.name]))}
              </Badge>
            ) : (
              <FieldValue ctx={ctx} scope={scope} name={item.name} defs={defs} values={record} mode="list" />
            )}
          </div>
        );
      })}
    </div>
  );
}
