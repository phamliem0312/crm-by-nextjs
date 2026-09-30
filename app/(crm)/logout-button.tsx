"use client";

import { useState } from "react";
import { requestLogout } from "@/lib/espo/login-api";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);

    try {
      await requestLogout();
    } finally {
      // Tải lại hẳn trang (không dùng router) để bỏ mọi dữ liệu của user cũ còn trong bộ nhớ client.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="rounded-md px-2 py-1 text-zinc-700 hover:bg-zinc-100 disabled:opacity-60 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      Log Out
    </button>
  );
}
