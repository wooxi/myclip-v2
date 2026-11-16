import { useEffect, useState } from "react";
import {
  AudioLines,
  ClipboardCopy,
  Download,
  File as FileIcon,
  FileText,
  Film,
  Image as ImageIcon,
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
import { cn, formatBytes, formatCountdown } from "@/lib/utils";
import { MarkdownText } from "./markdown-text";
import { legacyCopyText } from "@/lib/clipboard";

function kindIcon(item: Item) {
  const mime = item.mime ?? "";
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Film;
  if (mime.startsWith("audio/")) return AudioLines;
  if (mime.startsWith("text/")) return FileText;
  return FileIcon;
}

/** 过期倒计时：每 10s 刷新一次（<1h 显示 mm:ss） */
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
  const expired = item.expireAt !== null && item.expireAt <= now;

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(item.content ?? "");
      toast.success("已复制");
    } catch {
      if (legacyCopyText(item.content ?? "")) toast.success("已复制");
      else toast.error("复制失败");
    }
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
  const Icon = kindIcon(item);

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-3",
        expired && "opacity-60",
      )}
      aria-label={item.kind === "text" ? "文本条目" : `文件条目 ${downloadName}`}
    >
      <header className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {item.kind === "file" ? (
          <>
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate font-medium text-foreground">{downloadName}</span>
            {item.fileSize !== undefined && <span>{formatBytes(item.fileSize)}</span>}
          </>
        ) : (
          <>
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            <span>文本</span>
          </>
        )}
        <span className="ms-auto flex items-center gap-1.5">
          {item.expireAt !== null && (
            <Badge variant={item.expireAt - now < 3600_000 ? "destructive" : "muted"}>
              {formatCountdown(item.expireAt, now)}
            </Badge>
          )}
          {item.expireAt === null && <Badge variant="muted">永久</Badge>}
        </span>
      </header>

      {item.kind === "text" && (
        <div className="max-w-3xl min-w-0">
          <MarkdownText content={item.content ?? ""} />
        </div>
      )}

      {item.kind === "file" && item.previewable && (
        <div className="max-h-80 overflow-hidden rounded-md bg-muted/40">
          {fileUrl === "" ? (
            <div className="flex h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-5" aria-hidden="true" />
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

      <footer className="flex flex-wrap items-center gap-1.5">
        {item.kind === "text" && (
          <Button variant="secondary" size="sm" onClick={() => void copyText()}>
            <ClipboardCopy aria-hidden="true" />
            复制
          </Button>
        )}
        {item.kind === "file" && fileUrl !== "" && (
          <Button variant="secondary" size="sm" asChild>
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
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmOpen(true)}
          aria-haspopup="dialog"
        >
          <Trash2 aria-hidden="true" />
          删除
        </Button>
      </footer>

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
