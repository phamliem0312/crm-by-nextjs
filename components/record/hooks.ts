"use client";

import { useQuery } from "@tanstack/react-query";
import { useAcl, useAppUser, useMetadata } from "@/components/providers/app-context";
import { espoGet } from "@/lib/espo/client";
import { EspoApiError } from "@/lib/espo/errors";
import { isNewUiScope } from "@/lib/espo/routes";

/**
 * Layout của một scope (`GET <Scope>/layout/<type>`), cache theo user + cacheTimestamp như Metadata.
 * `fallback`: layout thay thế khi layout này không có (404), ví dụ `listForAccount` → `listSmall`.
 */
export function useLayout<T>(
  scope: string,
  type: string,
  options: { fallback?: string; optional?: boolean; enabled?: boolean } = {},
) {
  const { user, settings } = useAppUser();
  const cacheKey = `${user.id}-${settings.cacheTimestamp ?? 0}`;

  return useQuery({
    queryKey: ["layout", scope, type, options.fallback ?? null, cacheKey],
    queryFn: async (): Promise<T | null> => {
      try {
        return await espoGet<T>(`${encodeURIComponent(scope)}/layout/${encodeURIComponent(type)}`);
      } catch (e) {
        if (!(e instanceof EspoApiError) || e.status !== 404) {
          throw e;
        }

        if (options.fallback) {
          return espoGet<T>(`${encodeURIComponent(scope)}/layout/${encodeURIComponent(options.fallback)}`);
        }

        // Layout tuỳ chọn (ví dụ defaultSidePanel) không có → dùng mặc định.
        if (options.optional) {
          return null;
        }

        throw e;
      }
    },
    staleTime: Infinity,
    gcTime: Infinity,
    enabled: options.enabled ?? true,
    meta: { silent: !!options.fallback || !!options.optional },
  });
}

export type ScopeStatus = "loading" | "notFound" | "classic" | "forbidden" | "ok";

/** Scope có mở được bằng engine bản ghi và người dùng có quyền đọc không. */
export function useScopeStatus(scope: string): ScopeStatus {
  const metadata = useMetadata().data;
  const acl = useAcl();

  if (!metadata) {
    return "loading";
  }

  if (!metadata.scopes?.[scope]) {
    // Espo bỏ scope không có quyền khỏi metadata của user thường, nên không phân biệt được
    // "không tồn tại" với "không có quyền". Giống classic: user thường → Access denied, admin → Not found.
    return acl.isAdmin() ? "notFound" : "forbidden";
  }

  if (!metadata.scopes[scope].entity) {
    return "notFound";
  }

  if (!isNewUiScope(scope, metadata)) {
    return "classic";
  }

  return acl.checkScope(scope, "read") ? "ok" : "forbidden";
}
