import { useRef, useState } from "react";
import { ClipboardPaste, FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 拖放区：空状态为大区 + 双操作卡；有内容时收缩为矮条，仍可拖入。
 * dragenter/dragleave 计数法避免子元素抖动；drop 把文件交给回调。
 */
export function EmptyDropzone({
  onFiles,
  onPasteSend,
  empty,
  loading,
}: {
  onFiles: (files: File[]) => void;
  onPasteSend: () => void;
  /** 房间完全无内容时展示大区，否则矮条 */
  empty: boolean;
  loading: boolean;
}) {
  const [active, setActive] = useState(false);
  const counter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasFiles = (e: DragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e.nativeEvent)) return;
    e.preventDefault();
    counter.current++;
    setActive(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e.nativeEvent)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e.nativeEvent)) return;
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e.nativeEvent)) return;
    e.preventDefault();
    counter.current = 0;
    setActive(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      aria-label={empty ? "暂无内容" : "拖放上传"}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/40",
        empty ? "min-h-[420px] p-6 sm:p-10" : "p-5",
        active && "border-indigo-500 bg-indigo-500/5",
      )}
    >
      {loading ? (
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground" aria-label="加载中" role="status" />
      ) : (
        <div className="grid w-full max-w-lg grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* 上传文件或图片 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="选择文件上传"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onFiles(files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-card p-4 text-left transition-all duration-200 hover:border-indigo-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500 sm:flex-col sm:justify-center sm:p-6 sm:text-center"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-all duration-200 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/80 dark:text-indigo-400">
              <FilePlus2 className="size-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                上传文件或图片
              </div>
              <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                支持拖拽上传 · 不限格式
              </div>
            </div>
          </button>

          {/* 粘贴剪贴板并发送 */}
          <button
            type="button"
            onClick={onPasteSend}
            className="group flex cursor-pointer items-center gap-3.5 rounded-2xl border border-slate-200/90 bg-card p-4 text-left transition-all duration-200 hover:border-emerald-500 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500 sm:flex-col sm:justify-center sm:p-6 sm:text-center"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-all duration-200 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white dark:bg-emerald-950/80 dark:text-emerald-400">
              <ClipboardPaste className="size-6" aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 transition-colors group-hover:text-emerald-600 dark:text-slate-100 dark:group-hover:text-emerald-400">
                粘贴剪贴板并发送
              </div>
              <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                一键读取系统剪贴板{" "}
                <kbd className="rounded-md bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                  Ctrl+V
                </kbd>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
