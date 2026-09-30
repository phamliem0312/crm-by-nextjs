import { Suspense } from "react";
import { ListView } from "@/components/record/list-view";
import { LoadingBlock, ScopeGate } from "@/components/record/scope-gate";

// List chung cho mọi entity (engine bản ghi, giai đoạn 2). Scope không hỗ trợ → trỏ sang classic.
export default async function ScopeListPage({ params }: PageProps<"/[scope]">) {
  const { scope } = await params;

  return (
    <ScopeGate scope={scope} classicHash={`#${scope}`}>
      <Suspense fallback={<LoadingBlock />}>
        <ListView scope={scope} />
      </Suspense>
    </ScopeGate>
  );
}
