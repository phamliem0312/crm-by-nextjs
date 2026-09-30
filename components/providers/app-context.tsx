"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { Acl } from "@/lib/espo/acl";
import { espoGet } from "@/lib/espo/client";
import { DateTimeFormat, NumberFormat } from "@/lib/espo/format";
import { createTranslator, type LanguageData, type Translator } from "@/lib/espo/i18n";
import type { AppUserData, Metadata } from "@/lib/espo/types";

export const AppUserContext = createContext<AppUserData | null>(null);

/** Đường dẫn UI classic trên cùng origin (ví dụ `/espocrm-10-0-9`), lấy từ ESPO_URL phía server. */
export const ClassicBasePathContext = createContext("");

export function useClassicBasePath(): string {
  return useContext(ClassicBasePathContext);
}

/** Dữ liệu `App/user` (user, acl, preferences, settings, appParams, language) nạp ở layout (crm). */
export function useAppUser(): AppUserData {
  const value = useContext(AppUserContext);

  if (!value) {
    throw new Error("useAppUser must be used inside AppProviders.");
  }

  return value;
}

/**
 * Khoá cache cho Metadata/I18n: đổi user hoặc Espo đổi cacheTimestamp thì tải lại.
 * Cũng dùng làm `cacheKey` để BFF cho trình duyệt cache response.
 */
function useCacheKey(): string {
  const { user, settings } = useAppUser();

  return `${user.id}-${settings.cacheTimestamp ?? 0}`;
}

export function useMetadata() {
  const cacheKey = useCacheKey();

  return useQuery({
    queryKey: ["metadata", cacheKey],
    queryFn: () => espoGet<Metadata>(`Metadata?cacheKey=${encodeURIComponent(cacheKey)}`),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useLanguageData() {
  const cacheKey = useCacheKey();
  const { language } = useAppUser();

  return useQuery({
    queryKey: ["i18n", language, cacheKey],
    queryFn: () =>
      espoGet<LanguageData>(
        `I18n?language=${encodeURIComponent(language)}&cacheKey=${encodeURIComponent(cacheKey)}`,
      ),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

const EMPTY_LANGUAGE: LanguageData = {};

/** Hàm dịch theo ngôn ngữ của user. Khi I18n chưa tải xong, trả về chính key (thường là nhãn tiếng Anh). */
export function useTranslator(): Translator {
  const { data } = useLanguageData();

  return useMemo(() => createTranslator(data ?? EMPTY_LANGUAGE), [data]);
}

export function useAcl(): Acl {
  const { acl, user, settings } = useAppUser();

  return useMemo(
    () => new Acl(acl, user, { aclAllowDeleteCreated: !!settings.aclAllowDeleteCreated }),
    [acl, user, settings.aclAllowDeleteCreated],
  );
}

export function useFormats(): { dateTime: DateTimeFormat; number: NumberFormat } {
  const { settings, preferences } = useAppUser();

  return useMemo(
    () => ({ dateTime: new DateTimeFormat(settings, preferences), number: new NumberFormat(settings, preferences) }),
    [settings, preferences],
  );
}
