# MyClip

局域网/公网两用的自托管云剪贴板：手机 ↔ 电脑互传文本与文件。基于旧版 cloud-clipboard 的使用习惯重写，部署在 Cloudflare 免费层，无服务器维护。

**在线体验**：尚未公开演示站，可自行部署（见下）。

## 特性

- 文本 + 文件（≤2GB，>95MB 自动 R2 分片直传，逐片进度、可取消）
- 过期时间可选：5 分钟 / 1 小时 / 1 天 / 7 天 / 永久
- 房间隔离：专属链接 + 二维码分享，房间名 `/r/:room`
- WebSocket 实时同步（Durable Objects + Hibernation API，多设备同时刷新）
- 图片/视频/音频内联预览，文本一键复制
- 拖拽 / Ctrl+V 粘贴截图 / 多选上传
- PWA：可安装到桌面/主屏
- 暗色优先 + 跟随系统，移动端优先响应式（≥1280px 宽屏双栏增强）
- 自解释 UI：无教学文案，纯 affordance 引导

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite 7 + Tailwind v4 + shadcn/ui 风格组件 + vite-plugin-pwa |
| 后端 | Cloudflare Workers + Hono |
| 存储 | D1（文本/元数据）+ R2（文件）+ Durable Objects（房间实时广播） |
| 清理 | Cron Trigger 每小时清理过期条目与超时未完成的分片上传 |

## 部署

```bash
# 1. 创建资源（首次）
npx wrangler d1 create myclip-v2-db
npx wrangler r2 bucket create myclip-v2-files
# 把返回的 database_id 填入 worker/wrangler.jsonc

# 2. 建表
cd worker
npx wrangler d1 execute myclip-v2-db --remote --file schema.sql

# 3. 构建前端
cd ../frontend
pnpm install && pnpm build

# 4. 部署（单 Worker 托管前后端）
cd ../worker
npx wrangler deploy
```

绑定自定义域名：在 `wrangler.jsonc` 的 `routes` 中将 `pattern` 改为你的域名（需 `custom_domain: true`，zone 托管在 Cloudflare）。

### 本地开发

```bash
cd frontend && pnpm install && pnpm dev        # mock 模式独立调试
cd worker && npx wrangler dev --port 8787      # 前后端联调
```

## 平台限制（免费层）

| 项目 | 限额 |
|---|---|
| 单请求上传 | 100MB（zone Free plan，前端按 95MB 阈值自动切换分片） |
| 分片直传单文件 | 2GB（可在 `worker/src/env.ts` 调整） |
| R2 存储 | 10GB |
| D1 | 5GB |
| Workers 请求 | 10 万/天 |

## 许可

MIT
