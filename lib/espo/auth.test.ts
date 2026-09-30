import { describe, expect, it } from "vitest";
import {
  buildTokenAuthHeaders,
  encodeAuthString,
  parseSecretFromSetCookie,
  readLoginResponse,
} from "./auth";

function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...Object.fromEntries(new Headers(headers)) },
  });
}

describe("encodeAuthString", () => {
  it("encodes UTF-8 like js-base64", () => {
    expect(encodeAuthString("admin", "pass")).toBe("YWRtaW46cGFzcw==");
    expect(Buffer.from(encodeAuthString("người", "mật:khẩu"), "base64").toString("utf8")).toBe(
      "người:mật:khẩu",
    );
  });
});

describe("buildTokenAuthHeaders", () => {
  it("sends the token and the secret cookie", () => {
    expect(buildTokenAuthHeaders({ userName: "admin", token: "tok", secret: "s/1" })).toEqual({
      "Espo-Authorization": encodeAuthString("admin", "tok"),
      "Espo-Authorization-By-Token": "true",
      Cookie: "auth-token-secret=s%2F1",
    });
  });

  it("omits the cookie when there is no secret", () => {
    expect(buildTokenAuthHeaders({ userName: "admin", token: "tok" })).not.toHaveProperty("Cookie");
  });
});

describe("parseSecretFromSetCookie", () => {
  it("reads the secret", () => {
    expect(
      parseSecretFromSetCookie([
        "other=1; path=/",
        "auth-token-secret=abc%2Bdef; path=/; expires=Wed, 01 Jan 2029 00:00:00 GMT; HttpOnly; SameSite=Lax",
      ]),
    ).toBe("abc+def");
  });

  it("treats `deleted` as removal", () => {
    expect(parseSecretFromSetCookie(["auth-token-secret=deleted; path=/"])).toBeNull();
  });

  it("returns undefined when absent", () => {
    expect(parseSecretFromSetCookie(["other=1"])).toBeUndefined();
  });
});

describe("readLoginResponse", () => {
  const authString = encodeAuthString("admin", "pass");

  it("returns credentials on success", async () => {
    const response = jsonResponse(
      200,
      { user: { userName: "Admin" }, token: "tok" },
      { "Set-Cookie": "auth-token-secret=sec; path=/; HttpOnly" },
    );

    expect(await readLoginResponse(response, "admin", authString)).toEqual({
      status: "success",
      credentials: { userName: "Admin", token: "tok", secret: "sec" },
    });
  });

  it("fails when the success body has no token", async () => {
    expect(await readLoginResponse(jsonResponse(200, { user: {} }), "admin", authString)).toEqual({
      status: "fail",
      reason: "error",
    });
  });

  it("asks for the second step with the temporary token", async () => {
    const response = jsonResponse(
      401,
      { message: "enterTotpCode", token: "tmp" },
      { "X-Status-Reason": "second-step-required" },
    );

    expect(await readLoginResponse(response, "admin", authString)).toEqual({
      status: "second-step",
      pending: { userName: "admin", authString: encodeAuthString("admin", "tmp") },
      message: "enterTotpCode",
    });
  });

  it("reuses the first-step auth string when there is no temporary token", async () => {
    const response = jsonResponse(401, { message: null }, { "X-Status-Reason": "second-step-required" });

    expect(await readLoginResponse(response, "admin", authString)).toMatchObject({
      pending: { authString },
      message: null,
    });
  });

  it("maps 401 to wrong credentials or wrong code", async () => {
    expect(await readLoginResponse(new Response(null, { status: 401 }), "a", authString)).toEqual({
      status: "fail",
      reason: "wrong-credentials",
    });
    expect(await readLoginResponse(new Response(null, { status: 401 }), "a", authString, true)).toEqual({
      status: "fail",
      reason: "wrong-code",
    });
  });

  it("maps X-Status-Reason: error", async () => {
    const response = new Response(null, { status: 401, headers: { "X-Status-Reason": "error" } });

    expect(await readLoginResponse(response, "a", authString)).toEqual({ status: "fail", reason: "error" });
  });

  it("passes on the message of other errors", async () => {
    const response = jsonResponse(503, { message: "Maintenance" });

    expect(await readLoginResponse(response, "a", authString)).toEqual({
      status: "fail",
      reason: "error",
      message: "Maintenance",
    });
  });
});
