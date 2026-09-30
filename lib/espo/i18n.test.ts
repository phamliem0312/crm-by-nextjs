import { describe, expect, it } from "vitest";
import { translate, type LanguageData } from "./i18n";

const data: LanguageData = {
  Global: {
    labels: { "Log in": "Đăng nhập", Password: "Mật khẩu" },
    messages: { error404: "Không tìm thấy" },
  },
  User: {
    messages: { wrongUsernamePassword: "Sai tên đăng nhập/mật khẩu" },
    labels: { Password: "Mật khẩu người dùng" },
  },
};

describe("translate", () => {
  it("defaults to Global labels", () => {
    expect(translate(data, "Log in")).toBe("Đăng nhập");
  });

  it("prefers the given scope", () => {
    expect(translate(data, "Password", "labels", "User")).toBe("Mật khẩu người dùng");
    expect(translate(data, "wrongUsernamePassword", "messages", "User")).toBe(
      "Sai tên đăng nhập/mật khẩu",
    );
  });

  it("falls back to Global when the scope has no such label", () => {
    expect(translate(data, "error404", "messages", "User")).toBe("Không tìm thấy");
  });

  it("returns the name when nothing matches", () => {
    expect(translate(data, "unknownLabel", "messages", "User")).toBe("unknownLabel");
    expect(translate({}, "Log in")).toBe("Log in");
  });

  it("does not read inherited object properties", () => {
    expect(translate(data, "constructor")).toBe("constructor");
  });
});
