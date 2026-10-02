import { Suspense } from "react";
import { EmailListPage } from "@/components/email/email-list";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

// Hộp thư: thư mục + danh sách email (giai đoạn 4).
export default function EmailPage() {
  return (
    <ScopeGate scope="Email" classicHash="#Email">
      <Suspense fallback={<LoadingBlock />}>
        <EmailListPage />
      </Suspense>
    </ScopeGate>
  );
}
