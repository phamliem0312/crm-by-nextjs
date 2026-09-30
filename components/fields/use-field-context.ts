"use client";

import { useMemo } from "react";
import {
  useAcl,
  useAppUser,
  useClassicBasePath,
  useFormats,
  useMetadata,
  useTranslator,
} from "@/components/providers/app-context";
import type { FieldContext } from "./types";

/** Context cho field; `null` khi Metadata chưa tải xong. */
export function useFieldContext(): FieldContext | null {
  const { settings, preferences, user, appParams } = useAppUser();
  const metadata = useMetadata().data;
  const t = useTranslator();
  const formats = useFormats();
  const acl = useAcl();
  const classicBasePath = useClassicBasePath();

  return useMemo(
    () =>
      metadata
        ? {
            metadata,
            t,
            dateTime: formats.dateTime,
            numbers: formats.number,
            settings,
            preferences,
            acl,
            user,
            classicBasePath,
            appParams: appParams ?? {},
          }
        : null,
    [metadata, t, formats, settings, preferences, acl, user, classicBasePath, appParams],
  );
}
