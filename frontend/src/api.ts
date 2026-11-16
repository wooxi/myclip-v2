/**
 * myclip-v2 前端 API 层（单文件封装）
 *
 * - 真实模式：REST + WebSocket，与 API.md 契约一一对应
 * - mock 模式（VITE_USE_MOCK=1）：localStorage 模拟数据 + BroadcastChannel
 *   模拟多标签页实时广播，保证后端缺席时 UI 全交互可调试
 *
 * 所有组件只依赖本文件导出的接口，联调时无需改动业务代码。
 */

import type { Item } from "./types";
import { DEFAULT_CONFIG, currentConfig, type AppConfig } from "./app-config";

export type { Item };

export type TextSubmit = { content: string; ttl?: number | null };

export type FileUploadHandle = {
  promise: Promise<Item>;
  /** 每片完成的进度回调（0-100） */
  onProgress?: (percent: number) => void;
  abort: () => void;
};

export type WsEvent =
  | { type: "new"; item: Item }
  | { type: "delete"; id: string }
  | { type: "expire"; id: string };

export type WsStatus = "connecting" | "open" | "closed" | "mock";

export interface ApiClient {
  /** GET /api/config（失败由调用方兜底默认值，不阻塞首屏） */
  getConfig(): Promise<AppConfig>;
  /** GET /api/rooms/:room/items */
  listItems(room: string): Promise<Item[]>;
  /** POST /api/rooms/:room/text */
  postText(room: string, body: TextSubmit): Promise<Item>;
  /** POST /api/rooms/:room/file（≤95MB 单请求） */
  postFile(room: string, file: File, ttl: number | null): Promise<Item>;
  /** 分片上传（>95MB）：init → PUT parts/:n → complete；abort 可取消 */
  uploadLarge(
    room: string,
    file: File,
    ttl: number | null,
    onProgress: (percent: number) => void,
  ): { promise: Promise<Item>; abort: () => void };
  /** GET /api/items/:id/file → 直接 URL（img/video/audio src、下载链接） */
  fileUrl(room: string, item: Item): string;
  /** DELETE /api/items/:id */
  deleteItem(id: string): Promise<void>;
  /** 页面级 WebSocket：返回取消订阅函数 */
  subscribe(
    room: string,
    onEvent: (ev: WsEvent) => void,
    onStatus?: (s: WsStatus) => void,
  ): () => void;
  /** 是否为 mock 模式（UI 显示徽标用） */
  readonly isMock: boolean;
}

/* ------------------------------------------------------------------ */
/* 真实模式                                                            */
/* ------------------------------------------------------------------ */

class RestApiClient implements ApiClient {
  readonly isMock = false;

  async getConfig(): Promise<AppConfig> {
    const res = await fetch("/api/config");
    if (!res.ok) throw await toError(res);
    // 契约字段缺失时逐项回退默认值
    const raw = (await res.json()) as Partial<AppConfig>;
    return {
      maxFileSize: raw.maxFileSize ?? DEFAULT_CONFIG.maxFileSize,
      textLimit: raw.textLimit ?? DEFAULT_CONFIG.textLimit,
      historyLimit: raw.historyLimit ?? DEFAULT_CONFIG.historyLimit,
      singleUploadLimit: raw.singleUploadLimit ?? DEFAULT_CONFIG.singleUploadLimit,
      partSize: raw.partSize ?? DEFAULT_CONFIG.partSize,
      ttlOptions: raw.ttlOptions ?? DEFAULT_CONFIG.ttlOptions,
    };
  }

  async listItems(room: string): Promise<Item[]> {
    const res = await fetch(`/api/rooms/${encodeURIComponent(room)}/items`);
    if (!res.ok) throw await toError(res);
    const data = (await res.json()) as { items: Item[] };
    return data.items;
  }

