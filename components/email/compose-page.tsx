"use client";

// Trang soạn email (`/Email/compose`) và lưu email có sẵn (`/Email/create`).
// Query: `reply=<id>` (+ `all=1` = Reply All), `forward=<id>`, `attributes=<json>` (điền sẵn từ panel), `returnTo=<đường dẫn>`.
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import type { FieldContext, Values } from "@/components/fields/types";
import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock, PageMessage } from "@/components/record/scope-gate";
import { safeNextPath } from "@/lib/espo/client";
import { forwardAttributes, getDuplicateAttributes, replyAttributes } from "@/lib/espo/email";
import { getRecord } from "@/lib/espo/records";
import { ComposeForm, initialComposeValues, type ComposeMode } from "./compose-form";
import { teamAssignChecker } from "./hooks";

function parseAttributes(value: string | null): Values {
  if (!value) {
    return {};
  }

  try {
    const data: unknown = JSON.parse(value);

    return data && typeof data === "object" && !Array.isArray(data) ? (data as Values) : {};
  } catch {
    return {};
  }
}

async function sourceAttributes(ctx: FieldContext, kind: "reply" | "forward", id: string, all: boolean): Promise<Values> {
  if (kind === "reply") {
    const email = await getRecord("Email", id);

    return replyAttributes(email, { cc: all, user: ctx.user, dateTime: ctx.dateTime, t: ctx.t, canAssignTeam: teamAssignChecker(ctx) });
  }

  // Chuyển tiếp: thân + đính kèm lấy bản sao (ảnh nhúng, file được copy sang email mới).
  const [email, duplicate] = await Promise.all([getRecord("Email", id), getDuplicateAttributes(id)]);
  const attributes = forwardAttributes({ ...email, body: duplicate.body ?? email.body }, { dateTime: ctx.dateTime, t: ctx.t });

  return { ...attributes, attachmentsIds: duplicate.attachmentsIds ?? [], attachmentsNames: duplicate.attachmentsNames ?? {} };
}

export function EmailComposePage({ mode }: { mode: ComposeMode }) {
  const ctx = useFieldContext();
  const params = useSearchParams();
  const reply = params.get("reply");
  const forward = params.get("forward");
  const all = params.get("all") === "1";
  const returnTo = params.get("returnTo");
  const kind = reply ? "reply" : forward ? "forward" : null;
  const sourceId = reply ?? forward;

  const source = useQuery({
    queryKey: ["emailComposeSource", kind, sourceId, all],
    queryFn: () => sourceAttributes(ctx!, kind!, sourceId!, all),
    enabled: !!ctx && !!kind && !!sourceId,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });

  if (!ctx || (kind && source.isLoading)) {
    return <LoadingBlock />;
  }

  if (!ctx.acl.checkScope("Email", "create")) {
    return <PageMessage icon="fas fa-lock" title={ctx.t("Access denied")} />;
  }

  if (source.error) {
    return <PageMessage icon="fas fa-exclamation-triangle" title={ctx.t("Error")} />;
  }

  const attributes = { ...parseAttributes(params.get("attributes")), ...(source.data ?? {}) };
  const title =
    mode === "archive"
      ? ctx.t("Archive Email", "labels", "Email")
      : kind === "reply"
        ? ctx.t(all ? "Reply to All" : "Reply", "labels", "Email")
        : kind === "forward"
          ? ctx.t("Forward", "labels", "Email")
          : ctx.t("Compose Email", "labels");
  const fallback = kind && sourceId ? `/Email/${encodeURIComponent(sourceId)}` : "/Email";

  return (
    <ComposeForm
      key={`${kind ?? "new"}-${sourceId ?? ""}`}
      ctx={ctx}
      mode={mode}
      initial={initialComposeValues(ctx, attributes, mode, true)}
      saved={null}
      returnHref={returnTo ? safeNextPath(returnTo) : fallback}
      title={title}
    />
  );
}
