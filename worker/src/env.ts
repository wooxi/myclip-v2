export interface Env {
  DB: D1Database;
  FILES: R2Bucket;
  ROOM_DO: DurableObjectNamespace;
  ASSETS: Fetcher;
}

export const LIMITS = {
  maxFileSize: 2_147_483_648, // 2GB
  textLimit: 1_048_576, // 1MB
  historyLimit: 500,
  // 单请求上传上限 = zone body limit (100MB) 留裕量
  singleUploadLimit: 95 * 1024 * 1024,
  // 分片大小范围：R2 multipart 除最后一片外最小 5MiB
  minPartSize: 5 * 1024 * 1024,
  maxPartSize: 512 * 1024 * 1024,
  maxParts: 10000,
  ttlOptions: [300, 3600, 86400, 604800, null] as (number | null)[],
} as const;

export const ROOM_RE = /^[a-zA-Z0-9_-]{1,32}$/;
