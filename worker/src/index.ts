import { Hono } from "hono";
import { LIMITS, type Env } from "./env";
import { id, sanitizeFileName, sanitizeDevice, resolveRoom, parseTtl, toItem, type ItemRow } from "./util";
import { RoomDO } from "./room";

export { RoomDO };

const app = new Hono<{ Bindings: Env }>();

// ---------- helpers ----------

interface Broadcastable {
  env: Env;
  executionCtx: { waitUntil(promise: Promise<unknown>): void };
}

function roomStub(c: Broadcastable, room: string): DurableObjectStub {
  return c.env.ROOM_DO.get(c.env.ROOM_DO.idFromName(room));
}

function broadcast(c: Broadcastable, room: string, message: unknown): void {
  c.executionCtx.waitUntil(
    roomStub(c, room)
      .fetch("https://do/notify", { method: "POST", body: JSON.stringify(message) })
      .then(() => undefined)
      .catch(() => undefined)
  );
}

function badRequest(c: { json: (data: unknown, status?: number) => Response }, msg: string) {
  return c.json({ error: msg }, 400);
}

// ---------- config ----------

app.get("/api/config", (c) =>
  c.json({
    maxFileSize: LIMITS.maxFileSize,
    textLimit: LIMITS.textLimit,
    historyLimit: LIMITS.historyLimit,
    singleUploadLimit: LIMITS.singleUploadLimit,
    partSize: 16 * 1024 * 1024,
    ttlOptions: LIMITS.ttlOptions,
  })
);

// ---------- WebSocket ----------

app.get("/api/rooms/:room/ws", (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  return roomStub(c, room).fetch("https://do/connect", c.req.raw as Request);
});

// ---------- items ----------

