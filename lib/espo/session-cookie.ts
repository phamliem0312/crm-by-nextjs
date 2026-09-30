/** Tên cookie session; tách riêng để proxy.ts dùng mà không kéo theo iron-session/next/headers. */
export const SESSION_COOKIE = "espo-next-session";

/** Cookie `auth-token` mà UI classic đặt (không HttpOnly), dùng cho entry point như tải ảnh, file. */
export const CLASSIC_AUTH_TOKEN_COOKIE = "auth-token";

/** Header proxy.ts gắn vào request: đường dẫn hiện tại, để layout biết trang cần quay lại. */
export const PATHNAME_HEADER = "x-espo-next-pathname";
