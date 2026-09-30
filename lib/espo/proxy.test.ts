import { beforeEach, describe, expect, it } from "vitest";
import { BadPathError, buildEspoApiUrl } from "./proxy";

describe("buildEspoApiUrl", () => {
  beforeEach(() => {
    process.env.ESPO_URL = "http://localhost/espocrm-10-0-9/";
    delete process.env.ESPO_API_URL;
  });

  it("appends path and query to the API URL", () => {
    expect(buildEspoApiUrl(["Account", "123"], "?select=name")).toBe(
      "http://localhost/espocrm-10-0-9/api/v1/Account/123?select=name",
    );
  });

  it("encodes each segment", () => {
    expect(buildEspoApiUrl(["Account", "a b/c"])).toBe(
      "http://localhost/espocrm-10-0-9/api/v1/Account/a%20b%2Fc",
    );
  });

  it("uses ESPO_API_URL when set", () => {
    process.env.ESPO_API_URL = "http://api.test/v1/";

    expect(buildEspoApiUrl(["I18n"])).toBe("http://api.test/v1/I18n");
  });

  it.each([[[".."]], [["Account", "."]], [["Account", ""]]])(
    "rejects %j so requests cannot leave api/v1",
    (path) => {
      expect(() => buildEspoApiUrl(path)).toThrow(BadPathError);
    },
  );
});
