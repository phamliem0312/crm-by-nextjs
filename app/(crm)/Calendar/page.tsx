import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarPage } from "@/components/calendar/calendar-page";
import { LoadingBlock } from "@/components/record/scope-gate";

export const metadata: Metadata = {
  title: "Calendar",
};

// Lịch Meeting/Call/Task (giai đoạn 4).
export default function CalendarRoute() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CalendarPage />
    </Suspense>
  );
}
