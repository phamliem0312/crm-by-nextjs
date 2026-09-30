import { getEspoApiUrl } from "./config";

/** Cookie HttpOnly mà Espo đặt khi tạo token (xem `Authentication::setSecretInCookie`). */
export const AUTH_TOKEN_SECRET_COOKIE = "auth-token-secret";

const TIMEOUT_MS = 60_000;

/** Thông tin để gọi Espo thay cho người dùng; được giữ trong session đã mã hoá. */
export type EspoCredentials = {
  userName: string;
  token: string;
  /** Giá trị cookie `auth-token-secret`; không có nếu Espo tắt `authTokenSecretDisabled`. */
  secret?: string;
};

/** Bước 1 xong, đang chờ mã 2FA. `authString` dùng lại ở bước 2, giống `headers` của `LoginSecondStepView`. */
export type PendingSecondStep = {
  userName: string;
  authString: string;
};

export type LoginFailReason =
  /** 401: sai tên đăng nhập/mật khẩu (hoặc bị từ chối). */
  | "wrong-credentials"
  /** 401 ở bước 2FA: sai mã. */
  | "wrong-code"
  /** 401 kèm `X-Status-Reason: error`, hoặc status lạ. */
  | "error"
  /** Không kết nối được tới Espo. */
  | "unreachable";

export type LoginResult =
  | { status: "success"; credentials: EspoCredentials }
  | { status: "second-step"; pending: PendingSecondStep; message: string | null }
  | { status: "fail"; reason: LoginFailReason; message?: string };

/** `base64("user:password")`, mã hoá UTF-8 như `js-base64` của UI classic. */
export function encodeAuthString(userName: string, password: string): string {
  return Buffer.from(`${userName}:${password}`, "utf8").toString("base64");
}

/** Header gửi kèm mọi request tới Espo sau khi đã đăng nhập. */
export function buildTokenAuthHeaders(credentials: EspoCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Espo-Authorization": encodeAuthString(credentials.userName, credentials.token),
    "Espo-Authorization-By-Token": "true",
  };

  if (credentials.secret) {
    headers.Cookie = `${AUTH_TOKEN_SECRET_COOKIE}=${encodeURIComponent(credentials.secret)}`;
  }

  return headers;
}

/**
 * Lấy giá trị `auth-token-secret` từ các header `Set-Cookie` của Espo.
 * Trả về `null` khi Espo xoá cookie (giá trị `deleted`), `undefined` khi không có.
 */
export function parseSecretFromSetCookie(setCookies: string[]): string | null | undefined {
  const prefix = `${AUTH_TOKEN_SECRET_COOKIE}=`;

  for (const header of setCookies) {
    const pair = header.split(";", 1)[0].trim();

    if (!pair.startsWith(prefix)) {
      continue;
    }

    const value = decodeURIComponent(pair.slice(prefix.length));

    return value === "" || value === "deleted" ? null : value;
  }

  return undefined;
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data: unknown = await response.json();

    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/**
 * Đọc kết quả của `GET App/user` khi đăng nhập. Cùng cách xử lý với `LoginView.proceed`
 * và `LoginSecondStepView.send` của UI classic.
 *
 * @param authString Chuỗi auth đã gửi; dùng lại ở bước 2FA khi Espo không trả token tạm.
 * @param isSecondStep Đang gửi mã 2FA (401 khi đó nghĩa là sai mã).
 */
export async function readLoginResponse(
  response: Response,
  userName: string,
  authString: string,
  isSecondStep = false,
): Promise<LoginResult> {
  const data = await readJson(response);

  if (response.ok) {
    const token = asString(data.token);

    if (!token) {
      return { status: "fail", reason: "error" };
    }

    const user = (data.user ?? {}) as Record<string, unknown>;
    const secret = parseSecretFromSetCookie(response.headers.getSetCookie());

    return {
      status: "success",
      credentials: {
        userName: asString(user.userName) ?? userName,
        token,
        ...(secret ? { secret } : {}),
      },
    };
  }

  const statusReason = response.headers.get("X-Status-Reason");

  if (response.status === 401) {
    if (statusReason === "second-step-required") {
      const token = asString(data.token);

      return {
        status: "second-step",
        pending: {
          userName,
          authString: token ? encodeAuthString(userName, token) : authString,
        },
        message: asString(data.message) ?? null,
      };
    }

    if (statusReason === "error") {
      return { status: "fail", reason: "error" };
    }

    return { status: "fail", reason: isSecondStep ? "wrong-code" : "wrong-credentials" };
  }

  // 400/403/503 (ví dụ chế độ bảo trì): Espo đặt lý do ở X-Status-Reason hoặc `message` trong body.
  return {
    status: "fail",
    reason: "error",
    message: asString(data.message) ?? statusReason ?? undefined,
  };
}

async function requestAppUser(headers: Record<string, string>): Promise<Response | null> {
  try {
    return await fetch(`${getEspoApiUrl()}/App/user`, {
      headers,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error("Espo login request failed", e);

    return null;
  }
}

/** Bước 1: đăng nhập bằng tên + mật khẩu. */
export async function loginWithPassword(userName: string, password: string): Promise<LoginResult> {
  const authString = encodeAuthString(userName, password);

  const response = await requestAppUser({
    "Espo-Authorization": authString,
    "Espo-Authorization-By-Token": "false",
    "Espo-Authorization-Create-Token-Secret": "true",
  });

  if (!response) {
    return { status: "fail", reason: "unreachable" };
  }

  return readLoginResponse(response, userName, authString);
}

/** Bước 2: gửi mã 2FA. */
export async function loginWithCode(pending: PendingSecondStep, code: string): Promise<LoginResult> {
  const response = await requestAppUser({
    "Espo-Authorization": pending.authString,
    "Espo-Authorization-Code": code,
    "Espo-Authorization-Create-Token-Secret": "true",
  });

  if (!response) {
    return { status: "fail", reason: "unreachable" };
  }

  return readLoginResponse(response, pending.userName, pending.authString, true);
}

/** Huỷ token phía Espo (`POST App/destroyAuthToken`). Lỗi chỉ ghi log: session phía Next vẫn bị xoá. */
export async function destroyAuthToken(credentials: EspoCredentials): Promise<void> {
  try {
    const response = await fetch(`${getEspoApiUrl()}/App/destroyAuthToken`, {
      method: "POST",
      headers: {
        ...buildTokenAuthHeaders(credentials),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: credentials.token }),
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok && response.status !== 401) {
      console.error(`Espo destroyAuthToken returned ${response.status}`);
    }
  } catch (e) {
    console.error("Espo destroyAuthToken request failed", e);
  }
}
