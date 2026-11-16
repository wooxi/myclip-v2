import { useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 拖放区：空状态为大区（纯图形化放置目标），有内容时收缩为矮条，仍可拖入。
 * dragenter/dragleave 计数法避免子元素抖动；drop 把文件交给回调。
 * 文件选择与粘贴即发入口固定在左侧 Composer 操作条（不随条目增长移动）。
 */
export function EmptyDropzone({
  onFiles,
  empty,
  loading,
}: {
  onFiles: (files: File[]) => void;
  /** 房间完全无内容时展示大区，否则矮条 */
  empty: boolean;
  loading: boolean;
}) {
  const [active, setActive] = useState(false);
  const counter = useRef(0);

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
      ) : empty ? (
        // 空状态：图形化放置目标（可点击进入文件选择，自解释入口）
        <label className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl p-8 transition-colors duration-200 focus-within:outline-none focus-within:ring-[3px] focus-within:ring-ring/50">
          <input
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
          <div className="flex size-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 transition-all duration-200 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:text-indigo-400 dark:bg-slate-800 dark:text-slate-700 dark:group-hover:bg-indigo-950/80 dark:group-hover:text-indigo-400">
            <FilePlus2 className="size-10" aria-hidden="true" />
          </div>
        </label>
      ) : null}
    </div>
  );
}
