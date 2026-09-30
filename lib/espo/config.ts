function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** URL gốc của EspoCRM, ví dụ `http://localhost/espocrm-10-0-9`. */
export function getEspoUrl(): string {
  const value = process.env.ESPO_URL;

  if (!value) {
    throw new Error("Missing environment variable ESPO_URL.");
  }

  return trimTrailingSlash(value);
}

/** Đường dẫn của UI classic trên cùng origin với Next.js (xem rewrite trong next.config.ts). */
export function getClassicBasePath(): string {
  return new URL(getEspoUrl()).pathname.replace(/\/+$/, "");
}

/** URL gốc của REST API, mặc định `${ESPO_URL}/api/v1`. */
export function getEspoApiUrl(): string {
  const value = process.env.ESPO_API_URL;

  return value ? trimTrailingSlash(value) : `${getEspoUrl()}/api/v1`;
}
