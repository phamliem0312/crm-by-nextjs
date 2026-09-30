import type { Metadata } from "next";
import { encodeAuthString } from "@/lib/espo/auth";
import { getClassicBasePath } from "@/lib/espo/config";
import { safeClassicHash } from "@/lib/espo/routes";
import { getAppUser } from "@/lib/espo/server-api";
import { requireCredentials } from "@/lib/espo/session";
import { ClassicRedirect } from "./classic-redirect";

export const metadata: Metadata = {
  title: "EspoCRM",
};

/**
 * Chuyển sang UI classic mà không phải đăng nhập lại: `/classic?to=#Admin`.
 * Ghi token vào localStorage theo đúng định dạng `Storage.set('user', 'auth', …)` của classic
 * (UI classic bắt buộc như vậy), cookie `auth-token-secret` đã có sẵn từ lúc đăng nhập.
 */
export default async function ClassicPage({ searchParams }: PageProps<"/classic">) {
  const credentials = await requireCredentials();
  // Kiểm tra token còn hiệu lực (hết hạn → /api/auth/expired → /login) và lấy id user.
  const { user } = await getAppUser();
  const { to } = await searchParams;

  return (
    <ClassicRedirect
      auth={encodeAuthString(credentials.userName, credentials.token)}
      token={credentials.token}
      userId={user.id}
      target={`${getClassicBasePath()}/${safeClassicHash(typeof to === "string" ? to : null)}`}
    />
  );
}
