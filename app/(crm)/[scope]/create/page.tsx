import { Suspense } from "react";
import { RecordForm } from "@/components/record/record-form";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

// Tạo bản ghi. Query `relate`/`attributes` do relationship panel truyền sang (createAttributeMap).
export default async function RecordCreatePage({ params }: PageProps<"/[scope]/create">) {
  const { scope } = await params;

  return (
    <ScopeGate scope={scope} classicHash={`#${scope}/create`}>
      <Suspense fallback={<LoadingBlock />}>
        <RecordForm scope={scope} />
      </Suspense>
    </ScopeGate>
  );
}
