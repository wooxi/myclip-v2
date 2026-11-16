import { useCallback, useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "myclip-theme";

/** 主题：三态切换（system/light/dark），默认暗色优先 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  });

  const apply = useCallback((t: Theme) => {
    const dark =
      t === "dark" ||
      (t === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    localStorage.setItem(KEY, theme);
    apply(theme);
    // 系统偏好变化时自动跟随
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (theme === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme, apply]);

  return { theme, setTheme };
}
