import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { ttlLabel, type Item, type TtlValue } from "@/types";
import type { AppConfig } from "@/app-config";
import { cn } from "@/lib/utils";
import { uploadFiles, abortUpload, clearAbort } from "@/lib/upload";

type UploadState = {
  name: string;
  percent: number;
} | null;

export function Composer({
  room,
  config,
  ttl,
  onTtlChange,
  onCreated,
  onFilesChosen,
}: {
  room: string;
  config: AppConfig;
  ttl: TtlValue;
  onTtlChange: (v: TtlValue) => void;
  onCreated: (item: Item) => void;
  /** 把外部选择的文件交给父级（拖拽/粘贴入口） */
  onFilesChosen?: (files: File[]) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [upload, setUpload] = useState<UploadState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // field-sizing: content 自动增高；不支持的浏览器降级 JS 同步高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  const sendText = useCallback(async () => {
    const content = text.trim();
    if (!content || sending) return;
    if (content.length > config.textLimit) {
      toast.error(
        `文本超出上限（最大 ${Math.floor(config.textLimit / 1024)} KB）`,
      );
      return;
    }
    setSending(true);
    try {
      const item = await api.postText(room, { content, ttl });
      onCreated(item);
      setText("");
    } catch (e) {
      toast.error(`发送失败：${e instanceof Error ? e.message : e}`);
    } finally {
      setSending(false);
    }
  }, [text, ttl, sending, room, config, onCreated]);

  // Ctrl/Cmd+Enter 提交（与 IME 确认键不冲突，无需 isComposing 检查）
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void sendText();
    }
  };

  // 文件按钮上传：单文件时显示内联逐片进度条
  const handlePick = (files: File[]) => {
    const target = files[0];
    if (files.length === 1 && target) {
      setUpload({ name: target.name, percent: 0 });
    }
    void uploadFiles(room, files, ttl, config, {
      onCreated: onCreated,
      onProgress: (file, percent) =>
        setUpload((u) => (u && u.name === file.name ? { ...u, percent } : u)),
    }).finally(() => {
      if (target) clearAbort(target.name);
      setUpload((u) => (u && target && u.name === target.name ? null : u));
    });
  };

  // Ctrl+V 粘贴图片/文件
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        onFilesChosen?.(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onFilesChosen]);

  return (
    <section aria-label="发送内容" className="flex flex-col gap-2">
      <div className="relative">
        <label htmlFor="composer-input" className="sr-only">
          要发送的文本
        </label>
        <Textarea
          id="composer-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="输入要发送的文本…"
          className="min-h-24 max-h-80 text-base"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* TTL chips，默认永久 */}
        <div role="group" aria-label="过期时间" className="flex flex-wrap gap-1.5">
          {config.ttlOptions.map((opt) => (
            <button
              key={ttlLabel(opt)}
              type="button"
              aria-pressed={ttl === opt}
              onClick={() => onTtlChange(opt)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
                ttl === opt
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {ttlLabel(opt)}
            </button>
          ))}
        </div>

        <div className="ms-auto flex items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="选择文件上传"
            onChange={(e) => {
              handlePick(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload aria-hidden="true" />
            文件
          </Button>
          <Button size="sm" onClick={() => void sendText()} disabled={!text.trim() || sending}>
            {sending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            发送
            <kbd className="ms-1 hidden text-[10px] opacity-70 sm:inline">⌘↵</kbd>
          </Button>
        </div>
      </div>

      {upload && (
        <div className="rounded-md border border-border p-2.5">
          <div className="mb-1.5 flex items-center gap-2 text-xs">
            <Badge variant="muted">{upload.percent === 0 ? "准备中" : "分片上传"}</Badge>
            <span className="truncate font-medium">{upload.name}</span>
            <span className="ms-auto text-muted-foreground">{upload.percent}%</span>
            <button
              type="button"
              aria-label="取消上传"
              className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => {
                abortUpload(upload.name);
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <Progress value={upload.percent} aria-label={`上传进度 ${upload.percent}%`} />
        </div>
      )}
    </section>
  );
}
