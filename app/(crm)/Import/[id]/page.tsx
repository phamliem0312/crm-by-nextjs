import { ImportDetail } from "@/components/import/import-detail";

// Kết quả một lần nhập.
export default async function ImportDetailPage({ params }: PageProps<"/Import/[id]">) {
  const { id } = await params;

  return <ImportDetail key={id} id={id} />;
}
