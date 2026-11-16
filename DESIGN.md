# DESIGN.md — MyClip v2 锁定风格令牌表

> 来源：用户提供的参考稿 `/tmp/style-ref/myclip_v2.html`（2026-11-16 复核锁定）。
> 所有 UI 代码只允许使用本表令牌；新值需申报批准后追加。

## 1. 风格坐标

- 主风格：**现代 SaaS 工作台**（slate 中性面板 + indigo 品牌点缀，卡片化 12 栏工作区）
- 副风格：**文件投递/传输工具**（拖放区 + 双操作卡 + 徽标化元信息）

## 2. 色板令牌（shadcn CSS 变量映射）

| 角色 | Light | Dark |
|---|---|---|
| 页面底 `--background` | slate-100 `#f1f5f9` | slate-950 `#020617` |
| 卡片面 `--card` | white `#ffffff` | slate-900 `#0f172a` |
| 主文字 `--foreground` | slate-900 `#0f172a` | slate-100 `#f1f5f9` |
| 次要文字 `--muted-foreground` | slate-500 `#64748b` | slate-400 `#94a3b8` |
| 弱化文字 | slate-400 `#94a3b8` | slate-500 `#64748b` |
| 主色 `--primary` | indigo-600 `#4f46e5` | indigo-600 `#4f46e5` |
| 主色 hover | indigo-500 `#6366f1` | indigo-500 `#6366f1` |
| 主色 active | indigo-700 `#4338ca` | indigo-700 `#4338ca` |
| 主色 soft bg | indigo-50 `#eef2ff` / indigo-100 `#e0e7ff` | indigo-950/80 `#1e1b4b` |
| 描边 `--border` | slate-200/90 `#e2e8f0` | slate-800 `#1e293b` |
| 分隔线 | slate-100 `#f1f5f9` | slate-800/80 |
| 成功 | emerald-600 `#059669`，soft emerald-50 / dark emerald-950/60 | 同 |
| 警告 | amber-600 `#d97706`（amber-700 文字 `#b45309`），soft amber-50 / dark amber-950/80 | 同 |
| 危险 | rose-600 `#e11d48`，soft rose-50 / dark rose-950/50 | 同 |
| 信息/链接 | sky-600 `#0284c7`，soft sky-50 / dark sky-950/80 | 同 |
| 代码块底 | slate-900 `#0f172a`（light 也用深底） | slate-950 `#020617` |
| 顶栏毛玻璃 | white/85 + backdrop-blur-md | slate-900/85 |

## 3. 字体

- 正文栈：`Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`
- 等宽栈（房间号/时间/字符数/代码/kbd/文件扩展名块）：`"JetBrains Mono", monospace`
- 字号阶梯：`10 / 11 / 12 / 14 / 16`（text-xs 12 为主力；11 徽标/元信息；10 kbd 与 v2 角标；14/16 输入与标题）
- 字重：标题 semibold~bold；正文 400/medium；徽标 medium~semibold
- 图标：lucide-react，尺寸 w-3.5/w-4/w-5/w-6 四档

## 4. 质感

- 圆角：卡片/弹窗/拖放区 `16px (rounded-2xl)`；按钮/输入/操作卡/嵌套块 `12px (rounded-xl)`；徽标/chip `6px (rounded-md)` 或 `9999px (rounded-full)`
- 阴影：卡片 `shadow-xs`；hover `shadow-md`；弹窗 `shadow-2xl`；主按钮 `shadow-sm shadow-indigo-500/20`
- 拖放区：`border-2 dashed slate-200`（dark slate-800）；dragover 激活 `border-indigo-500 + bg-indigo-5%`
- 滚动条：6px、thumb `rgba(156,163,175,.4)` 圆角 9999px；横向工具条用 no-scrollbar
- WS 状态点：emerald-500 实心 8px + animate-ping 外圈

## 5. 密度与动效

- 栅格：容器 `max-w-7xl (1280px)` 居中，px 16/24/32（sm/lg）；desktop `grid-cols-12 gap-6`：composer 占 5 栏 `sticky top-24`、stream 占 7 栏
- 组件间隙：卡内 space-y-2.5/3（10/12px）、栏间 gap-4（16px）
- 移动端 <768px：双段切换条（合成视图 / 仅接收流，rounded-xl 分段控件）；TTL 与筛选条横向滚动 no-scrollbar
- 过渡：交互 `150-200ms ease`；拖放区/弹窗 `300ms`；动效 ≤200ms 且尊重 prefers-reduced-motion（ping 心跳点除外）
- 断点：`sm 640 / md 768 / lg 1024 / xl 1280`

## 6. 结构与反例

页面区块顺序（desktop）：顶栏（logo 块 36px rounded-xl slate-900 底 + v2 角标 + #房间 pill + WS 状态徽标 ｜ 安装/分享/主题）→ 主区 12 栏 → footer（品牌名 · 一句话 · GitHub 链接）。

- Composer 卡（左 5 栏）：类型识别徽标 + 一键粘贴/清空 → textarea(rows≈5) → 附件暂存列表 → 字符计数行 → TTL pill 条 → 操作条（选择文件 + indigo 主按钮带 ⌘↵ kbd）。**2026-11-16 修订：TTL 选中态改为 indigo-600 底白字（light 与 dark 统一），不再用 slate-900**
- Stream（右 7 栏）：筛选头部卡（全部/文本代码/文件图片/链接 tabs + 计数 + 搜索框 + 清空）→ 条目卡列表 / 空状态拖放区（双操作卡：上传文件 indigo 图标容器、粘贴发送 emerald 图标容器）
- 条目卡：类型徽标（代码 indigo / 文件 amber / 链接 sky / 文本 slate）+ TTL 徽标（短 TTL amber，其余 slate）+ 来源设备与时间 → 内容体（文件行 ext 等宽图标块 + 下载按钮；链接卡 hover indigo；代码深底 pre；文本浅底 pre-wrap）→ 复制/删除操作

**反例（不许出现）**：教学/解说性文案（空状态标题句、对比说明、Ctrl+V 提示卡、快速填入示例行、开发者预览条）；emoji 图标；渐变按钮；大圆角卡通感；>200ms 装饰动效（ping 除外）；绕开组件库手搓样式。

**已批追加**：无。
