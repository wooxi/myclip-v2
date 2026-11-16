/**
 * 受限的轻量 Markdown 渲染：返回 React 元素树，绝不使用 innerHTML，
 * 天然免疫 XSS（等价于白名单渲染）。
 * 支持：**粗体**、*斜体*、`行内代码`、链接、换行；其余按等宽纯文本展示。
 */
import { Fragment, type ReactNode } from "react";

type Token = ReactNode;

/** 把一段纯文本按 **bold** / *italic* / `code` / [text](url) 拆成 React 节点 */
function renderInline(text: string, keyPrefix: string): Token[] {
  const nodes: Token[] = [];
  // 顺序：code > link > bold > italic
  const pattern =
    /(`[^`\n]+`)|(\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const raw = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (raw.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono-text text-[0.9em]"
        >
          {raw.slice(1, -1)}
        </code>,
      );
    } else if (raw.startsWith("[")) {
      const label = raw.slice(1, raw.indexOf("]"));
      const href = raw.slice(raw.indexOf("(") + 1, -1);
      nodes.push(
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {label}
        </a>,
      );
    } else if (raw.startsWith("**")) {
      nodes.push(<strong key={key}>{raw.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{raw.slice(1, -1)}</em>);
    }
    last = m.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = (key: string) => {
    if (!listBuffer.length) return;
    blocks.push(
      <ul key={key} className="my-1 list-disc ps-5">
        {listBuffer.map((li, idx) => (
          <li key={`${key}-${idx}`}>{renderInline(li, `${key}-${idx}`)}</li>
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) {
      listBuffer.push(li[1]);
      return;
    }
    flushList(`list-${idx}`);
    if (line.trim() === "") {
      return;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const Tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      blocks.push(
        <Tag key={`h-${idx}`} className="font-semibold">
          {renderInline(h[2], `h-${idx}`)}
        </Tag>,
      );
      return;
    }
    blocks.push(
      <p key={`p-${idx}`} className="whitespace-pre-wrap break-words">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flushList("list-end");

  return (
    <div className="text-sm leading-relaxed">
      {blocks.length ? blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>) : null}
    </div>
  );
}