  async postText(room: string, body: TextSubmit): Promise<Item> {
    const res = await fetch(`/api/rooms/${encodeURIComponent(room)}/text`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    const data = (await res.json()) as { item: Item };
    return data.item;
  }

  async postFile(room: string, file: File, ttl: number | null): Promise<Item> {
    const q = new URLSearchParams({
      name: file.name,
      mime: file.type || "application/octet-stream",
    });
    if (ttl !== null) q.set("ttl", String(ttl));
    const res = await fetch(
      `/api/rooms/${encodeURIComponent(room)}/file?${q.toString()}`,
      { method: "POST", body: file },
    );
    if (!res.ok) throw await toError(res);
    const data = (await res.json()) as { item: Item };
    return data.item;
  }

  uploadLarge(
    room: string,
    file: File,
    ttl: number | null,
    onProgress: (percent: number) => void,
  ) {
    const ctrl = new AbortController();
    const roomPath = encodeURIComponent(room);
    let uploadId = "";

    const promise = (async () => {
      // init
      const initRes = await fetch(`/api/rooms/${roomPath}/upload/init`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          size: file.size,
          mime: file.type || "application/octet-stream",
          ...(ttl !== null ? { ttl } : {}),
        }),
        signal: ctrl.signal,
      });
      if (!initRes.ok) throw await toError(initRes);
      const initData = (await initRes.json()) as {
        itemId: string;
        uploadId: string;
        partSize: number;
      };
      uploadId = initData.uploadId;
      const totalParts = Math.max(1, Math.ceil(file.size / initData.partSize));

      // 循环 PUT parts/:n（每片 ≤ partSize，服务端切片 ≤16MB 由 partSize 决定）
      for (let n = 1; n <= totalParts; n++) {
        if (ctrl.signal.aborted) throw abortError();
        const start = (n - 1) * initData.partSize;
        const blob = file.slice(
          start,
          Math.min(start + initData.partSize, file.size),
        );
        const partRes = await fetch(
          `/api/rooms/${roomPath}/upload/${encodeURIComponent(uploadId)}/parts/${n}`,
          { method: "PUT", body: blob, signal: ctrl.signal },
        );
        if (!partRes.ok) throw await toError(partRes);
        onProgress(Math.round((n / totalParts) * 100));
      }

      // complete
      const completeRes = await fetch(
        `/api/rooms/${roomPath}/upload/${encodeURIComponent(uploadId)}/complete`,
        { method: "POST", signal: ctrl.signal },
      );
      if (!completeRes.ok) throw await toError(completeRes);
      const { item } = (await completeRes.json()) as { item: Item };
      return item;
    })().catch((err: unknown) => {
      // 取消时尽力通知服务端放弃分片（失败也静默，不掩盖原始错误）
      if (ctrl.signal.aborted && uploadId) {
        void fetch(`/api/rooms/${roomPath}/upload/${encodeURIComponent(uploadId)}/abort`, {
          method: "POST",
        }).catch(() => undefined);
      }
      throw err;
    });

    const abort = () => {
      ctrl.abort();
    };
    return { promise, abort };
  }

  fileUrl(_room: string, item: Item): string {
    return `/api/items/${encodeURIComponent(item.id)}/file`;
  }

  async deleteItem(id: string): Promise<void> {
    const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw await toError(res);
  }

  subscribe(
    room: string,
    onEvent: (ev: WsEvent) => void,
    onStatus?: (s: WsStatus) => void,
  ): () => void {
    // 断线 3s 自动重连
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      onStatus?.("connecting");
      const proto = location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(
        `${proto}//${location.host}/api/rooms/${encodeURIComponent(room)}/ws`,
      );
      ws.onopen = () => onStatus?.("open");
      ws.onmessage = (ev) => {
        try {
          onEvent(JSON.parse(ev.data as string) as WsEvent);
        } catch {
          /* 忽略无法解析的帧 */
        }
      };
      ws.onclose = () => {
        onStatus?.("closed");
        if (!disposed) timer = setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };
    connect();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }
}

async function toError(res: Response): Promise<Error> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) msg = data.error;
  } catch {
    /* 非 JSON 响应 */
  }
  return new Error(msg);
}

function abortError(): Error {
  const e = new Error("上传已取消");
  e.name = "AbortError";
  return e;
}

/* ------------------------------------------------------------------ */
/* mock 模式                                                           */
/* ------------------------------------------------------------------ */

const MOCK_PREFIX = "myclip-mock:";
const MOCK_CHANNEL = "myclip-mock-events";
/** mock 中文件小于该值才持久化到 localStorage（dataURL），大文件仅本次会话可用 */
const MOCK_PERSIST_LIMIT = 256 * 1024;

interface MockFileEntry {
  /** dataURL 或 blob URL（会话内） */
  url: string;
  persistent: boolean;
}

/** 会话内存中的 mock 文件 Blob（刷新后丢失，持久化的小文件用 dataURL） */
const mockFiles = new Map<string, MockFileEntry>();

function mockRoomKey(room: string): string {
  return `${MOCK_PREFIX}room:${room}`;
}

function mockReadRoom(room: string): Item[] {
  try {
    return JSON.parse(localStorage.getItem(mockRoomKey(room)) ?? "[]") as Item[];
  } catch {
    return [];
  }
}

function mockWriteRoom(room: string, items: Item[]): void {
  localStorage.setItem(mockRoomKey(room), JSON.stringify(items));
}

function mockBroadcast(ev: WsEvent, room: string): void {
  try {
    new BroadcastChannel(MOCK_CHANNEL).postMessage({ ...ev, room });
  } catch {
    /* BroadcastChannel 不可用则仅本标签页可见 */
  }
}

