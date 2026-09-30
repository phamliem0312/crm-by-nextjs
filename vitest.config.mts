import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Giống `paths` trong tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Múi giờ khác UTC để lộ lỗi parse ngày giờ theo giờ máy (CI thường chạy UTC nên sẽ che mất lỗi).
    env: { TZ: "Asia/Ho_Chi_Minh" },
  },
});
