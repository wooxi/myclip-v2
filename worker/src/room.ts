import type { Env } from "./env";

/**
 * 每房间一个 DO 实例，负责 WebSocket 连接管理与实时广播。
 * 使用 WebSocket Hibernation API：空闲连接休眠不计费，收到消息再唤醒。
 */
export class RoomDO implements DurableObject {
  private ctx: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.ctx = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket 升级（由主 Worker 转发）
    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket upgrade", { status: 400 });
      }
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // 主 Worker 通知广播（POST body = JSON 消息）
    if (url.pathname === "/notify" && request.method === "POST") {
      const message = await request.text();
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message);
        } catch {
          // 单个客户端失败不影响其他
        }
      }
      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  }

  // 客户端心跳：回 pong 保持活性
  async webSocketMessage(ws: WebSocket): Promise<void> {
    ws.send(JSON.stringify({ type: "pong" }));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    ws.close(1000, "closed");
  }
}
