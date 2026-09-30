# EspoCRM Next

Giao diện Next.js cho EspoCRM 10.0.9. Backend PHP của EspoCRM giữ nguyên, đóng vai trò API. Giao diện cũ ("classic") vẫn chạy song song cho các phần chưa chuyển.

## Chạy dự án

Yêu cầu: Node 22 trở lên, EspoCRM đã cài xong và chạy ở `ESPO_URL`.

```bash
cp .env.example .env.local   # sửa ESPO_URL nếu EspoCRM không ở http://localhost/espocrm-10-0-9
npm install
npm run dev                  # http://localhost:3000
```

## Cách hoạt động

| Đường dẫn trên Next.js | Đi tới | Tệp |
|---|---|---|
| `/api/espo/<route>` | `${ESPO_URL}/api/v1/<route>` (BFF proxy) | `app/api/espo/[...path]/route.ts`, `lib/espo/proxy.ts` |
| `/espocrm-10-0-9/...` | UI classic của EspoCRM, cùng origin với UI mới | `next.config.ts` (rewrites), `proxy.ts` |

Proxy chỉ chuyển tiếp một số header nhất định. Header `WWW-Authenticate` bị bỏ để trình duyệt không bật hộp thoại Basic Auth, và các đoạn path `.`/`..` bị chặn.

## Scripts

| Lệnh | Việc |
|---|---|
| `npm test` | Unit test (Vitest) |
| `npm run typecheck` / `npm run lint` | Kiểm tra kiểu / ESLint |
| `npm run gen:api-types` | Tải `/OpenApi` và sinh `types/espo/openapi.d.ts`. Cần `ESPO_ADMIN_USERNAME` và `ESPO_ADMIN_PASSWORD` trong `.env.local` |
| `npm run inventory:client-views` | Liệt kê các view JS tùy biến trong `clientDefs` vào `docs/inventory-client-views.md`. Đọc mã EspoCRM ở `ESPO_ROOT` (mặc định `../EspoCRM-10.0.9`) |

## Giấy phép

EspoCRM dùng AGPL-3.0. Giao diện phải giữ chữ "EspoCRM" (điều 7(b)), đã đặt ở footer trong `app/layout.tsx`.
