import type { NextRequest } from "next/server";
import { getEspoApiUrl } from "./config";

/** Khớp với `ajaxTimeout` của UI classic. */
const TIMEOUT_MS = 60_000;

/** Header của trình duyệt được chuyển tiếp sang Espo. Auth do BFF tự gắn, không lấy từ trình duyệt. */
const FORWARDED_REQUEST_HEADERS = ["accept", "accept-language", "content-type"];

/**
 * Header của Espo được trả lại cho trình duyệt. Không trả `WWW-Authenticate`,
 * nếu không trình duyệt sẽ bật hộp thoại Basic Auth khi nhận 401.
 */
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "content-disposition",
  "x-app-timestamp",
  "x-status-reason",
];

export class BadPathError extends Error {}

/** Ghép các đoạn path thành URL API; chặn `.`/`..` để không thoát ra ngoài `api/v1`. */
export function buildEspoApiUrl(path: string[], search = ""): string {
  if (path.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new BadPathError(`Bad path: ${path.join("/")}`);
  }

  return `${getEspoApiUrl()}/${path.map(encodeURIComponent).join("/")}${search}`;
}

/**
 * Chuyển tiếp một request tới REST API của Espo.
 *
 * @param extraHeaders Header bổ sung (giai đoạn 1: header xác thực lấy từ session).
 */
export async function forwardToEspo(
  request: NextRequest,
  path: string[],
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  let url: string;

  try {
    url = buildEspoApiUrl(path, request.nextUrl.search);
  } catch (e) {
    if (e instanceof BadPathError) {
      return Response.json({ message: e.message }, { status: 400 });
    }

    throw e;
  }

  const headers = new Headers(extraHeaders);

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  let espoResponse: Response;

  try {
    espoResponse = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`Espo request failed: ${request.method} ${url}`, e);

    return Response.json({ message: "EspoCRM is unreachable." }, { status: 502 });
  }

  const responseHeaders = new Headers();

  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = espoResponse.headers.get(name);

    if (value !== null) {
      responseHeaders.set(name, value);
    }
  }

  return new Response(espoResponse.body, {
    status: espoResponse.status,
    headers: responseHeaders,
  });
}
