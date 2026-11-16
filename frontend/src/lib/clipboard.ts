/**
 * execCommand('copy') 兜底：仅在 navigator.clipboard 缺失或写入被拒时使用，
 * 必须同步运行在用户手势处理器内。
 */
export function legacyCopyText(text: string): boolean {
  if (!text) return false;
  const field = Object.assign(document.createElement("textarea"), { value: text });
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;opacity:0";
  document.body.append(field);
  field.select();
  try {
    return document.execCommand("copy");
  } finally {
    field.remove();
  }
}
