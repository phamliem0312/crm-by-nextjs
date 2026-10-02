"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FieldContext } from "@/components/fields/types";
import { getNotReadCounts, listEmailFolders } from "@/lib/espo/email";

/** Thư mục bị tắt (cấu hình `emailFoldersDisabled`, scope EmailFolder tắt hoặc không có quyền) → không lọc theo thư mục. */
export function foldersDisabled(ctx: FieldContext): boolean {
  return (
    !!ctx.settings.emailFoldersDisabled ||
    !!ctx.metadata.scopes?.EmailFolder?.disabled ||
    !ctx.acl.checkScope("EmailFolder")
  );
}

/** Được gán team này không (`checkTeamAssignmentPermission`): quyền gán "all" hoặc mình thuộc team đó. */
export function teamAssignChecker(ctx: FieldContext): (teamId: string) => boolean {
  return (teamId) => ctx.acl.getPermissionLevel("assignment") === "all" || (ctx.user.teamsIds ?? []).includes(teamId);
}

export function useEmailFolders(enabled = true) {
  return useQuery({ queryKey: ["emailFolders"], queryFn: listEmailFolders, staleTime: 60_000, enabled });
}

export function useNotReadCounts(enabled = true) {
  return useQuery({ queryKey: ["emailNotReadCounts"], queryFn: getNotReadCounts, enabled, refetchInterval: 60_000 });
}

/** Làm mới list email + số chưa đọc sau một thao tác hộp thư. */
export function useRefreshEmails() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["emailList"] }),
      queryClient.invalidateQueries({ queryKey: ["emailNotReadCounts"] }),
      queryClient.invalidateQueries({ queryKey: ["record", "Email"] }),
    ]);
  }, [queryClient]);
}
