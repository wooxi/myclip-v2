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

/** 筛选 tab 分组：text 组含文本与代码；file 组含文件图片；link 单列 */
export type FilterGroup = "all" | "text" | "file" | "link";

export function inFilterGroup(kind: ItemKind, group: FilterGroup): boolean {
  if (group === "all") return true;
  if (group === "text") return kind === "text" || kind === "code";
  if (group === "file") return kind === "file";
  return kind === "link";
}
