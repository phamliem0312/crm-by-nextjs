import { Suspense } from "react";
import { EmailComposePage } from "@/components/email/compose-page";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

// Lưu email đã có ("Archive Email"): nhập người gửi, người nhận, ngày gửi.
export default function EmailCreateRoute() {
  return (
    <ScopeGate scope="Email" classicHash="#Email/create">
      <Suspense fallback={<LoadingBlock />}>
        <EmailComposePage mode="archive" />
      </Suspense>
    </ScopeGate>
  );
}
