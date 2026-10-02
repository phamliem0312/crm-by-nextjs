"use client";

// Thân email: HTML hiện trong iframe sandbox (không chạy script, CSS của email không lẫn vào trang) sau khi
// làm sạch bằng DOMPurify; văn bản thuần giữ xuống dòng. Tương đương `views/email/fields/body` (useIframe).
import DOMPurify from "dompurify";
import { useEffect, useMemo, useRef, useState } from "react";

/** HTML email đã làm sạch, ảnh/đính kèm (`?entryPoint=…`) trỏ về Espo, link mở tab mới. */
export function emailDocument(html: string, espoBaseUrl: string): string {
  const clean = DOMPurify.sanitize(html, {
    WHOLE_DOCUMENT: false,
    ADD_TAGS: ["style"],
    ADD_ATTR: ["target"],
    FORBID_TAGS: ["form", "input", "button", "textarea", "select", "iframe", "object", "embed"],
  });
  const base = espoBaseUrl.replace(/"/g, "&quot;");

  return (
    `<!doctype html><html><head><meta charset="utf-8"><base href="${base}" target="_blank">` +
    "<style>body{margin:0;font:14px/1.5 system-ui,sans-serif;color:#0f172a;overflow-wrap:anywhere}" +
    "img{max-width:100%;height:auto}blockquote{margin:0 0 0 .5rem;padding-left:.75rem;border-left:3px solid #cbd5e1;color:#475569}" +
    "pre{white-space:pre-wrap}</style></head>" +
    `<body>${clean}</body></html>`
  );
}

export function EmailBody({ html, plain, isHtml, espoBasePath }: { html: string; plain: string; isHtml: boolean; espoBasePath: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(160);
  const srcDoc = useMemo(
    () => (isHtml && html && typeof window !== "undefined" ? emailDocument(html, new URL(`${espoBasePath}/`, window.location.href).href) : ""),
    [isHtml, html, espoBasePath],
  );

  // Co giãn theo nội dung (ảnh tải chậm cũng đo lại).
  useEffect(() => {
    const frame = ref.current;

    if (!frame || !srcDoc) {
      return;
    }

    let observer: ResizeObserver | null = null;
    const measure = () => {
      const doc = frame.contentDocument;

      if (doc?.body) {
        setHeight(Math.max(80, doc.documentElement.scrollHeight + 4));
      }
    };
    const onLoad = () => {
      measure();
      observer?.disconnect();

      const body = frame.contentDocument?.body;

      if (body && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(measure);
        observer.observe(body);
      }
    };

    frame.addEventListener("load", onLoad);

    // Đã tải xong trước khi gắn listener.
    if (frame.contentDocument?.readyState === "complete" && frame.contentDocument.body?.childNodes.length) {
      onLoad();
    }

    return () => {
      frame.removeEventListener("load", onLoad);
      observer?.disconnect();
    };
  }, [srcDoc]);

  if (!isHtml || !html) {
    return plain ? <div className="text-sm leading-relaxed break-words whitespace-pre-wrap text-slate-800">{plain}</div> : null;
  }

  return (
    <iframe
      ref={ref}
      title="Email"
      srcDoc={srcDoc}
      // Không `allow-scripts`: script trong email không chạy. `allow-same-origin` để đo chiều cao.
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className="w-full border-0"
      style={{ height }}
    />
  );
}