function mockId(): string {
  return Array.from({ length: 10 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[
      Math.floor(Math.random() * 36)
    ],
  ).join("");
}

function mockExpire(ttl: number | null): number | null {
  return ttl === null || ttl === 0 ? null : Date.now() + ttl * 1000;
}

function previewableByMime(mime: string, name: string): boolean {
  if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/"))
    return true;
  if (mime === "text/plain") return true;
  return /\.(txt|md|json|log)$/i.test(name);
}

class MockApiClient implements ApiClient {
  readonly isMock = true;

  async getConfig(): Promise<AppConfig> {
    await delay(100);
    return { ...DEFAULT_CONFIG };
  }

  async listItems(room: string): Promise<Item[]> {
    await delay(200);
    const items = mockReadRoom(room).filter(
      (it) => it.expireAt === null || it.expireAt > Date.now(),
    );
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async postText(room: string, body: TextSubmit): Promise<Item> {
    await delay(150);
    const item: Item = {
      id: mockId(),
      kind: "text",
      content: body.content,
      previewable: true,
      expireAt: mockExpire(body.ttl ?? null),
      createdAt: Date.now(),
    };
    this.#commit(room, item);
    return item;
  }

  async postFile(room: string, file: File, ttl: number | null): Promise<Item> {
    await delay(400 + file.size / 8e6); // 模拟传输耗时
    const item: Item = {
      id: mockId(),
      kind: "file",
      fileName: file.name,
      fileSize: file.size,
      mime: file.type || "application/octet-stream",
      previewable: previewableByMime(
        file.type || "application/octet-stream",
        file.name,
      ),
      expireAt: mockExpire(ttl),
      createdAt: Date.now(),
    };
    await this.#persistFile(item.id, file);
    this.#commit(room, item);
    return item;
  }

  uploadLarge(
    room: string,
    file: File,
    ttl: number | null,
    onProgress: (percent: number) => void,
  ) {
    // 模拟分片：8 片，每片 300ms
    const totalParts = 8;
    let current = 0;
    let cancelled = false;
    const promise = (async () => {
      const item: Item = {
        id: mockId(),
        kind: "file",
        fileName: file.name,
        fileSize: file.size,
        mime: file.type || "application/octet-stream",
        previewable: previewableByMime(
          file.type || "application/octet-stream",
          file.name,
        ),
        expireAt: mockExpire(ttl),
        createdAt: Date.now(),
      };
      for (current = 1; current <= totalParts; current++) {
        if (cancelled) {
          const e = abortError();
          throw e;
        }
        await delay(300);
        onProgress(Math.round((current / totalParts) * 100));
      }
      await this.#persistFile(item.id, file);
      if (cancelled) throw abortError();
      this.#commit(room, item);
      return item;
    })();
    return {
      promise,
      abort: () => {
        cancelled = true;
      },
    };
  }

  fileUrl(room: string, item: Item): string {
    void room;
    const entry = mockFiles.get(item.id);
    if (entry) return entry.url;
    // 无缓存文件（大文件 mock 或刷新后）返回空串，UI 显示占位
    return "";
  }

  async deleteItem(id: string): Promise<void> {
    await delay(120);
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(MOCK_PREFIX + "room:")) {
        const room = key.slice((MOCK_PREFIX + "room:").length);
        const items = mockReadRoom(room).filter((it) => it.id !== id);
        mockWriteRoom(room, items);
        mockBroadcast({ type: "delete", id }, room);
      }
    }
    mockFiles.delete(id);
  }

  subscribe(
    room: string,
    onEvent: (ev: WsEvent) => void,
    onStatus?: (s: WsStatus) => void,
  ): () => void {
    onStatus?.("mock");
    // 本标签页提交 + 跨标签页广播，两条路径统一转发
    const ch = new BroadcastChannel(MOCK_CHANNEL);
    ch.onmessage = (ev: MessageEvent) => {
      const payload = ev.data as WsEvent & { room: string };
      if (payload.room === room) onEvent(payload);
    };
    return () => {
      ch.close();
    };
  }

  /** 提交者本地写库并广播；其余标签页通过 subscribe 收到事件后无需重复写库 */
  #commit(room: string, item: Item): void {
    const items = [item, ...mockReadRoom(room)].slice(
      0,
      currentConfig().historyLimit,
    );
    mockWriteRoom(room, items);
    mockBroadcast({ type: "new", item }, room);
  }

  async #persistFile(id: string, file: File): Promise<void> {
    if (file.size <= MOCK_PERSIST_LIMIT) {
      const url = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = () => reject(new Error("读取失败"));
        fr.readAsDataURL(file);
      });
      mockFiles.set(id, { url, persistent: true });
      try {
        localStorage.setItem(`${MOCK_PREFIX}file:${id}`, JSON.stringify({ url }));
      } catch {
        /* 超出配额时仅会话内可用 */
      }
    } else {
      mockFiles.set(id, { url: URL.createObjectURL(file), persistent: false });
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* 启动时把 localStorage 里持久化过的小文件恢复进内存 */
try {
  for (const key of Object.keys(localStorage)) {
    const m = key.match(/^myclip-mock:file:(.+)$/);
    if (m) {
      const { url } = JSON.parse(
        localStorage.getItem(key) as string,
      ) as { url: string };
      mockFiles.set(m[1], { url, persistent: true });
    }
  }
} catch {
  /* 恢复失败不影响主流程 */
}

export const api: ApiClient =
  import.meta.env.VITE_USE_MOCK === "1" ? new MockApiClient() : new RestApiClient();
