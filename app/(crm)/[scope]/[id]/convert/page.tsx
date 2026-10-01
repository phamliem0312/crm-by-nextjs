import { ConvertView } from "@/components/record/convert-view";
import { ScopeGate } from "@/components/record/scope-gate";

// Chuyển đổi bản ghi (Lead → Account/Contact/Opportunity). Scope không có `convertEntityList` → báo không có quyền.
export default async function RecordConvertPage({ params }: PageProps<"/[scope]/[id]/convert">) {
  const { scope, id } = await params;

  return (
    <ScopeGate scope={scope} classicHash={`#${scope}/convert/id=${encodeURIComponent(id)}`}>
      <ConvertView key={id} scope={scope} id={id} />
    </ScopeGate>
  );
}
