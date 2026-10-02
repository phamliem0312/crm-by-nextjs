import { EmailDetail } from "@/components/email/email-detail";
import { ScopeGate } from "@/components/record/scope-gate";

// Chi tiết email; bản nháp mở form soạn.
export default async function EmailDetailPage({ params }: PageProps<"/Email/[id]">) {
  const { id } = await params;

  return (
    <ScopeGate scope="Email" classicHash={`#Email/view/${encodeURIComponent(id)}`}>
      <EmailDetail key={id} id={id} />
    </ScopeGate>
  );
}
