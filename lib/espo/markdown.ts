// Markdown → HTML như `transformMarkdownText` của classic (view-helper @6965): xuống dòng giữ nguyên (`breaks`),
// không bảng, HTML thô trong văn bản bị escape thành chữ. Kết quả vẫn phải qua DOMPurify trước khi hiển thị
// (xem `components/ui/markdown.tsx`).
import { Marked, type Tokens } from "marked";

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

const marked = new Marked({
  breaks: true,
  gfm: true,
  tokenizer: {
    // Classic tắt bảng (`tables: false`).
    table: () => undefined,
  },
  renderer: {
    // HTML thô (khối hoặc thẻ inline) hiện thành chữ, như tokenizer `tag`/`html` của classic.
    html: (token: Tokens.HTML | Tokens.Tag) => escapeHtml(token.text),
  },
});

/** Trong `code`, classic bỏ escape `\<` (người dùng gõ `\<` để khỏi bị hiểu là thẻ). */
function prepare(text: string): string {
  return text.replace(/`([\s\S]*?)`/g, (_, code: string) => "`" + code.replace(/\\</g, "<") + "`");
}

export function markdownToHtml(text: string | null | undefined, options: { inline?: boolean } = {}): string {
  const source = prepare(text ?? "");

  return (options.inline ? marked.parseInline(source) : marked.parse(source)) as string;
}

export type Mention = { id: string; name: string };

/**
 * Thay `@username` trong post bằng link Markdown tới user (như `views/stream/fields/post`).
 * Tên dài xử lý trước để `@ann` không ăn mất một phần của `@anna`.
 */
export function applyMentions(text: string, mentions: Record<string, Mention>, userHref: (id: string) => string): string {
  const escapeMd = (value: string) => value.replace(/[[\]\\]/g, "\\$&");
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return Object.keys(mentions)
    .sort((a, b) => b.length - a.length)
    .reduce(
      (result, key) =>
        result.replace(new RegExp(`${escapeRegExp(key)}(?![\\w@-]|\\.\\w)`, "g"), `[${escapeMd(mentions[key].name)}](${userHref(mentions[key].id)})`),
      text,
    );
}
