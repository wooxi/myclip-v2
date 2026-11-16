/** 与 API.md 数据模型一致（api.ts re-export） */
export interface Item {
  id: string;
  kind: "text" | "file";
  content?: string;
  fileName?: string;
  fileSize?: number;
  mime?: string;
  previewable: boolean;
  source?: string; // 来源设备显示名（≤64 字符，服务端截断，如 "Chrome · macOS"）
  expireAt: number | null;
  createdAt: number;
}

/** TTL 选项（秒），null = 永久。默认永久 */
export type TtlValue = number | null;

const TTL_LABELS: Record<number, string> = {
  300: "5 分钟",
  3600: "1 小时",
  86400: "1 天",
  604800: "7 天",
};

/** TTL 值 → 展示文案（服务端 ttlOptions 动态生成，未知值按秒换算） */
export function ttlLabel(value: TtlValue): string {
  if (value === null) return "永久";
  if (TTL_LABELS[value]) return TTL_LABELS[value];
  if (value % 86400 === 0) return `${value / 86400} 天`;
  if (value % 3600 === 0) return `${value / 3600} 小时`;
  return `${Math.round(value / 60)} 分钟`;
}
