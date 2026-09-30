import { Suspense } from "react";
import { RecordForm } from "@/components/record/record-form";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

export default async function RecordEditPage({ params }: PageProps<"/[scope]/[id]/edit">) {
  const { scope, id } = await params;

  return (
    <ScopeGate scope={scope} classicHash={`#${scope}/edit/${encodeURIComponent(id)}`}>
      <Suspense fallback={<LoadingBlock />}>
        <RecordForm key={id} scope={scope} id={id} />
      </Suspense>
    </ScopeGate>
  );
}
