import { ChevronDown, Moon, Share2, Sun } from "lucide-react";
import { Logo } from "./logo";
import type { WsStatus } from "@/api";
import type { Theme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/** WS 状态徽标：圆点 + ping 外圈 + 状态文案 + 心跳延迟 ms（按 RTT 三档变色） */
function WsBadge({ status, ping }: { status: WsStatus; ping: number | null }) {
  const live = status === "open" || status === "mock";
  const label =
    status === "open"
      ? "已连接"
      : status === "mock"
        ? "演示"
        : status === "connecting"
          ? "连接中"
          : "重连中";
  // RTT 分档：良好 <200ms emerald；一般 200-600ms amber；高延迟 >600ms rose
  const tier =
    ping === null || ping < 200 ? "emerald" : ping <= 600 ? "amber" : "rose";
  const tierText = {
    emerald:
      "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber:
      "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300",
    rose: "border-rose-200/70 bg-rose-50 text-rose-600 dark:border-rose-800/70 dark:bg-rose-950/60 dark:text-rose-300",
  }[tier];
  const tierPing = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
  }[tier];
  const tierDot = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
  }[tier];
  const tierMs = {
    emerald:
      "text-emerald-600/70 dark:text-emerald-400/70",
    amber: "text-amber-600/70 dark:text-amber-400/70",
    rose: "text-rose-600/70 dark:text-rose-400/70",
  }[tier];
  return (
    <span
      title="WebSocket 实时同步状态"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium sm:px-2.5",
        live ? tierText : "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-800/70 dark:bg-amber-950/60 dark:text-amber-300",
      )}
    >
      <span className="relative flex h-2 w-2">
        {live && <span className={cn("ws-ping-dot", tierPing)} aria-hidden="true" />}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            live ? tierDot : "bg-amber-500",
          )}
        />
      </span>
      <span className="hidden sm:inline">{label}</span>
      {live && ping !== null && (
        <span className={cn("hidden font-mono text-[11px] md:inline", tierMs)}>
          {ping}ms
        </span>
      )}
    </span>
  );
}

/** 顶栏右侧 slate-100 底 soft 按钮（12px 圆角） */
function HeaderButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-100 px-2.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3"
    >
      {children}
    </button>
  );
}

export function RoomHeader({
  room,
  wsStatus,
  wsPing,
  theme,
  onThemeChange,
  onSwitchRoom,
  onShare,
  installSlot,
}: {
  room: string;
  wsStatus: WsStatus;
  wsPing: number | null;
  theme: Theme;
  onThemeChange: (t: Theme) => void;
  onSwitchRoom: () => void;
  onShare: () => void;
  /** PWA 安装按钮（不可安装时为 null） */
  installSlot?: React.ReactNode;
}) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
        {/* 左：品牌 / 房间 pill / WS 状态 */}
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3.5">
          <div className="flex shrink-0 items-center gap-2.5">
            <Logo className="size-9 shrink-0 rounded-xl shadow-sm" />
            <div className="hidden items-baseline gap-1.5 sm:flex">
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                MyClip
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                v2
              </span>
            </div>
          </div>

          <div className="hidden h-4 w-px bg-slate-200 dark:bg-slate-800 sm:block" />

          {/* 房间切换 pill */}
          <button
            type="button"
            onClick={onSwitchRoom}
            className="group inline-flex min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-200/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:px-3 sm:text-sm"
            aria-haspopup="dialog"
            aria-label={`当前房间 ${room}，点击切换`}
          >
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
              #
            </span>
            <span className="max-w-[84px] truncate sm:max-w-[140px]">{room}</span>
            <ChevronDown
              className="size-3.5 text-slate-400 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-200"
              aria-hidden="true"
            />
          </button>

          <WsBadge status={wsStatus} ping={wsPing} />
        </div>

        {/* 右：安装 / 分享 / 主题 */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {installSlot}
          <HeaderButton onClick={onShare} title="扫码或复制链接跨设备加入房间">
            <Share2 className="size-3.5" aria-hidden="true" />
            <span className="hidden md:inline">分享房间</span>
          </HeaderButton>
          <button
            type="button"
            onClick={() => onThemeChange(isDark ? "light" : "dark")}
            title="切换深色/浅色模式"
            aria-label="切换主题"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {isDark ? (
              <Sun className="size-4" aria-hidden="true" />
            ) : (
              <Moon className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
