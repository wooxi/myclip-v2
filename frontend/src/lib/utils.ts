import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 字节数格式化 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes;
  let u = units[0];
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    u = units[++i];
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${u}`;
}

/**
 * 过期倒计时格式化：<1h → mm:ss，<1d → h，其余 → d
 */
export function formatCountdown(expireAt: number, now: number): string {
  const diff = expireAt - now;
  if (diff <= 0) return "已过期";
  const sec = Math.floor(diff / 1000);
  if (sec < 3600) {
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }
  if (sec < 86400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** 房间名合法性：[a-zA-Z0-9_-]{1,32} */
export const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,32}$/;

export function isValidRoom(name: string): boolean {
  return ROOM_PATTERN.test(name);
}
