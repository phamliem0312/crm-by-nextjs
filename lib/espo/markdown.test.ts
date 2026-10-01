import { describe, expect, it } from "vitest";
import { applyMentions, escapeHtml, markdownToHtml } from "./markdown";

describe("markdownToHtml (port transformMarkdownText)", () => {
  it("renders basic syntax with line breaks", () => {
    expect(markdownToHtml("**bold** and *em*\nnext line")).toBe("<p><strong>bold</strong> and <em>em</em><br>next line</p>\n");
    expect(markdownToHtml("~~gone~~", { inline: true })).toBe("<del>gone</del>");
    expect(markdownToHtml("> quote")).toContain("<blockquote>");
  });

  it("escapes raw HTML instead of rendering it", () => {
    expect(markdownToHtml("<b>x</b> <script>alert(1)</script>", { inline: true })).toBe(
      "&lt;b&gt;x&lt;/b&gt; &lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(markdownToHtml('<div onclick="x()">block</div>')).not.toContain("<div");
  });

  it("does not render tables (disabled in classic)", () => {
    expect(markdownToHtml("| a | b |\n|---|---|\n| 1 | 2 |")).not.toContain("<table");
  });

  it("unescapes \\< inside code like classic", () => {
    expect(markdownToHtml("`a \\< b`", { inline: true })).toBe("<code>a &lt; b</code>");
  });

  it("handles empty input", () => {
    expect(markdownToHtml(null)).toBe("");
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("applyMentions", () => {
  const mentions = {
    "@ann": { id: "u1", name: "Ann" },
    "@anna": { id: "u2", name: "Anna [PM]" },
  };

  it("links mentions, longest first, and escapes names", () => {
    expect(applyMentions("hi @anna and @ann.", mentions, (id) => `/u/${id}`)).toBe(
      "hi [Anna \\[PM\\]](/u/u2) and [Ann](/u/u1).",
    );
  });

  it("does not touch partial words", () => {
    expect(applyMentions("mail @annabel", mentions, (id) => id)).toBe("mail @annabel");
  });
});
