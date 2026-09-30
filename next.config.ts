import type { NextConfig } from "next";

const espoUrl = (process.env.ESPO_URL ?? "").replace(/\/+$/, "");

// Đường dẫn của UI classic trên Espo, ví dụ `/espocrm-10-0-9`. Proxy nó qua Next.js để
// UI classic và UI mới dùng chung một origin (chung cookie + localStorage, khỏi đăng nhập lại).
const classicBasePath = espoUrl ? new URL(espoUrl).pathname.replace(/\/+$/, "") : "";

const nextConfig: NextConfig = {
  // UI classic tự chuyển `/espocrm-10-0-9` sang `/espocrm-10-0-9/`; nếu Next.js bỏ dấu "/" ở cuối thì sẽ lặp vô hạn.
  skipTrailingSlashRedirect: true,

  async rewrites() {
    if (!classicBasePath) {
      return [];
    }

    return [
      // Gốc phải trỏ tới URL có "/" ở cuối; `:path*` rỗng sẽ bỏ mất nó và Espo lại redirect về chính URL này.
      // Dạng không có "/" ở cuối đã được proxy.ts redirect trước khi tới đây.
      {
        source: classicBasePath,
        destination: `${espoUrl}/`,
      },
      // `:path+` bỏ mất "/" ở cuối, mà classic gọi `api/v1/` (có "/") lúc khởi động và Espo trả 404
      // cho `api/v1` → classic đứng ở màn hình trống. Rule này giữ nguyên "/" ở cuối.
      {
        source: `${classicBasePath}/:path+/`,
        destination: `${espoUrl}/:path+/`,
      },
      {
        source: `${classicBasePath}/:path+`,
        destination: `${espoUrl}/:path+`,
      },
    ];
  },
};

export default nextConfig;
