"use client";

import { useEffect } from "react";

type Props = {
  /** `base64(userName:token)`, đúng giá trị classic lưu ở `espo-user-auth`. */
  auth: string;
  token: string;
  userId: string;
  /** URL UI classic cùng origin, ví dụ `/espocrm-10-0-9/#Admin`. */
  target: string;
};

/** Khoá localStorage của classic: `Storage` prefix `espo` + type + name. */
const AUTH_KEY = "espo-user-auth";
const LAST_USER_KEY = "espo-user-lastUserId";

/** Cache của classic (lớp `Cache`, prefix `cache`): metadata, ngôn ngữ… của user trước. */
const CLASSIC_CACHE_PATTERN = /^cache-/;

function writeClassicAuth({ auth, token, userId }: Omit<Props, "target">) {
  try {
    // Giống `App.initAuth` khi nhận sự kiện login: đổi user thì xoá cache metadata/ngôn ngữ.
    if (localStorage.getItem(LAST_USER_KEY) !== userId) {
      for (const key of Object.keys(localStorage)) {
        if (CLASSIC_CACHE_PATTERN.test(key)) {
          localStorage.removeItem(key);
        }
      }
    }

    // Chuỗi thường (không `__JSON__:`), đúng cách `Storage.set` lưu giá trị string.
    localStorage.setItem(AUTH_KEY, auth);
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // localStorage bị chặn: classic sẽ hiện màn đăng nhập của nó.
  }

  // Giống `App.setCookieAuth`: entry point (ảnh, file) xác thực bằng cookie này.
  const expires = new Date(Date.now() + 1000 * 24 * 60 * 60 * 1000).toUTCString();
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `auth-token=${token}; SameSite=Lax; expires=${expires}; path=/${secure}`;
}

export function ClassicRedirect({ auth, token, userId, target }: Props) {
  useEffect(() => {
    writeClassicAuth({ auth, token, userId });
    window.location.replace(target);
  }, [auth, token, userId, target]);

  return (
    <main className="flex flex-1 items-center justify-center" aria-busy>
      <svg viewBox="0 0 24 24" className="size-6 animate-spin text-blue-600" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <noscript>
        <a href={target}>EspoCRM Classic</a>
      </noscript>
    </main>
  );
}
