import { z } from "zod";
import { loginWithCode, loginWithPassword, type LoginResult } from "@/lib/espo/auth";
import type { LoginResponseBody } from "@/lib/espo/login-api";
import {
  getPendingSecondStep,
  getSession,
  saveCredentials,
  startSecondStep,
  type EspoSession,
} from "@/lib/espo/session";

const bodySchema = z.union([
  z.object({
    userName: z.string().trim().min(1).max(255),
    password: z.string().max(1000),
  }),
  z.object({
    // Giống classic: bỏ mọi khoảng trắng trong mã.
    code: z.string().transform((value) => value.replace(/\s/g, "")).pipe(z.string().min(1).max(100)),
  }),
]);

async function respond(session: EspoSession, result: LoginResult): Promise<Response> {
  switch (result.status) {
    case "success":
      await saveCredentials(session, result.credentials);

      return Response.json({ status: "success" } satisfies LoginResponseBody);

    case "second-step":
      await startSecondStep(session, result.pending);

      return Response.json({ status: "second-step", message: result.message } satisfies LoginResponseBody);

    case "fail":
      return Response.json(
        { status: "fail", reason: result.reason, message: result.message } satisfies LoginResponseBody,
        { status: result.reason === "unreachable" ? 502 : 401 },
      );
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ status: "fail", reason: "bad-request" } satisfies LoginResponseBody, {
      status: 400,
    });
  }

  const session = await getSession();

  if ("code" in body) {
    const pending = getPendingSecondStep(session);

    if (!pending) {
      // Hết hạn hoặc chưa qua bước 1: form quay lại bước nhập mật khẩu.
      return Response.json({ status: "fail", reason: "second-step-expired" } satisfies LoginResponseBody, {
        status: 401,
      });
    }

    return respond(session, await loginWithCode(pending, body.code));
  }

  return respond(session, await loginWithPassword(body.userName, body.password));
}
