/** Lỗi khi gọi API Espo qua BFF, giữ lại status và `X-Status-Reason`. */
export class EspoApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusReason: string | null,
  ) {
    super(`Espo API error ${status}${statusReason ? `: ${statusReason}` : ""}`);
  }
}

/** Đường dẫn trang đăng nhập, kèm `next` để quay lại trang hiện tại sau khi đăng nhập. */
export function loginUrl(next?: string): string {
  return next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/**
 * Chỉ nhận đường dẫn nội bộ (`/...`), chặn `//host` và `/\host` để không bị chuyển hướng ra ngoài.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }

  return value;
}

/**
 * Gọi REST API của Espo qua `/api/espo/*` (chỉ dùng phía trình duyệt).
 * Nhận 401 thì BFF đã xoá session, ở đây chuyển về trang đăng nhập.
 */
export async function espoFetch(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`/api/espo/${path.replace(/^\/+/, "")}`, {
    cache: "no-store",
    ...init,
  });

  if (response.status === 401) {
    window.location.assign(loginUrl(window.location.pathname + window.location.search));

    throw new EspoApiError(401, response.headers.get("X-Status-Reason"));
  }

  return response;
}

export async function espoGet<T>(path: string): Promise<T> {
  const response = await espoFetch(path);

  if (!response.ok) {
    throw new EspoApiError(response.status, response.headers.get("X-Status-Reason"));
  }

  return (await response.json()) as T;
}
