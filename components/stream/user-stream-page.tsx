"use client";

import { useFieldContext } from "@/components/fields/use-field-context";
import { LoadingBlock } from "@/components/record/scope-gate";
import { UserStream } from "./user-stream";

/** Trang `/stream` (tab "Stream" của classic). */
export function UserStreamPage() {
  const ctx = useFieldContext();

  return ctx ? <UserStream ctx={ctx} /> : <LoadingBlock />;
}