app.get("/api/rooms/:room/items", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  const now = Date.now();
  const { results } = await c.env.DB.prepare(
    `SELECT id, kind, content, file_name, file_size, mime, file_key, source, expire_at, created_at
     FROM items WHERE room = ? AND status = 'ready' AND (expire_at IS NULL OR expire_at > ?)
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(room, now, LIMITS.historyLimit)
    .all<ItemRow>();
  return c.json({ items: (results ?? []).map(toItem) });
});

app.post("/api/rooms/:room/text", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  let body: { content?: unknown; ttl?: unknown; device?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return badRequest(c, "invalid json");
  }
  const content = typeof body.content === "string" ? body.content : null;
  if (content === null || content.trim() === "") return badRequest(c, "content required");
  const device = sanitizeDevice(body.device);
  const bytes = new TextEncoder().encode(content).length;
  if (bytes > LIMITS.textLimit) return c.json({ error: "text too large" }, 413);
  const ttl = parseTtl(body.ttl);
  if (body.ttl !== null && body.ttl !== undefined && body.ttl !== 0 && ttl === null)
    return badRequest(c, "invalid ttl");

  const now = Date.now();
  const item: ItemRow = {
    id: id(),
    kind: "text",
    content,
    file_name: null,
    file_size: bytes,
    mime: null,
    file_key: null,
    source: device,
    expire_at: ttl ? now + ttl * 1000 : null,
    created_at: now,
  };
  await c.env.DB.prepare(
    `INSERT INTO items (id, room, kind, content, file_name, file_size, mime, file_key, source, status, upload_id, expire_at, created_at)
     VALUES (?, ?, 'text', ?, NULL, ?, NULL, NULL, ?, 'ready', NULL, ?, ?)`
  )
    .bind(item.id, room, content, bytes, device, item.expire_at, now)
    .run();
  broadcast(c, room, { type: "new", item: toItem(item) });
  return c.json({ item: toItem(item) }, 201);
});

// 单请求文件上传（≤95MB），流式转发 R2，不在内存缓存
app.post("/api/rooms/:room/file", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  const name = sanitizeFileName(c.req.query("name") ?? "unnamed");
  const mime = c.req.query("mime") || "application/octet-stream";
  const ttl = parseTtl(c.req.query("ttl"));
  const device = sanitizeDevice(c.req.query("device"));
  const declared = Number(c.req.query("size") || 0);
  if (!Number.isFinite(declared) || declared <= 0 || declared > LIMITS.singleUploadLimit)
    return c.json({ error: "file too large for single-request upload, use chunked upload" }, 413);
  if (!c.req.raw.body) return badRequest(c, "body required");

  const itemId = id();
  const fileKey = `${room}/${itemId}/${name}`;
  const now = Date.now();

  await c.env.FILES.put(fileKey, c.req.raw.body, {
    httpMetadata: { contentType: mime },
  });

  const item: ItemRow = {
    id: itemId,
    kind: "file",
    content: null,
    file_name: name,
    file_size: declared,
    mime,
    file_key: fileKey,
    source: device,
    expire_at: ttl ? now + ttl * 1000 : null,
    created_at: now,
  };
  await c.env.DB.prepare(
    `INSERT INTO items (id, room, kind, content, file_name, file_size, mime, file_key, source, status, upload_id, expire_at, created_at)
     VALUES (?, ?, 'file', NULL, ?, ?, ?, ?, ?, 'ready', NULL, ?, ?)`
  )
    .bind(itemId, room, name, declared, mime, fileKey, device, item.expire_at, now)
    .run();
  broadcast(c, room, { type: "new", item: toItem(item) });
  return c.json({ item: toItem(item) }, 201);
});

// ---------- 分片直传（>95MB，支持到 maxFileSize） ----------

app.post("/api/rooms/:room/upload/init", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  let body: { fileName?: unknown; size?: unknown; mime?: unknown; ttl?: unknown; device?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return badRequest(c, "invalid json");
  }
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0 || size > LIMITS.maxFileSize)
    return c.json({ error: "invalid size" }, 413);
  if (size <= LIMITS.singleUploadLimit)
    return badRequest(c, "use single-request upload for small files");
  const name = sanitizeFileName(typeof body.fileName === "string" ? body.fileName : "unnamed");
  const mime = typeof body.mime === "string" && body.mime ? body.mime : "application/octet-stream";
  const ttl = parseTtl(body.ttl);
  const device = sanitizeDevice(body.device);

  const itemId = id();
  const fileKey = `${room}/${itemId}/${name}`;
  const mp = await c.env.FILES.createMultipartUpload(fileKey, {
    httpMetadata: { contentType: mime },
  });
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO items (id, room, kind, content, file_name, file_size, mime, file_key, source, status, upload_id, expire_at, created_at)
     VALUES (?, ?, 'file', NULL, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(itemId, room, name, size, mime, fileKey, device, mp.uploadId, ttl ? now + ttl * 1000 : null, now)
    .run();
  return c.json({ itemId, uploadId: mp.uploadId, partSize: 16 * 1024 * 1024 }, 201);
});

app.put("/api/rooms/:room/upload/:uploadId/parts/:n", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  const n = Number(c.req.param("n"));
  if (!Number.isInteger(n) || n < 1 || n > LIMITS.maxParts) return badRequest(c, "invalid part number");
  const row = await c.env.DB.prepare(
    `SELECT file_key, upload_id FROM items WHERE upload_id = ? AND room = ? AND status = 'pending'`
  )
    .bind(c.req.param("uploadId"), room)
    .first<{ file_key: string; upload_id: string }>();
  if (!row) return c.json({ error: "upload not found" }, 404);
  const mp = c.env.FILES.resumeMultipartUpload(row.file_key, row.upload_id);
  if (!c.req.raw.body) return badRequest(c, "body required");
  const part = await mp.uploadPart(n, c.req.raw.body);
  return c.json({ etag: part.etag });
});

app.post("/api/rooms/:room/upload/:uploadId/complete", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  let body: { parts?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return badRequest(c, "invalid json");
  }
  const partsRaw = Array.isArray(body.parts) ? body.parts : null;
  if (!partsRaw || partsRaw.length === 0 || partsRaw.length > LIMITS.maxParts)
    return badRequest(c, "invalid parts");
  const parts = partsRaw.map((p: unknown) => {
    const entry = p as { n?: unknown; etag?: unknown };
    return { partNumber: Number(entry.n), etag: String(entry.etag ?? "") };
  });
  if (parts.some((p) => !Number.isInteger(p.partNumber) || p.partNumber < 1 || !p.etag))
    return badRequest(c, "invalid part entry");

  const row = await c.env.DB.prepare(
    `SELECT id, room, kind, content, file_name, file_size, mime, file_key, source, status, upload_id, expire_at, created_at
     FROM items WHERE upload_id = ? AND room = ? AND status = 'pending'`
  )
    .bind(c.req.param("uploadId"), room)
    .first<ItemRow>();
  if (!row || !row.file_key || !row.upload_id) return c.json({ error: "upload not found" }, 404);

  const mp = c.env.FILES.resumeMultipartUpload(row.file_key, row.upload_id);
  const completed = await mp.complete(parts);
  if (!completed) return c.json({ error: "complete failed" }, 409);

  await c.env.DB.prepare(`UPDATE items SET status = 'ready', upload_id = NULL WHERE id = ?`).bind(row.id).run();
  const finalRow: ItemRow = { ...row, status: "ready" };
  broadcast(c, room, { type: "new", item: toItem(finalRow) });
  return c.json({ item: toItem(finalRow) });
});

app.post("/api/rooms/:room/upload/:uploadId/abort", async (c) => {
  const room = resolveRoom(c.req.param("room"));
  if (!room) return badRequest(c, "invalid room");
  const row = await c.env.DB.prepare(
    `SELECT file_key, upload_id FROM items WHERE upload_id = ? AND room = ? AND status = 'pending'`
  )
    .bind(c.req.param("uploadId"), room)
    .first<{ file_key: string; upload_id: string }>();
  if (!row) return c.body(null, 404);
  const mp = c.env.FILES.resumeMultipartUpload(row.file_key, row.upload_id);
  await mp.abort();
  await c.env.DB.prepare(`DELETE FROM items WHERE upload_id = ? AND status = 'pending'`).bind(c.req.param("uploadId")).run();
  return c.body(null, 204);
});

// ---------- 下载 / 删除 ----------

app.get("/api/items/:id/file", async (c) => {
  const itemId = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT file_name, mime, file_key FROM items WHERE id = ? AND kind = 'file' AND status = 'ready'`
  )
    .bind(itemId)
    .first<{ file_name: string; mime: string; file_key: string }>();
  if (!row) return c.json({ error: "not found" }, 404);

  const preview =
    /image\//.test(row.mime) ||
    /video\//.test(row.mime) ||
    /audio\//.test(row.mime) ||
    /text\//.test(row.mime);

  const headers = new Headers({
    "Content-Type": row.mime,
    ETag: itemId,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=0, must-revalidate",
    "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.file_name)}`,
  });

  const rangeHeader = c.req.header("Range");
  let obj: R2ObjectBody | null;
  if (rangeHeader) {
    const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!m) return c.json({ error: "invalid range" }, 416);
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : null;
    obj = await c.env.FILES.get(row.file_key, {
      range: { offset: start, length: end !== null ? end - start + 1 : undefined },
    });
    if (!obj) return c.json({ error: "range not satisfiable" }, 416);
    const total = obj.size;
    const actualEnd = end !== null ? end : total - 1;
    headers.set("Content-Range", `bytes ${start}-${actualEnd}/${total}`);
    headers.set("Content-Length", String(actualEnd - start + 1));
    return new Response(obj.body, { status: 206, headers });
  }

  obj = await c.env.FILES.get(row.file_key);
  if (!obj) return c.json({ error: "not found" }, 404);
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { status: 200, headers });
});

