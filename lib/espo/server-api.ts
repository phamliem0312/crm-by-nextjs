// Gọi API Espo từ Server Component bằng token trong session (không đi qua BFF).
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { buildTokenAuthHeaders, type EspoCredentials } from "./auth";
import { getEspoApiUrl } from "./config";
import { EspoApiError } from "./errors";
import { requireCredentials } from "./session";
import { PATHNAME_HEADER } from "./session-cookie";
import type { AppUserData } from "./types";

const TIMEOUT_MS = 30_000;

export async function espoServerGet<T>(credentials: EspoCredentials, path: string): Promise<T> {
  const response = await fetch(`${getEspoApiUrl()}/${path}`, {
    headers: buildTokenAuthHeaders(credentials),
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw await EspoApiError.fromResponse(response);
  }

  return (await response.json()) as T;
}

/** Trang hiện tại (proxy.ts ghi vào header), để quay lại sau khi đăng nhập lại. */
async function currentPath(): Promise<string> {
  return (await headers()).get(PATHNAME_HEADER) ?? "/";
}

/**
 * Dữ liệu bootstrap của người dùng (`GET App/user`, bỏ `token`). Gọi một lần mỗi request.
 * Token hết hạn/bị huỷ → chuyển qua /api/auth/expired để xoá session rồi về /login.
 */
export const getAppUser = cache(async (): Promise<AppUserData> => {
  const credentials = await requireCredentials();

  try {
    const data = await espoServerGet<AppUserData & { token?: string }>(credentials, "App/user");

    // Token không được gửi xuống client (nó đã nằm trong session HttpOnly).
    delete data.token;

    return data;
  } catch (e) {
    if (e instanceof EspoApiError && e.status === 401) {
      redirect(`/api/auth/expired?next=${encodeURIComponent(await currentPath())}`);
    }

    throw e;
  }
});
