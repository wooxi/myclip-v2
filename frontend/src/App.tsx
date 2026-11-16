import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { useRoomRoute } from "@/hooks/use-room-route";
import { useTheme } from "@/hooks/use-theme";
import { useRoomItems } from "@/hooks/use-room-items";
import { RoomHeader } from "@/components/room-header";
import { RoomDialog } from "@/components/room-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { Composer } from "@/components/composer";
import { ItemList } from "@/components/item-list";
import { InstallPrompt } from "@/components/install-prompt";
import { uploadFiles, clearAbort } from "@/lib/upload";
import { api } from "@/api";
import { DEFAULT_CONFIG, applyConfig, type AppConfig } from "@/app-config";
import type { FilterGroup } from "@/lib/classify";
import type { TtlValue } from "@/types";
import { cn } from "@/lib/utils";

type MobileTab = "all" | "stream";

export default function App() {
  const { room, navigate } = useRoomRoute();
  const { theme, setTheme } = useTheme();
  const { items, error, wsStatus, wsPing, prepend, remove } = useRoomItems(room);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [ttl, setTtl] = useState<TtlValue>(null); // 默认永久
  const [mobileTab, setMobileTab] = useState<MobileTab>("all");
  const [filter, setFilter] = useState<FilterGroup>("all");
  const [query, setQuery] = useState("");
  // 首屏直接用默认值渲染，config 并行拉取，成功后热更新（失败静默保持默认）
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let alive = true;
    api
      .getConfig()
      .then((c) => {
        if (alive) {
          applyConfig(c);
          setConfig(c);
        }
      })
      .catch(() => {
        /* 拉取失败保持默认值，不打扰用户 */
      });
    return () => {
      alive = false;
    };
  }, []);
  // 移动分段条仅 <768px 生效；回到桌面布局时重置同屏
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileTab("all");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // 拖拽/粘贴批量上传时用 toast 显示分片进度（一个 toast 跟随整个批次）
  const progressToastId = useRef<string | number | null>(null);

  // 拖拽/粘贴入口：批量提交，进度聚合到单个 toast
  const handleFiles = useCallback(
    (files: File[]) => {
      void uploadFiles(room, files, ttl, config, {
        onCreated: prepend,
        onProgress: (file, percent) => {
          if (progressToastId.current === null) {
            progressToastId.current = toast.loading(`分片上传 ${file.name}`, {
              description: `${percent}%`,
            });
          } else {
            toast.loading(`分片上传 ${file.name}`, {
              id: progressToastId.current,
              description: `${percent}%`,
            });
          }
          if (percent >= 100 && progressToastId.current !== null) {
            toast.dismiss(progressToastId.current);
            progressToastId.current = null;
          }
        },
      }).finally(() => {
        for (const f of files) clearAbort(f.name);
        if (progressToastId.current !== null) {
          toast.dismiss(progressToastId.current);
          progressToastId.current = null;
        }
      });
    },
    [room, ttl, config, prepend],
  );

  /** 空状态"粘贴剪贴板并发送"：文本直接提交，剪贴板文件直传 */
  const handlePasteSend = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        try {
          const item = await api.postText(room, { content: text.trim(), ttl });
          prepend(item);
        } catch (e) {
          toast.error(`发送失败：${e instanceof Error ? e.message : e}`);
        }
        return;
      }
      const ciList = await navigator.clipboard.read();
      const files: File[] = [];
      for (const ci of ciList) {
        const type = ci.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await ci.getType(type);
          files.push(
            new File([blob], `clipboard.${type.split("/")[1] ?? "png"}`, { type }),
          );
        }
      }
      if (files.length) handleFiles(files);
      else toast.info("剪贴板为空");
    } catch {
      toast.error("无法读取系统剪贴板");
    }
  }, [room, ttl, prepend, handleFiles]);

  /** 清空房间：逐条删除（契约无批量接口） */
  const handleClearAll = useCallback(
    (ids: string[]) => {
      void (async () => {
        for (const id of ids) {
          try {
            await api.deleteItem(id);
            remove(id);
          } catch {
            toast.error("清空房间失败，请重试");
            return;
          }
        }
        toast.success("已清空当前房间");
      })();
    },
    [remove],
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <RoomHeader
        room={room}
        wsStatus={wsStatus}
        wsPing={wsPing}
        theme={theme}
        onThemeChange={setTheme}
        onSwitchRoom={() => setRoomDialogOpen(true)}
        onShare={() => setShareDialogOpen(true)}
        installSlot={<InstallPrompt />}
      />

      {/* <768px 双段切换条：同屏 / 仅接收流（+计数徽标） */}
      <div className="border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            type="button"
            aria-pressed={mobileTab === "all"}
            onClick={() => setMobileTab("all")}
            className={cn(
              "cursor-pointer rounded-lg py-1.5 text-xs transition-colors",
              mobileTab === "all"
                ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "font-medium text-slate-600 dark:text-slate-400",
            )}
          >
            发送与接收同屏
          </button>
          <button
            type="button"
            aria-pressed={mobileTab === "stream"}
            onClick={() => setMobileTab("stream")}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1.5 text-xs transition-colors",
              mobileTab === "stream"
                ? "bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white"
                : "font-medium text-slate-600 dark:text-slate-400",
            )}
          >
            <span>仅看接收流</span>
            <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-600 dark:bg-indigo-900 dark:text-indigo-300">
              {items?.length ?? 0}
            </span>
          </button>
        </div>
      </div>

      {/* 主区 12 栏：composer 5 栏 sticky + stream 7 栏 */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <section
            aria-label="发送"
            className={cn(
              "flex flex-col gap-4 lg:col-span-5 lg:sticky lg:top-24",
              mobileTab === "stream" && "hidden md:block",
            )}
          >
            <Composer
              room={room}
              config={config}
              ttl={ttl}
              onTtlChange={setTtl}
              onCreated={prepend}
              onFilesChosen={handleFiles}
            />
          </section>

          <section aria-label="历史" className="min-w-0 lg:col-span-7">
            <h2 className="sr-only">历史条目</h2>
            <ItemList
              items={items}
              loading={items === null}
              error={error}
              onDeleted={remove}
              onClearAll={handleClearAll}
              filter={filter}
              onFilterChange={setFilter}
              query={query}
              onQueryChange={setQuery}
              onFiles={handleFiles}
              onPasteSend={() => void handlePasteSend()}
            />
          </section>
        </div>
      </main>

      <RoomDialog
        currentRoom={room}
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        onJoin={(r) => navigate(r)}
      />
      <ShareDialog
        room={room}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast:
              "!rounded-xl !border !border-slate-200 dark:!border-slate-800 !shadow-md !text-xs font-medium",
          },
        }}
      />
    </div>
  );
}
