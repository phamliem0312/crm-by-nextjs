import { describe, expect, it } from "vitest";
import i18nFixture from "./__fixtures__/i18n.json";
import { EspoApiError, describeEspoError } from "./errors";
import { createTranslator, type LanguageData } from "./i18n";

const t = createTranslator(i18nFixture as unknown as LanguageData);

describe("EspoApiError.fromResponse", () => {
  it("keeps status, reason and JSON body", async () => {
    const error = await EspoApiError.fromResponse(
      new Response(JSON.stringify({ messageTranslation: { label: "x" } }), {
        status: 409,
        headers: { "X-Status-Reason": "Duplicate" },
      }),
    );

    expect(error.status).toBe(409);
    expect(error.statusReason).toBe("Duplicate");
    expect(error.body).toEqual({ messageTranslation: { label: "x" } });
  });

  it("reads the duplicate list of a 409", async () => {
    const error = await EspoApiError.fromResponse(
      new Response(JSON.stringify([{ id: "1", name: "Acme" }]), {
        status: 409,
        headers: { "X-Status-Reason": "duplicate" },
      }),
    );

    expect(error.isDuplicate).toBe(true);
    expect(error.list).toEqual([{ id: "1", name: "Acme" }]);
  });

  it("ignores non-JSON bodies", async () => {
    const error = await EspoApiError.fromResponse(new Response("<h1>Error</h1>", { status: 500 }));

    expect(error.body).toBeNull();
  });
});

describe("describeEspoError", () => {
  it("translates messageTranslation with data", () => {
    const error = new EspoApiError(403, null, {
      messageTranslation: { label: "fieldIsRequired", scope: null, data: { field: "Name" } },
    });

    expect(describeEspoError(error, t)).toEqual({
      title: t("Access denied"),
      detail: t("fieldIsRequired", "messages").replaceAll("{field}", "Name"),
    });
  });

  it("falls back to message, then X-Status-Reason", () => {
    expect(describeEspoError(new EspoApiError(400, "Bad field", { message: "Oops" }), t).detail).toBe("Oops");
    expect(describeEspoError(new EspoApiError(409, "Duplicate", null), t)).toEqual({
      title: t("Conflict"),
      detail: "Duplicate",
    });
  });

  it("does not show details for 404", () => {
    expect(describeEspoError(new EspoApiError(404, "No record", { message: "x" }), t)).toEqual({
      title: t("Not found"),
      detail: null,
    });
  });

  it("handles server and network errors", () => {
    expect(describeEspoError(new EspoApiError(500, null), t)).toEqual({
      title: t("Internal server error"),
      detail: t("checkLogsForDetails", "messages"),
    });
    expect(describeEspoError(new EspoApiError(418, null), t).title).toBe(`${t("Error")} 418`);
    expect(describeEspoError(new TypeError("fetch failed"), t).title).toBe(t("Network error"));
  });
});
