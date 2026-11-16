import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PWA 安装提示：捕获 beforeinstallprompt，浏览器确认可提示时才显示按钮；
 * 不支持安装机制的浏览器保持隐藏（优雅降级）。
 */
export function InstallPrompt() {
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
    <Button variant="outline" size="sm" onClick={() => void install()}>
      <Download aria-hidden="true" />
      安装
    </Button>
  );
}
