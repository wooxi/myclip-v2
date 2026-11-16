# myclip-v2 API 契约（前后端共同遵守，改动需同步此文件）

数据模型 `Item`：

```ts
interface Item {
  id: string;            // nanoid
  kind: "text" | "file";
  content?: string;      // text 条目正文（file 条目无）
  fileName?: string;
  fileSize?: number;     // bytes
  mime?: string;
  previewable: boolean;  // 图片/视频/音频/文本 = true
  source?: string;       // 来源设备显示名（≤64 字符，如 "Chrome · macOS"），前端提交时派生
  expireAt: number | null; // unix ms，null = 永久
  createdAt: number;     // unix ms
}
```

**source 字段**：text 走 body 的 `device`；file 单请求走 query `?device=`；分片 init 走 body 的 `device`。服务端截断至 64 字符，空串存 null。

## REST

| 方法 & 路径 | 说明 | 请求体 | 返回 |
|---|---|---|---|
| `GET /api/rooms/:room/items` | 历史列表（created_at 降序，最多 500 条，含未过期） | - | `{ items: Item[] }` |
| `POST /api/rooms/:room/text` | 提交文本 | `{ content: string, ttl?: number }`（ttl 秒，null/0 = 永久） | `{ item: Item }` |
| `POST /api/rooms/:room/file` | ≤95MB 单请求上传（二进制流，无 multipart） | query: `?name=<filename>&mime=<mime>&ttl=<秒>` | `{ item: Item }` |
| `POST /api/rooms/:room/upload/init` | 大文件分片上传初始化 | `{ fileName, size, mime, ttl? }` | `{ itemId, uploadId, partSize }` |
| `PUT /api/rooms/:room/upload/:uploadId/parts/:n` | 上传第 n 片（1 起，二进制流） | 二进制 body | `{ etag }` |
| `POST /api/rooms/:room/upload/:uploadId/complete` | 合并分片，激活条目 | `{ parts: [{ n: number, etag: string }] }` | `{ item: Item }` |
| `POST /api/rooms/:room/upload/:uploadId/abort` | 放弃分片上传 | - | `204` |
| `GET /api/items/:id/file` | 文件下载（支持 Range） | - | 文件流 |
| `DELETE /api/items/:id` | 删除条目 | - | `204` |
| `GET /api/config` | 服务端配置 | - | `{ maxFileSize, textLimit, historyLimit, singleUploadLimit, partSize, ttlOptions }` |

> `singleUploadLimit`（单请求上传阈值 95MB）与 `partSize`（分片大小 16MB）为扩展字段，前端缺失时回退默认值。

错误统一 `{ error: string }` + 适当状态码（400/404/409/413）。

## WebSocket

`GET /api/rooms/:room/ws` → 升级。服务端推送 JSON：

```ts
{ type: "new", item: Item }    // 任何客户端提交后广播
{ type: "delete", id: string } // 删除后广播
{ type: "expire", id: string } // 到期清理（预留，cron 侧不保证推送）
```

房间规则：`room` 匹配 `[a-zA-Z0-9_-]{1,32}`，缺省房间名 `public`。

## 限制（/api/config 返回值，后端为准）

- `maxFileSize`: 2147483648 (2GB)
- `textLimit`: 1048576 (1MB)
- `historyLimit`: 500
- `ttlOptions`: [300, 3600, 86400, 604800, null]（5min/1h/1d/7d/永久）

## 目录与写范围

- `worker/` → lead 负责
- `frontend/` → 前端代理负责
- `API.md` / `wrangler.jsonc` → lead 维护，前端只读
