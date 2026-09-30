// Chuyển lỗi của API Espo thành thông báo có dịch. Port từ `App.setupAjax` / `_processErrorAlert`
// của UI classic (espo-main.js @51287, @51373).
import { interpolate, type Translator } from "./i18n";

export type EspoErrorBody = {
  message?: string;
  messageTranslation?: {
    label?: string;
    scope?: string | null;
    data?: Record<string, string | number> | null;
  } | null;
  [key: string]: unknown;
};

/** Lỗi khi gọi API Espo qua BFF, giữ lại status, `X-Status-Reason` và body JSON (nếu có). */
export class EspoApiError extends Error {
  constructor(
    readonly status: number,
    readonly statusReason: string | null,
    readonly body: EspoErrorBody | null = null,
  ) {
    super(`Espo API error ${status}${statusReason ? `: ${statusReason}` : ""}`);
    this.name = "EspoApiError";
  }

  static async fromResponse(response: Response): Promise<EspoApiError> {
    let body: EspoErrorBody | null = null;

    try {
      const text = await response.text();

      if (text.startsWith("{")) {
        body = JSON.parse(text) as EspoErrorBody;
      }
    } catch {
      body = null;
    }

    return new EspoApiError(response.status, response.headers.get("X-Status-Reason"), body);
  }
}

/** Tiêu đề lỗi theo status, giống classic. */
const STATUS_LABELS: Record<number, string> = {
  400: "Bad request",
  403: "Access denied",
  404: "Not found",
  409: "Conflict",
};

export type ErrorMessage = {
  /** Dòng tiêu đề, ví dụ "Access denied" (đã dịch). */
  title: string;
  /** Chi tiết (đã dịch) từ `messageTranslation`, `message` hoặc `X-Status-Reason`. */
  detail: string | null;
};

/**
 * Tạo thông báo cho một lỗi API. 404 không kèm chi tiết (classic cũng vậy).
 * Lỗi mạng (không phải `EspoApiError`) → "Network error".
 */
export function describeEspoError(error: unknown, t: Translator): ErrorMessage {
  if (!(error instanceof EspoApiError)) {
    return { title: t("Network error"), detail: null };
  }

  const { status, statusReason, body } = error;
  let title: string;

  if (STATUS_LABELS[status]) {
    title = t(STATUS_LABELS[status]);
  } else if (status === 500) {
    title = t("Internal server error");
  } else if (status === 502) {
    title = t("Network error");
  } else {
    title = `${t("Error")} ${status}`;
  }

  if (status === 404) {
    return { title, detail: null };
  }

  const translation = body?.messageTranslation;

  if (translation?.label) {
    const text = t(translation.label, "messages", translation.scope ?? undefined);

    return { title, detail: interpolate(text, translation.data ?? {}) };
  }

  if (typeof body?.message === "string" && body.message) {
    return { title, detail: body.message };
  }

  if (status === 500) {
    return { title, detail: t("checkLogsForDetails", "messages") };
  }

  return { title, detail: statusReason };
}
