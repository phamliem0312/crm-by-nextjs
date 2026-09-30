import type { NextRequest } from "next/server";
import { buildTokenAuthHeaders } from "@/lib/espo/auth";
import { forwardToEspo } from "@/lib/espo/proxy";
import { destroySession, getCredentials, getSession } from "@/lib/espo/session";

type Context = { params: Promise<{ path: string[] }> };

// BFF proxy: trình duyệt gọi /api/espo/<route Espo>, server chuyển tiếp tới ESPO_API_URL
// kèm header xác thực lấy từ session. Chưa đăng nhập thì gửi không kèm auth (route `noAuth` như I18n vẫn chạy).
async function handle(request: NextRequest, context: Context): Promise<Response> {
  const { path } = await context.params;
  const session = await getSession();
  const credentials = getCredentials(session);

  const response = await forwardToEspo(
    request,
    path,
    credentials ? buildTokenAuthHeaders(credentials) : {},
  );

  // Token hết hạn hoặc bị huỷ: xoá session; client nhận 401 sẽ chuyển về /login.
  if (response.status === 401 && credentials) {
    await destroySession(session);
  }

  return response;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
