import { redirect } from "next/navigation";

// Email không có trang sửa riêng: bản nháp sửa ngay ở trang chi tiết, email đã gửi/lưu sửa nhanh từng field.
export default async function EmailEditPage({ params }: PageProps<"/Email/[id]/edit">) {
  const { id } = await params;

  redirect(`/Email/${encodeURIComponent(id)}`);
}
