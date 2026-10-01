"use client";

// Hiển thị Markdown (field text, post của Stream) đã qua DOMPurify.
import DOMPurify from "dompurify";
import { useMemo } from "react";
import { markdownToHtml } from "@/lib/espo/markdown";

/** Làm sạch HTML sinh từ Markdown. Link ngoài mở tab mới; link nội bộ (`/…`) giữ nguyên tab. */
export function sanitizeMarkdownHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    // Classic cấm `data-handler`/`data-action` (tránh kích hoạt hành động của UI); thêm `style` cho gọn giao diện.
    FORBID_ATTR: ["data-handler", "data-action", "style"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");

  doc.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") ?? "";

    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });

  doc.querySelectorAll("ol[start]").forEach((list) => {
    // Như classic: bỏ số bắt đầu quá lớn (danh sách kiểu "2026. …").
    if (Number(list.getAttribute("start")) > 99) {
      list.removeAttribute("start");
    }
  });

  return doc.body.innerHTML;
}

export function Markdown({
  text,
  inline = false,
  className = "",
}: {
  text: string;
  inline?: boolean;
  className?: string;
}) {
  // Khi render phía server không có DOM để sanitize → chỉ render phía trình duyệt.
  const html = useMemo(
    () => (typeof window === "undefined" ? "" : sanitizeMarkdownHtml(markdownToHtml(text, { inline }))),
    [text, inline],
  );

  const Tag = inline ? "span" : "div";

  // HTML đã qua DOMPurify.
  return <Tag className={`rich-text markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
