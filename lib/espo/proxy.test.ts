import { beforeEach, describe, expect, it } from "vitest";
import { BadPathError, buildEspoApiUrl, cacheControlFor } from "./proxy";

describe("cacheControlFor", () => {
  const params = (query: string) => new URLSearchParams(query);

  it("caches Metadata and I18n only with a cacheKey", () => {
    expect(cacheControlFor("GET", ["Metadata"], params("cacheKey=u1-123"), 200)).toContain("max-age=31536000");
    expect(cacheControlFor("GET", ["I18n"], params("language=vi_VN&cacheKey=u1-123"), 200)).toContain("private");
    expect(cacheControlFor("GET", ["Metadata"], params(""), 200)).toBe("no-store");
  });

  it("never caches other routes, other methods or errors", () => {
    expect(cacheControlFor("GET", ["Account"], params("cacheKey=x"), 200)).toBe("no-store");
    expect(cacheControlFor("POST", ["Metadata"], params("cacheKey=x"), 200)).toBe("no-store");
    expect(cacheControlFor("GET", ["Metadata"], params("cacheKey=x"), 401)).toBe("no-store");
    expect(cacheControlFor("GET", ["Metadata", "x"], params("cacheKey=x"), 200)).toBe("no-store");
  });
});

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
