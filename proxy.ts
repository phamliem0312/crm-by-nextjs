import { NextResponse, type NextRequest } from "next/server";
import { loginUrl } from "@/lib/espo/client";
import { getClassicBasePath } from "@/lib/espo/config";
import { PATHNAME_HEADER, SESSION_COOKIE } from "@/lib/espo/session-cookie";

/** Trang không cần đăng nhập. `/api/*` tự xử lý (BFF trả 401), UI classic có màn đăng nhập riêng. */
function isPublicPath(pathname: string, classicBasePath: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    (classicBasePath !== "" && (pathname === classicBasePath || pathname.startsWith(`${classicBasePath}/`)))
  );
}

export function proxy(request: NextRequest) {
  const classicBasePath = getClassicBasePath();
  const { pathname, search } = request.nextUrl;

  // UI classic nạp tài nguyên bằng đường dẫn tương đối (client/lib/...), nên gốc của nó phải có "/" ở cuối.
  // Dùng URL thường: `nextUrl.clone()` tự bỏ "/" ở cuối theo cấu hình trailingSlash.
  if (classicBasePath && pathname === classicBasePath) {
    return NextResponse.redirect(new URL(`${classicBasePath}/${search}`, request.url));
  }

  if (isPublicPath(pathname, classicBasePath)) {
    return NextResponse.next();
  }

  // Kiểm tra sơ bộ (chỉ xem có cookie session); layout (crm) mới giải mã và kiểm tra thật.
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL(loginUrl(pathname + search), request.url));
  }

  // Cho layout biết trang hiện tại, để quay lại đúng trang nếu phải đăng nhập lại.
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(PATHNAME_HEADER, pathname + search);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Bỏ qua tài nguyên build và file ảnh tĩnh trong public/ (không cần đăng nhập mới xem được).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|[^/]+\\.(?:svg|png|jpe?g|gif|webp|avif|ico)$).*)"],
};
