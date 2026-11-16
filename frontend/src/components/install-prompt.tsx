import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PWA 安装提示：捕获 beforeinstallprompt，浏览器确认可提示时才显示按钮；
 * 不支持安装机制的浏览器保持隐藏（优雅降级）。顶栏按钮样式。
 */
export function InstallPrompt({ className }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<
    (Event & { prompt: () => Promise<void> }) | null
  >(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as Event & { prompt: () => Promise<void> });
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    const ev = promptEvent;
    setPromptEvent(null);
    await ev.prompt();
  };

  return (
    <button
      type="button"
      onClick={() => void install()}
      title="安装 MyClip 到桌面或主屏幕"
      className={cn(
        "hidden h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-100 px-2.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:inline-flex",
        className,
      )}
    >
      <Download className="size-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      <span className="hidden sm:inline">安装应用</span>
    </button>
  );
}
