import { DetailView } from "@/components/record/detail-view";
import { ScopeGate } from "@/components/record/scope-gate";

// Trang chi tiết chung cho mọi entity (engine bản ghi, giai đoạn 2).
export default async function RecordDetailPage({ params }: PageProps<"/[scope]/[id]">) {
  const { scope, id } = await params;

  return (
    <ScopeGate scope={scope} classicHash={`#${scope}/view/${encodeURIComponent(id)}`}>
      <DetailView key={id} scope={scope} id={id} />
    </ScopeGate>
  );
}
