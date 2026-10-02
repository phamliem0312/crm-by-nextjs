import { Suspense } from "react";
import { EmailComposePage } from "@/components/email/compose-page";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

// Soạn email mới / trả lời / chuyển tiếp.
export default function EmailComposeRoute() {
  return (
    <ScopeGate scope="Email" classicHash="#Email">
      <Suspense fallback={<LoadingBlock />}>
        <EmailComposePage mode="compose" />
      </Suspense>
    </ScopeGate>
  );
}