app.delete("/api/items/:id", async (c) => {
  const itemId = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT room, kind, file_key FROM items WHERE id = ? AND status = 'ready'`
  )
    .bind(itemId)
    .first<{ room: string; kind: string; file_key: string | null }>();
  if (!row) return c.json({ error: "not found" }, 404);
  await c.env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(itemId).run();
  if (row.file_key) await c.env.FILES.delete(row.file_key);
  broadcast(c, row.room, { type: "delete", id: itemId });
  return c.body(null, 204);
});

// ---------- SPA 静态资源兜底 ----------

app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// ---------- cron：每小时清理过期 ----------

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const now = Date.now();
    // 1) 过期条目：text 直接删，file 先删 R2 再删行
    const expired = await env.DB.prepare(
      `SELECT id, file_key FROM items WHERE expire_at IS NOT NULL AND expire_at <= ?`
    )
      .bind(now)
      .all<{ id: string; file_key: string | null }>();
    for (const row of expired.results ?? []) {
      if (row.file_key) await env.FILES.delete(row.file_key);
      await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(row.id).run();
    }
    // 2) 超过 24h 未完成的 pending 分片上传 → abort R2 multipart + 删行
    const stale = await env.DB.prepare(
      `SELECT id, file_key, upload_id FROM items WHERE status = 'pending' AND created_at < ?`
    )
      .bind(now - 24 * 3600 * 1000)
      .all<{ id: string; file_key: string; upload_id: string }>();
    for (const row of stale.results ?? []) {
      try {
        await env.FILES.resumeMultipartUpload(row.file_key, row.upload_id).abort();
      } catch {
        // R2 abort 幂等，失败不影响删行
      }
      await env.DB.prepare(`DELETE FROM items WHERE id = ?`).bind(row.id).run();
    }
    const cleaned = (expired.results?.length ?? 0) + (stale.results?.length ?? 0);
    if (cleaned > 0) {
      console.log(`[cron] cleaned ${(expired.results ?? []).length} expired + ${(stale.results ?? []).length} stale uploads`);
    }
  },
};
