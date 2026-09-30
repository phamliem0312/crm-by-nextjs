import { NextResponse, type NextRequest } from "next/server";
import { loginUrl, safeNextPath } from "@/lib/espo/client";
import { destroySession, getSession } from "@/lib/espo/session";

// Server Component không ghi được cookie; khi token hết hạn, layout chuyển qua đây để xoá session
// rồi về /login (nếu không, /login thấy session cũ và chuyển ngược lại → vòng lặp).
export async function GET(request: NextRequest): Promise<Response> {
  await destroySession(await getSession());

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  return NextResponse.redirect(new URL(loginUrl(next), request.url), 303);
}
