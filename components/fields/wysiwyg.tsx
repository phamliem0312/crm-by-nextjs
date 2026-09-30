"use client";

// Field wysiwyg (HTML): hiển thị qua DOMPurify, sửa bằng TipTap (thay Summernote của classic).
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import { useMemo, type ReactNode } from "react";
import { TextSearch } from "./search-ui";
import type { FieldDisplayProps, FieldEditProps, FieldType } from "./types";

/** Làm sạch HTML trước khi hiển thị: bỏ script/handler; link mở tab mới an toàn. */
export function sanitizeHtml(html: string): string {
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ["target"] });
  const doc = new DOMParser().parseFromString(clean, "text/html");

  doc.querySelectorAll("a[href]").forEach((link) => {
    link.setAttribute("target", "_blank");
    link.setAttribute("rel", "noopener noreferrer");
  });

  return doc.body.innerHTML;
}

function WysiwygDisplay({ name, values, mode }: FieldDisplayProps) {
  const html = typeof values[name] === "string" ? (values[name] as string) : "";
  const clean = useMemo(() => (html && typeof window !== "undefined" ? sanitizeHtml(html) : ""), [html]);

  if (!html) {
    return null;
  }

  if (mode === "list") {
    // Danh sách: chỉ văn bản thuần.
    return <span className="line-clamp-2">{new DOMParser().parseFromString(clean, "text/html").body.textContent}</span>;
  }

  // HTML đã qua DOMPurify.
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: clean }} />;
}

function ToolbarButton({
  label,
  icon,
  active,
  onClick,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-md text-xs ${
        active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
      } disabled:opacity-40`}
    >
      {icon}
    </button>
  );
}

function Toolbar({ editor, t }: { editor: Editor; t: (key: string) => string }) {
  const chain = () => editor.chain().focus();

  return (
    <div className="flex flex-wrap gap-0.5 border-b border-slate-200 p-1" role="toolbar">
      <ToolbarButton label="Bold" icon={<i className="fas fa-bold" />} active={editor.isActive("bold")} onClick={() => chain().toggleBold().run()} />
      <ToolbarButton label="Italic" icon={<i className="fas fa-italic" />} active={editor.isActive("italic")} onClick={() => chain().toggleItalic().run()} />
      <ToolbarButton label="Underline" icon={<i className="fas fa-underline" />} active={editor.isActive("underline")} onClick={() => chain().toggleUnderline().run()} />
      <ToolbarButton label="Strike" icon={<i className="fas fa-strikethrough" />} active={editor.isActive("strike")} onClick={() => chain().toggleStrike().run()} />
      <span className="mx-1 w-px bg-slate-200" aria-hidden />
      <ToolbarButton label="Heading" icon={<i className="fas fa-heading" />} active={editor.isActive("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <ToolbarButton label="Bullet list" icon={<i className="fas fa-list-ul" />} active={editor.isActive("bulletList")} onClick={() => chain().toggleBulletList().run()} />
      <ToolbarButton label="Ordered list" icon={<i className="fas fa-list-ol" />} active={editor.isActive("orderedList")} onClick={() => chain().toggleOrderedList().run()} />
      <ToolbarButton label="Quote" icon={<i className="fas fa-quote-right" />} active={editor.isActive("blockquote")} onClick={() => chain().toggleBlockquote().run()} />
      <ToolbarButton
        label="Link"
        icon={<i className="fas fa-link" />}
        active={editor.isActive("link")}
        onClick={() => {
          const previous = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("URL", previous ?? "https://");

          if (url === null) {
            return;
          }

          if (url === "") {
            chain().extendMarkRange("link").unsetLink().run();

            return;
          }

          // Chỉ http(s)/mailto để tránh `javascript:`.
          if (/^(https?:|mailto:)/i.test(url)) {
            chain().extendMarkRange("link").setLink({ href: url }).run();
          }
        }}
      />
      <span className="mx-1 w-px bg-slate-200" aria-hidden />
      <ToolbarButton label={t("Undo")} icon={<i className="fas fa-undo" />} disabled={!editor.can().undo()} onClick={() => chain().undo().run()} />
      <ToolbarButton label={t("Redo")} icon={<i className="fas fa-redo" />} disabled={!editor.can().redo()} onClick={() => chain().redo().run()} />
    </div>
  );
}

function WysiwygEdit({ ctx, name, values, onChange, inputId, invalid, describedBy }: FieldEditProps) {
  const initial = typeof values[name] === "string" ? (values[name] as string) : "";

  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false, protocols: ["http", "https", "mailto"] } })],
    content: initial ? sanitizeHtml(initial) : "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id: inputId,
        role: "textbox",
        "aria-multiline": "true",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
        class: "rich-text min-h-40 px-3 py-2 outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onChange({ [name]: current.isEmpty ? null : current.getHTML() }),
  });

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-white shadow-xs focus-within:ring-4 ${
        invalid ? "border-red-500 focus-within:ring-red-500/15" : "border-slate-300 focus-within:border-blue-600 focus-within:ring-blue-600/15"
      }`}
    >
      {editor && <Toolbar editor={editor} t={(key) => ctx.t(key)} />}
      <EditorContent editor={editor} />
    </div>
  );
}

export const wysiwygField: FieldType = { Display: WysiwygDisplay, Edit: WysiwygEdit, Search: TextSearch, wide: true };
