import type { TtlValue } from "@/types";

/** /api/config 返回的服务端配置（契约见 API.md；singleUploadLimit/partSize 为后端扩展字段） */
export interface AppConfig {
  maxFileSize: number; // 单文件上限（2GB）
  textLimit: number; // 单条文本上限（1MB）
  historyLimit: number; // 每房间历史条数（500）
  singleUploadLimit: number; // ≤ 该值单请求上传（95MB），超出走分片
  partSize: number; // 分片大小（16MB）
  ttlOptions: TtlValue[]; // [300, 3600, 86400, 604800, null]
}

/** 服务端缺席 / 拉取失败时的兜底默认值（与 API.md 限制一致） */
export const DEFAULT_CONFIG: AppConfig = {
  maxFileSize: 2 * 1024 * 1024 * 1024,
  textLimit: 1_048_576,
  historyLimit: 500,
  singleUploadLimit: 95 * 1024 * 1024,
  partSize: 16 * 1024 * 1024,
  ttlOptions: [300, 3600, 86400, 604800, null],
};

let current: AppConfig = DEFAULT_CONFIG;

/** 同步读取当前配置（config 拉取完成前即为默认值，UI 不阻塞） */
export function currentConfig(): AppConfig {
  return current;
}

/** 拉取成功后应用 */
export function applyConfig(c: AppConfig): void {
  current = c;
}
