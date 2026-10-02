"use client";

// Hành động hộp thư dùng chung cho list và trang chi tiết (đọc/quan trọng/thùng rác/lưu trữ/thư mục).
import type { FieldContext } from "@/components/fields/types";
import { toast } from "@/components/ui/toaster";
import { FOLDER, markImportant, markRead, massMoveToFolder, moveToFolder, setInTrash } from "@/lib/espo/email";

export type MailboxAction =
  | { kind: "read"; value: boolean }
  | { kind: "important"; value: boolean }
  | { kind: "trash"; value: boolean }
  | { kind: "folder"; folderId: string }
  /** Kéo từ Trash sang thư mục khác: lấy ra khỏi thùng rác rồi chuyển. */
  | { kind: "retrieveAndMove"; folderId: string };

/**
 * Gọi API tương ứng và báo kết quả như classic. Trả về `false` khi không chuyển được email nào.
 * Nhiều email → chuyển thư mục qua `MassAction` (có số lượng); một email → `Email/inbox/folders/:id`.
 */
export async function runMailboxAction(ctx: FieldContext, ids: string[], action: MailboxAction): Promise<boolean> {
  const { t } = ctx;
  const target = ids.length === 1 ? { id: ids[0] } : { ids };

  switch (action.kind) {
    case "read":
      await markRead(target, action.value);

      return true;
    case "important":
      await markImportant(target, action.value);

      return true;
    case "trash":
      await setInTrash(target, action.value);
      toast.info(t(action.value ? "Moved to Trash" : "Retrieved from Trash", "labels", "Email"));

      return true;
    case "retrieveAndMove":
      await setInTrash({ ids }, false);
      await moveToFolder({ ids }, action.folderId);
      toast.success(t("Done"));

      return true;
    case "folder": {
      if (ids.length === 1) {
        await moveToFolder(target, action.folderId);
      } else {
        const result = await massMoveToFolder(ids, action.folderId);

        if (result.count === 0) {
          toast.info(t("No Records Moved", "labels", "Email"));

          return false;
        }
      }

      toast[action.folderId === FOLDER.archive ? "info" : "success"](
        action.folderId === FOLDER.archive ? t("Moved to Archive", "labels", "Email") : t("Done"),
      );

      return true;
    }
  }
}
