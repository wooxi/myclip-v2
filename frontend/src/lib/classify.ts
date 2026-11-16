/**
 * 文本类型识别（纯前端）：link / code / text。
 * 规则与参考稿一致：http(s) 开头 → 链接；
 * 含 docker /npm /git /{ /function /const / 或缩进块 → 代码。
 */
export type TextKind = "link" | "code" | "text";

export function classifyText(raw: string): TextKind {
  const s = raw.trim();
  if (/^https?:\/\/\S+/i.test(s)) return "link";
  if (
    /docker |npm |git |pnpm |curl |{|\bfunction\b|\bconst \b|=>|\n\s{2,}\S/m.test(
      raw,
    )
  ) {
    return "code";
  }
  return "text";
}

/** 条目正文内容类型（条目卡与筛选 tabs 共用） */
export type ItemKind = "link" | "code" | "text" | "file";

export function classifyItem(item: {
  kind: "text" | "file";
  content?: string;
}): ItemKind {
  if (item.kind === "file") return "file";
  return classifyText(item.content ?? "");
}

/** 筛选 tab 分组：text/code/file/link 各归各 tab（2026-11-16 手机端实测拆分） */
export type FilterGroup = "all" | "text" | "code" | "file" | "link";

export function inFilterGroup(kind: ItemKind, group: FilterGroup): boolean {
  if (group === "all") return true;
  return kind === group;
}
