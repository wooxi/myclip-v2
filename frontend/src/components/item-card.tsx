import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Laptop,
  Link2,
  Paperclip,
  SquarePen,
  Terminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import type { Item } from "@/types";
import { classifyItem, type ItemKind } from "@/lib/classify";
import { relativeTime } from "@/lib/relative-time";
import { cn, formatBytes, formatCountdown } from "@/lib/utils";
import { MarkdownText } from "./markdown-text";
import { legacyCopyText } from "@/lib/clipboard";

/** 类型徽标：code indigo / file amber / link sky / text slate（与 composer 顶条同套） */
function KindBadge({ kind }: { kind: ItemKind }) {
  const map = {
    code: { icon: Terminal, label: "命令 / 代码", variant: "indigo" as const },
    file: { icon: Paperclip, label: "文件", variant: "amber" as const },
    link: { icon: Link2, label: "超链接", variant: "sky" as const },
    text: { icon: SquarePen, label: "文本", variant: "slate" as const },
  };
  const { icon: Icon, label, variant } = map[kind];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

/** TTL 徽标：短 TTL（<1h）amber soft，其余 slate */
function TtlBadge({
  expireAt,
  now,
}: {
  expireAt: number | null;
  now: number;
}) {
  if (expireAt === null) {
    return <Badge variant="muted">永久</Badge>;
  }
  const short = expireAt - now < 3600_000;
  return (
    <Badge variant={short ? "amber" : "slate"} className="rounded-full">
      {formatCountdown(expireAt, now)}
    </Badge>
  );
}

function extBlock(name: string): string {
  return (name.split(".").pop() || "FILE").toUpperCase().slice(0, 4);
}

/** 从 URL 派生展示标题（hostname + 截断路径） */
function linkTitle(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.hostname}${path}`.slice(0, 64);
  } catch {
    return url.slice(0, 64);
  }
}

/** 过期倒计时/相对时间：每 10s 刷新一次 */
function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ItemCard({ item, onDeleted }: { item: Item; onDeleted: (id: string) => void }) {
  const now = useNow();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const kind = classifyItem(item);
  const expired = item.expireAt !== null && item.expireAt <= now;

  const copyText = async () => {
    const content = item.content ?? "";
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("已复制");
    } catch {
      if (legacyCopyText(content)) {
        setCopied(true);
        toast.success("已复制");
      } else toast.error("复制失败");
    }
    setTimeout(() => setCopied(false), 1600);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteItem(item.id);
      onDeleted(item.id);
      toast.success("已删除");
    } catch (e) {
      toast.error(`删除失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const downloadName = item.fileName ?? "file";
  const fileUrl = item.kind === "file" ? api.fileUrl("", item) : "";

  return (
    <article
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-card p-4 shadow-xs transition-colors duration-150 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
        expired && "opacity-60",
      )}
      aria-label={item.kind === "text" ? "文本条目" : `文件条目 ${downloadName}`}
    >
      {/* 徽标行 */}
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={kind} />
          <TtlBadge expireAt={item.expireAt} now={now} />
          <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
            <Laptop className="size-3" aria-hidden="true" />
            {item.source ?? ""}
            <span aria-hidden="true">·</span>
            {relativeTime(item.createdAt, now)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {item.kind === "text" && (
            <button
              type="button"
              onClick={() => void copyText()}
              aria-label="复制内容"
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                copied
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-indigo-600 hover:text-white dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-indigo-600",
              )}
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? "已复制" : "复制"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-haspopup="dialog"
            aria-label="删除此条记录"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-rose-950/50"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 内容体 */}
      {kind === "link" && item.content && (
        <div className="mt-2.5">
          <a
            href={item.content}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link block rounded-xl border border-slate-200/70 bg-slate-50 p-3 transition-colors duration-150 hover:border-indigo-500/60 dark:border-slate-800 dark:bg-slate-800/60"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 transition-colors group-hover/link:text-indigo-600 dark:text-slate-100 dark:group-hover/link:text-indigo-400">
              <span className="truncate">{linkTitle(item.content)}</span>
              <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            </div>
            <div className="mt-1 truncate font-mono-text text-xs text-indigo-600 dark:text-indigo-400">
              {item.content}
            </div>
          </a>
        </div>
      )}

      {kind === "code" && item.content && (
        <pre className="mt-2.5 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-100 dark:border-slate-800 dark:bg-slate-950">
          <code>{item.content}</code>
        </pre>
      )}

      {kind === "text" && item.content && (
        <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800/80 dark:bg-slate-800/40 dark:text-slate-200 sm:text-sm">
          <MarkdownText content={item.content} />
        </div>
      )}

      {kind === "file" && (
        <>
          {/* 图片/视频/音频沿用内联预览 */}
          {item.previewable && (
            <div className="mt-2.5 max-h-80 overflow-hidden rounded-xl bg-muted/40">
              {fileUrl === "" ? (
                <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Download className="size-5" aria-hidden="true" />
                  预览不可用
                </div>
              ) : (item.mime ?? "").startsWith("image/") ? (
                <img
                  src={fileUrl}
                  alt={downloadName}
                  loading="lazy"
                  className="max-h-80 w-full object-contain"
                />
              ) : (item.mime ?? "").startsWith("video/") ? (
                <video src={fileUrl} controls preload="metadata" className="max-h-80 w-full">
                  <track kind="captions" />
                </video>
              ) : (item.mime ?? "").startsWith("audio/") ? (
                <audio src={fileUrl} controls preload="metadata" className="w-full p-2">
                  <track kind="captions" />
                </audio>
              ) : (
                <pre className="max-h-80 overflow-auto p-3 font-mono-text text-xs whitespace-pre-wrap break-all">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {downloadName}
                  </a>
                </pre>
              )}
            </div>
          )}
          {/* 文件行：ext 等宽图标块 + 文件名 + 大小 + 下载 */}
          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600/10 font-mono text-xs font-bold text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
                {extBlock(downloadName)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-slate-800 sm:text-sm dark:text-slate-100">
                  {downloadName}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {item.fileSize !== undefined ? formatBytes(item.fileSize) : ""}
                </div>
              </div>
            </div>
            {fileUrl !== "" && (
              <Button size="sm" asChild className="shrink-0">
                <a
                  href={fileUrl}
                  download={downloadName}
                  aria-label={`下载 ${downloadName}`}
                >
                  <Download aria-hidden="true" />
                  下载
                </a>
              </Button>
            )}
          </div>
        </>
      )}

      {/* 删除二次确认：破坏性确认默认聚焦安全选项 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除这个条目？</DialogTitle>
            <DialogDescription>
              {item.kind === "text" ? "文本" : downloadName} 将对房间内所有人消失，操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" autoFocus disabled={deleting}>
                取消
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void doDelete()} disabled={deleting}>
              <Trash2 aria-hidden="true" />
              {deleting ? "删除中…" : "删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
