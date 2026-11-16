import { useRef } from "react";
import { FilePlus2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 空状态拖放大区：单个大图标块（可点击选文件，无引导文字）。
 * 拖放入口统一由 App 的全页级拖放监听处理，本组件不再挂 drag 事件。
 */
export function EmptyDropzone({
  onFiles,
  className,
}: {
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      aria-label="暂无内容"
      className={cn(
        "flex min-h-[420px] flex-1 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 p-6 transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900/40 sm:p-10",
        className,
      )}
    >
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
        aria-label="选择文件上传"
        className="group grid cursor-pointer place-items-center rounded-2xl p-8 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div className="flex size-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-300 transition-all duration-200 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:text-indigo-400 dark:bg-slate-800 dark:text-slate-700 dark:group-hover:bg-indigo-950/80 dark:group-hover:text-indigo-400">
          <FilePlus2 className="size-10" aria-hidden="true" />
        </div>
      </button>
    </div>
  );
}
