import { getClassicBasePath, getEspoApiUrl } from "./config";
import type { LanguageData } from "./i18n";

/** Các setting Espo trả cho người chưa đăng nhập (`GET Settings` không có auth). */
export type PublicSettings = {
  applicationName?: string;
  language?: string;
  logoSrc?: string;
  companyLogoId?: string;
  passwordRecoveryEnabled?: boolean;
};

async function fetchPublic<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${getEspoApiUrl()}/${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`Espo ${path} returned ${response.status}`);

      return null;
    }

    return (await response.json()) as T;
  } catch (e) {
    console.error(`Espo ${path} request failed`, e);

    return null;
  }
}

/** Bản dịch theo ngôn ngữ mặc định của hệ thống (dùng trước khi biết user). */
export async function fetchDefaultLanguage(): Promise<LanguageData> {
  return (await fetchPublic<LanguageData>("I18n?default=true")) ?? {};
}

export async function fetchPublicSettings(): Promise<PublicSettings> {
  return (await fetchPublic<PublicSettings>("Settings")) ?? {};
}

const DEFAULT_LOGO_SRC = "client/img/logo.svg";

/**
 * URL logo do admin đặt (giống `LoginView.getLogoSrc`), trỏ vào UI classic cùng origin.
 * Trả `null` với logo mặc định: chữ "Espo" trong đó màu trắng, làm cho navbar tối, không đọc được trên nền sáng.
 */
export function getCustomLogoUrl(settings: PublicSettings): string | null {
  const base = `${getClassicBasePath()}/`;

  if (settings.companyLogoId) {
    return `${base}?entryPoint=LogoImage&id=${encodeURIComponent(settings.companyLogoId)}`;
  }

  if (settings.logoSrc && settings.logoSrc !== DEFAULT_LOGO_SRC) {
    return base + settings.logoSrc;
  }

  return null;
}
