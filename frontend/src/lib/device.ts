/**
 * 来源设备显示名派生（API.md source 字段，服务端截断 64 字符）。
 * 例："Chrome · macOS"、"Safari · iPhone"。
 */
export function detectDevice(): string {
  const ua = navigator.userAgent;

  // 浏览器
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";

  // 平台：桌面端按 UA 平台段，移动端取系统名
  let platform = "Web";
  if (/iPhone/i.test(ua)) platform = "iPhone";
  else if (/iPad/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    platform = "iPad";
  else if (/Android/i.test(ua)) platform = "Android";
  else if (/Macintosh/i.test(ua)) platform = "macOS";
  else if (/Windows/i.test(ua)) platform = "Windows";
  else if (/CrOS/i.test(ua)) platform = "ChromeOS";
  else if (/Linux/i.test(ua)) platform = "Linux";

  return `${browser} · ${platform}`;
}
