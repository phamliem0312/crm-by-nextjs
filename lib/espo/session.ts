import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_TOKEN_SECRET_COOKIE, type EspoCredentials, type PendingSecondStep } from "./auth";
import { SESSION_COOKIE } from "./session-cookie";

/** Bước 2FA phải xong trong khoảng này, không thì đăng nhập lại từ đầu. */
const SECOND_STEP_TTL_MS = 10 * 60 * 1000;

/** Espo tự hết hạn token (authTokenLifetime/maxIdle) và trả 401; session chỉ cần sống lâu hơn. */
const SESSION_TTL_S = 30 * 24 * 60 * 60;

export type SessionData = Partial<EspoCredentials> & {
  secondStep?: PendingSecondStep & { expiresAt: number };
};

export type EspoSession = IronSession<SessionData>;

function getSessionSecret(): string {
  const value = process.env.SESSION_SECRET;

  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }

  return value;
}

/** Cookie có cờ `Secure` khi trình duyệt tới qua HTTPS (trực tiếp hoặc qua reverse proxy). */
async function isSecureRequest(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto") ?? "";

  return proto.split(",")[0].trim() === "https";
}

async function getSessionOptions(): Promise<SessionOptions> {
  return {
    cookieName: SESSION_COOKIE,
    password: getSessionSecret(),
    ttl: SESSION_TTL_S,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: await isSecureRequest(),
    },
  };
}

/** Đọc session hiện tại. Chỉ ghi được (`save`/`destroy`) trong Route Handler hoặc Server Function. */
export async function getSession(): Promise<EspoSession> {
  return getIronSession<SessionData>(await cookies(), await getSessionOptions());
}

/** Thông tin đăng nhập trong session, hoặc `null` nếu chưa đăng nhập. */
export function getCredentials(session: SessionData): EspoCredentials | null {
  if (!session.userName || !session.token) {
    return null;
  }

  return {
    userName: session.userName,
    token: session.token,
    ...(session.secret ? { secret: session.secret } : {}),
  };
}

/** Dùng trong layout/page cần đăng nhập: chưa có session thì chuyển về `/login`. */
export async function requireCredentials(): Promise<EspoCredentials> {
  const credentials = getCredentials(await getSession());

  if (!credentials) {
    redirect("/login");
  }

  return credentials;
}

/** Bước 2FA đang chờ và chưa hết hạn. */
export function getPendingSecondStep(session: SessionData, now = Date.now()): PendingSecondStep | null {
  const step = session.secondStep;

  if (!step || step.expiresAt <= now) {
    return null;
  }

  return { userName: step.userName, authString: step.authString };
}

export async function startSecondStep(session: EspoSession, pending: PendingSecondStep): Promise<void> {
  clearCredentials(session);
  session.secondStep = { ...pending, expiresAt: Date.now() + SECOND_STEP_TTL_MS };

  await session.save();
}

/**
 * Lưu thông tin đăng nhập và chuyển cookie `auth-token-secret` cho trình duyệt (path=/),
 * để UI classic chạy cùng origin qua rewrite dùng được token này mà không phải đăng nhập lại.
 */
export async function saveCredentials(session: EspoSession, credentials: EspoCredentials): Promise<void> {
  clearCredentials(session);
  delete session.secondStep;
  Object.assign(session, credentials);

  await session.save();

  const cookieStore = await cookies();

  if (credentials.secret) {
    cookieStore.set(AUTH_TOKEN_SECRET_COOKIE, credentials.secret, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: await isSecureRequest(),
      // Giống Espo: +1000 ngày; token hết hạn thì Espo tự từ chối.
      maxAge: 1000 * 24 * 60 * 60,
    });
  } else {
    cookieStore.delete(AUTH_TOKEN_SECRET_COOKIE);
  }
}

/** Xoá session và cookie `auth-token-secret` (đăng xuất, hoặc Espo trả 401). */
export async function destroySession(session: EspoSession): Promise<void> {
  session.destroy();
  (await cookies()).delete(AUTH_TOKEN_SECRET_COOKIE);
}

function clearCredentials(session: EspoSession): void {
  delete session.userName;
  delete session.token;
  delete session.secret;
}
