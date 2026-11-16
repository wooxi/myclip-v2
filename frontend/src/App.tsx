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
import { DropOverlay } from "@/components/drop-overlay";
import { InstallPrompt } from "@/components/install-prompt";
import { uploadFiles, clearAbort } from "@/lib/upload";
import { api } from "@/api";
import { DEFAULT_CONFIG, applyConfig, type AppConfig } from "@/app-config";
import type { TtlValue } from "@/types";

export default function App() {
  const { room, navigate } = useRoomRoute();
  const { theme, setTheme } = useTheme();
  const { items, error, wsStatus, prepend, remove } = useRoomItems(room);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [ttl, setTtl] = useState<TtlValue>(null); // 默认永久
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

  return (
    <div className="min-h-dvh">
      <RoomHeader
        room={room}
        wsStatus={wsStatus}
        isMock={api.isMock}
        theme={theme}
        onThemeChange={setTheme}
        onSwitchRoom={() => setRoomDialogOpen(true)}
        onShare={() => setShareDialogOpen(true)}
      />

      <main className="mx-auto w-full max-w-5xl px-3 pb-16 pt-4 md:px-6 xl:max-w-[1400px] 2xl:max-w-[1600px]">
        {/* ≥768px 双栏：左输入（sticky）右历史；≥1280px 输入列 360~420px，历史列铺满剩余 */}
        <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] md:items-start xl:grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
          <section aria-label="发送" className="flex flex-col gap-3 md:sticky md:top-16">
            <Composer
              room={room}
              config={config}
              ttl={ttl}
              onTtlChange={setTtl}
              onCreated={prepend}
              onFilesChosen={handleFiles}
            />
            <div className="hidden md:block">
              <InstallPrompt />
            </div>
          </section>

          <section aria-label="历史" className="min-w-0">
            <h2 className="sr-only">历史条目</h2>
            <ItemList
              items={items}
              loading={items === null}
              error={error}
              onDeleted={remove}
            />
          </section>
        </div>
      </main>

      <DropOverlay onFiles={handleFiles} />

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

      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
