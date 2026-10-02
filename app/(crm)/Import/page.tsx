import { Suspense } from "react";
import { ImportWizard } from "@/components/import/import-wizard";
import { LoadingBlock } from "@/components/record/scope-gate";

// Nhập dữ liệu từ CSV (giai đoạn 4).
export default function ImportPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <ImportWizard />
    </Suspense>
  );
}
