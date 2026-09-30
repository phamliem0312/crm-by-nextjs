import { EspoApiError } from "./errors";

export { EspoApiError };

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

type AppTimestampListener = (timestamp: number) => void;

const appTimestampListeners = new Set<AppTimestampListener>();

/**
 * Nhận `X-App-Timestamp` của mỗi response. Giá trị tăng nghĩa là Espo đã được cập nhật
 * (rebuild, đổi metadata…) và nên tải lại trang, giống `setupAjax` của classic.
 */
export function onAppTimestamp(listener: AppTimestampListener): () => void {
  appTimestampListeners.add(listener);

  return () => appTimestampListeners.delete(listener);
}

function notifyAppTimestamp(response: Response): void {
  const value = Number.parseInt(response.headers.get("X-App-Timestamp") ?? "", 10);

  if (Number.isFinite(value)) {
    appTimestampListeners.forEach((listener) => listener(value));
  }
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

  notifyAppTimestamp(response);

  if (response.status === 401) {
    window.location.assign(loginUrl(window.location.pathname + window.location.search));

    throw await EspoApiError.fromResponse(response);
  }

  return response;
}

/** `GET` và trả JSON; lỗi HTTP → `EspoApiError` (có body để dịch thông báo). */
export async function espoGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await espoFetch(path, init);

  if (!response.ok) {
    throw await EspoApiError.fromResponse(response);
  }

  return (await response.json()) as T;
}
