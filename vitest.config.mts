import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Múi giờ khác UTC để lộ lỗi parse ngày giờ theo giờ máy (CI thường chạy UTC nên sẽ che mất lỗi).
    env: { TZ: "Asia/Ho_Chi_Minh" },
  },
});
