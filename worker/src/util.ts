const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function id(size = 10): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < size; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 180) || "unnamed";
}

export function isPreviewable(mime: string | null): boolean {
  if (!mime) return false;
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime.startsWith("audio/") ||
    mime.startsWith("text/") ||
    mime === "application/json"
  );
}

export function resolveRoom(raw: string | undefined): string | null {
  if (!raw) return null;
  const room = raw.toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(room) ? room : null;
}

export function parseTtl(ttl: unknown): number | null {
  if (ttl === null || ttl === undefined || ttl === 0) return null;
  const n = Number(ttl);
  if (!Number.isFinite(n) || n < 0 || n > 2_592_000) return null; // 上限 30 天
  return n > 0 ? n : null;
}

export interface ItemRow {
  id: string;
  kind: "text" | "file";
  content: string | null;
  file_name: string | null;
  file_size: number | null;
  mime: string | null;
  file_key: string | null;
  status?: "pending" | "ready";
  upload_id?: string | null;
  expire_at: number | null;
  created_at: number;
}

export function toItem(i: ItemRow) {
  return {
    id: i.id,
    kind: i.kind,
    content: i.content ?? undefined,
    fileName: i.file_name ?? undefined,
    fileSize: i.file_size ?? undefined,
    mime: i.mime ?? undefined,
    previewable: i.kind === "file" ? isPreviewable(i.mime) : false,
    expireAt: i.expire_at,
    createdAt: i.created_at,
  };
}
