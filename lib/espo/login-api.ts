/** Body trả về của `POST /api/auth/login`. Không bao giờ chứa token. */
export type LoginResponseBody =
  | { status: "success" }
  /** `message`: key của thông báo trong `User.messages`, ví dụ `enterTotpCode`. */
  | { status: "second-step"; message: string | null }
  | { status: "fail"; reason: LoginApiFailReason; message?: string };

export type LoginApiFailReason =
  | "wrong-credentials"
  | "wrong-code"
  | "error"
  | "unreachable"
  | "bad-request"
  /** Bước 2FA đã hết hạn hoặc chưa qua bước 1. */
  | "second-step-expired";

async function post(url: string, body?: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
}

async function readLoginResponse(response: Response): Promise<LoginResponseBody> {
  try {
    return (await response.json()) as LoginResponseBody;
  } catch {
    return { status: "fail", reason: response.status === 502 ? "unreachable" : "error" };
  }
}

export async function requestLogin(userName: string, password: string): Promise<LoginResponseBody> {
  try {
    return readLoginResponse(await post("/api/auth/login", { userName, password }));
  } catch {
    return { status: "fail", reason: "unreachable" };
  }
}

export async function requestLoginCode(code: string): Promise<LoginResponseBody> {
  try {
    return readLoginResponse(await post("/api/auth/login", { code }));
  } catch {
    return { status: "fail", reason: "unreachable" };
  }
}

/** Key của `localStorage` mà UI classic dùng để giữ token (Storage prefix `espo-` + `user`/`auth`). */
const CLASSIC_AUTH_STORAGE_KEY = "espo-user-auth";

export async function requestLogout(): Promise<void> {
  try {
    await post("/api/auth/logout");
  } finally {
    // Token đã bị huỷ; bỏ luôn bản UI classic giữ trong localStorage (nếu đã từng mở classic).
    try {
      localStorage.removeItem(CLASSIC_AUTH_STORAGE_KEY);
    } catch {
      // localStorage bị chặn: bỏ qua.
    }
  }
}
