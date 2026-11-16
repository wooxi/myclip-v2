import { Hash, MonitorSmartphone, MoonStar, Share2, Sun, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WsStatus } from "@/api";

function WsBadge({ status }: { status: WsStatus }) {
  const label =
    status === "open"
      ? "已连接"
      : status === "mock"
        ? "演示"
        : status === "connecting"
          ? "连接中"
          : "离线重连中";
  const Icon = status === "closed" ? WifiOff : status === "open" ? Wifi : Wifi;
  return (
    <Badge variant={status === "open" || status === "mock" ? "muted" : "destructive"}>
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function RoomHeader({
  room,
  wsStatus,
  isMock,
  theme,
  onThemeChange,
  onSwitchRoom,
  onShare,
}: {
  room: string;
  wsStatus: WsStatus;
  isMock: boolean;
  theme: "system" | "light" | "dark";
  onThemeChange: (t: "system" | "light" | "dark") => void;
  onSwitchRoom: () => void;
  onShare: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-5xl items-center gap-2 px-3">
        <span className="font-semibold tracking-tight" aria-hidden="true">
          MyClip
        </span>
        {isMock && <Badge variant="outline">演示数据</Badge>}

        <button
          type="button"
          onClick={onSwitchRoom}
          className="flex min-w-0 cursor-pointer items-center gap-1 rounded-md border border-border bg-muted/50 px-2.5 py-1 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-haspopup="dialog"
          aria-label={`当前房间 ${room}，点击切换`}
        >
          <Hash className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="truncate font-medium">{room}</span>
        </button>
        <WsBadge status={wsStatus} />

        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onShare}
            aria-label="分享房间"
          >
            <Share2 aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="切换主题">
                {theme === "system" ? (
                  <MonitorSmartphone aria-hidden="true" />
                ) : theme === "dark" ? (
                  <MoonStar aria-hidden="true" />
                ) : (
                  <Sun aria-hidden="true" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onThemeChange("system")}>
                跟随系统{theme === "system" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("dark")}>
                暗色{theme === "dark" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onThemeChange("light")}>
                亮色{theme === "light" && <span className="ms-auto text-xs text-muted-foreground">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
