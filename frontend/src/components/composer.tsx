import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock3,
  Clipboard,
  ClipboardPaste,
  CopyX,
  Link2,
  Loader2,
  Paperclip,
  Send,
  SquarePen,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/api";
import { classifyText } from "@/lib/classify";
import { ttlLabel, type Item, type TtlValue } from "@/types";
import type { AppConfig } from "@/app-config";
import { cn, formatBytes } from "@/lib/utils";
import { uploadFiles, clearAbort } from "@/lib/upload";

type StagedFile = {
  file: File;
  /** 上传进度 0-100；null = 未开始 */
  percent: number | null;
};

/** composer 顶条类型识别徽标（与条目卡同套令牌） */
function DetectedBadge({ text }: { text: string }) {
  const kind = classifyText(text);
  const map = {
    link: { icon: Link2, label: "链接 URL", variant: "sky" as const },
    code: { icon: Terminal, label: "代码 / 命令", variant: "indigo" as const },
    text: { icon: SquarePen, label: "纯文本", variant: "slate" as const },
  };
  const { icon: Icon, label, variant } = map[kind];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function Composer({
  room,
  config,
  ttl,
  onTtlChange,
  onCreated,
  onFilesChosen,
  onPasteSend,
}: {
  room: string;
  config: AppConfig;
  ttl: TtlValue;
  onTtlChange: (v: TtlValue) => void;
  onCreated: (item: Item) => void;
  /** 把外部选择的文件交给父级（拖拽/粘贴直传入口） */
  onFilesChosen?: (files: File[]) => void;
  /** 读取系统剪贴板并直接发送（文本→文本条目，文件→暂存直传） */
  onPasteSend?: () => void;
}) {
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // field-sizing: content 自动增高；不支持的浏览器降级 JS 同步高度
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || CSS.supports("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text]);

  const hasContent = text.trim().length > 0 || staged.length > 0;

  const stageFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setStaged((prev) => [...prev, ...files.map((file) => ({ file, percent: null }))]);
  }, []);

  const sendText = useCallback(
    async (content: string) => {
      const item = await api.postText(room, { content, ttl });
      onCreated(item);
    },
    [room, ttl, onCreated],
  );

  /** 发送：暂存文件统一上传（chip 内联进度）→ 文本提交 */
  const send = useCallback(async () => {
    if (!hasContent || sending) return;
    setSending(true);
    try {
      const files = staged.map((s) => s.file);
      if (files.length) {
        await uploadFiles(room, files, ttl, config, {
          onCreated: onCreated,
          onProgress: (file, percent) =>
            setStaged((prev) =>
              prev.map((s) =>
                s.file === file ? { ...s, percent } : s,
              ),
            ),
        });
        setStaged([]);
      }
      const content = text.trim();
      if (content) {
        if (content.length > config.textLimit) {
          toast.error(
            `文本超出上限（最大 ${Math.floor(config.textLimit / 1024)} KB）`,
          );
        } else {
          await sendText(content);
          setText("");
        }
      }
    } catch (e) {
      toast.error(`发送失败：${e instanceof Error ? e.message : e}`);
    } finally {
      for (const s of staged) clearAbort(s.file.name);
      setSending(false);
    }
  }, [hasContent, sending, staged, room, ttl, config, onCreated, sendText, text]);

  // Ctrl/Cmd+Enter 提交（与 IME 确认键不冲突，无需 isComposing 检查）
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void send();
    }
  };

  /** 一键粘贴：优先文本填入 textarea，剪贴板含文件则转入暂存 */
  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setText(t);
        textareaRef.current?.focus();
        return;
      }
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const ci of items) {
        const type = ci.types.find((t2) => t2.startsWith("image/"));
        if (type) {
          const blob = await ci.getType(type);
          files.push(
            new File([blob], `clipboard.${type.split("/")[1] ?? "png"}`, {
              type,
            }),
          );
        }
      }
      if (files.length) {
        stageFiles(files);
        toast.success(`已读取 ${files.length} 个剪贴板文件`);
      } else {
        toast.info("剪贴板为空");
      }
    } catch {
      toast.error("无法读取系统剪贴板");
    }
  };

  const clearAll = () => {
    setText("");
    setStaged([]);
    textareaRef.current?.focus();
  };

  // Ctrl+V 粘贴图片/文件 → 直传（保持现有行为）
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
    <section
      aria-label="发送内容"
      className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs transition-all duration-200 focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/20 dark:border-slate-800"
    >
      {/* 顶条 */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            新建发送内容
          </h2>
          {text.trim() && <DetectedBadge text={text} />}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void pasteFromClipboard()}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors duration-150 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
          >
            <Clipboard className="size-3.5" aria-hidden="true" />
            粘贴
          </button>
          {hasContent && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-rose-950/40"
            >
              <CopyX className="size-3.5" aria-hidden="true" />
              清空
            </button>
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div className="p-4">
        <label htmlFor="composer-input" className="sr-only">
          要发送的文本
        </label>
        <Textarea
          id="composer-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          rows={5}
          placeholder="输入要发送的文本…"
          className="max-h-80 min-h-24 resize-none rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed shadow-none sm:text-base dark:bg-transparent focus-visible:ring-0"
        />

        {/* 附件暂存列表 */}
        {staged.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-dashed border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 font-medium">
                <Paperclip className="size-3.5 text-indigo-500" aria-hidden="true" />
                待发送附件（{staged.length}）
              </span>
              <button
                type="button"
                onClick={() => setStaged([])}
                className="cursor-pointer text-[11px] text-rose-500 hover:underline"
              >
                移除全部
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {staged.map((s) => (
                <li
                  key={s.file.name}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {s.percent !== null ? (
                    <Loader2 className="size-3 animate-spin text-indigo-500" aria-hidden="true" />
                  ) : (
                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {(s.file.name.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
                    </span>
                  )}
                  <span className="max-w-[140px] truncate text-slate-700 dark:text-slate-200">
                    {s.file.name}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {s.percent !== null ? `${s.percent}%` : formatBytes(s.file.size)}
                  </span>
                  {s.percent === null && (
                    <button
                      type="button"
                      aria-label={`移除 ${s.file.name}`}
                      className="cursor-pointer text-slate-400 transition-colors hover:text-rose-500"
                      onClick={() =>
                        setStaged((prev) => prev.filter((x) => x.file !== s.file))
                      }
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 字符计数 */}
        <div className="mt-2 flex items-center justify-end text-[11px] text-slate-400 dark:text-slate-500">
          <span className="font-mono">{text.length} 字符</span>
        </div>
      </div>

      {/* TTL 条 */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-slate-800/80 dark:bg-slate-800/40">
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" title="到期后自动从云端销毁">
          <Clock3 className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">过期销毁:</span>
        </div>
        <div
          role="group"
          aria-label="过期时间"
          className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5"
        >
          {config.ttlOptions.map((opt) => (
            <button
              key={ttlLabel(opt)}
              type="button"
              aria-pressed={ttl === opt}
              onClick={() => onTtlChange(opt)}
              className={cn(
                "shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                ttl === opt
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
              )}
            >
              {ttlLabel(opt)}
            </button>
          ))}
        </div>
      </div>

      {/* 操作条 */}
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:px-4 sm:py-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label="选择文件暂存"
          onChange={(e) => {
            stageFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="border border-slate-200/80 bg-slate-100 text-slate-700 shadow-xs hover:bg-slate-200/80 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="text-slate-600 dark:text-slate-300" aria-hidden="true" />
            选择文件
          </Button>
          {onPasteSend && (
            <Button
              variant="ghost"
              size="lg"
              title="读取剪贴板并直接发送"
              className="border border-emerald-200/60 bg-emerald-50 text-emerald-600 shadow-xs hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/80"
              onClick={onPasteSend}
            >
              <ClipboardPaste className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="hidden sm:inline">粘贴即发</span>
            </Button>
          )}
        </div>
        <Button
          size="lg"
          onClick={() => void send()}
          disabled={!hasContent || sending}
          className="text-xs sm:text-sm"
        >
          {sending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          发送
        </Button>
      </div>
    </section>
  );
}
