import { toast } from "sonner";
import { api } from "@/api";
import type { AppConfig } from "@/app-config";
import type { Item, TtlValue } from "@/types";

export type UploadCallbacks = {
  onCreated: (item: Item) => void;
  /** 分片进度（仅 >singleUploadLimit 文件） */
  onProgress?: (file: File, percent: number) => void;
};

/** 依次上传文件：≤singleUploadLimit 单请求，超出 init→parts→complete 分片 */
export async function uploadFiles(
  room: string,
  files: File[],
  ttl: TtlValue,
  config: AppConfig,
  { onCreated, onProgress }: UploadCallbacks,
): Promise<void> {
  for (const file of files) {
    try {
      // 客户端预检：超出服务端上限直接拒绝
      if (file.size > config.maxFileSize) {
        toast.error(
          `上传失败 ${file.name}：文件超出上限（单文件最大 ${Math.floor(config.maxFileSize / 1024 / 1024)} MB）`,
        );
        continue;
      }
      if (file.size > config.singleUploadLimit) {
        const { promise, abort } = api.uploadLarge(room, file, ttl, (percent) =>
          onProgress?.(file, percent),
        );
        registerAbort(file.name, abort);
        const item = await promise;
        onCreated(item);
      } else {
        const item = await api.postFile(room, file, ttl);
        onCreated(item);
      }
      toast.success(`已发送 ${file.name}`);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        toast.info(`已取消上传 ${file.name}`);
      } else {
        toast.error(`上传失败 ${file.name}：${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

/** abort 注册表：UI 取消按钮按文件名查找进行中的分片上传 */
const aborters = new Map<string, () => void>();

function registerAbort(name: string, abort: () => void) {
  aborters.set(name, abort);
}

export function abortUpload(name: string) {
  aborters.get(name)?.();
  aborters.delete(name);
}

export function clearAbort(name: string) {
  aborters.delete(name);
}
