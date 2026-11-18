import { Suspense, lazy } from "react";
import {
  ArrowRight,
  FileImage,
  FileText,
  ImageDown,
  LayoutGrid,
  Stamp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ToolId } from "@/hooks/use-room-route";
import { isImageFile, isPdfFile } from "@/lib/file-utils";
import { ToolDropArea } from "./tool-shared";
import { WatermarkTool } from "./watermark-tool";
import { ImageConvertTool } from "./image-convert-tool";

// PDF 依赖（pdfjs-dist + pdf-lib）按需分包加载，不拖慢其他工具与剪贴板首屏
const PdfImageTool = lazy(() =>
  import("./pdf-image-tool").then((m) => ({ default: m.PdfImageTool })),
);
const PdfEditTool = lazy(() =>
  import("./pdf-edit-tool").then((m) => ({ default: m.PdfEditTool })),
);

type ToolMeta = {
  id: ToolId;
  title: string;
  tags: string[];
  icon: typeof Stamp;
  badgeVariant: "indigo" | "amber" | "sky" | "emerald";
};

const TOOLS: ToolMeta[] = [
  {
    id: "watermark",
    title: "图片加水印",
    tags: ["文字平铺", "单点定位", "Logo 水印", "ZIP 批量"],
    icon: Stamp,
    badgeVariant: "indigo",
  },
  {
    id: "pdf-image",
    title: "PDF ↔ 图片互转",
    tags: ["PDF 转 PNG/JPG", "图片合成 A4 PDF", "排序导出"],
    icon: FileImage,
    badgeVariant: "amber",
  },
  {
    id: "image-convert",
    title: "图片转换 & 压缩",
    tags: ["WebP / JPG / PNG", "尺寸缩放", "清除 EXIF"],
    icon: ImageDown,
    badgeVariant: "emerald",
  },
  {
    id: "pdf-edit",
    title: "PDF 水印与合并拆分",
    tags: ["PDF 加水印", "多 PDF 合并", "按页拆分提取"],
    icon: FileText,
    badgeVariant: "sky",
  },
];

function ToolLoadingFallback() {
  return (
    <div
      className="flex min-h-64 items-center justify-center rounded-2xl border border-slate-200/90 bg-card dark:border-slate-800"
      aria-busy="true"
    >
      <span
        className="size-6 animate-spin rounded-full border-2 border-border border-t-indigo-600"
        aria-label="加载工具中"
        role="status"
      />
    </div>
  );
}

export function ToolsWorkspace({
  tool,
  room,
  initialFiles,
  onSelectTool,
  onConsumeInitialFiles,
  onDispatchDroppedFiles,
  onSendToRoom,
}: {
  tool: ToolId | null;
  room: string;
  initialFiles: File[];
  onSelectTool: (next: ToolId | null) => void;
  onConsumeInitialFiles: () => void;
  onDispatchDroppedFiles: (files: File[], target: ToolId) => void;
  onSendToRoom: (files: File[]) => Promise<void>;
}) {
  const handleQuickDrop = (files: File[]) => {
    const hasPdf = files.some((f) => isPdfFile(f));
    const hasImg = files.some((f) => isImageFile(f));
    if (hasPdf) {
      onDispatchDroppedFiles(files, files.filter(isPdfFile).length > 1 ? "pdf-edit" : "pdf-image");
    } else if (hasImg) {
      onDispatchDroppedFiles(files, "watermark");
    }
  };

  return (
    <div className="space-y-5">
      {/* 二级导航条 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-card p-2.5 shadow-xs dark:border-slate-800 sm:px-4">
        <div
          role="tablist"
          aria-label="工具切换"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tool === null}
            onClick={() => onSelectTool(null)}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
              tool === null
                ? "bg-slate-900 font-semibold text-white dark:bg-indigo-600"
                : "font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            全部工具
          </button>
          {TOOLS.map((item) => {
            const Icon = item.icon;
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectTool(item.id)}
                className={cn(
                  "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-slate-900 font-semibold text-white dark:bg-indigo-600"
                    : "font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {item.title}
              </button>
            );
          })}
        </div>

        <span className="hidden shrink-0 font-mono text-[11px] text-slate-400 xl:inline">
          本地处理 · 可直发 #{room}
        </span>
      </div>

      {/* 工具总览 vs 具体工具工作区 */}
      {tool === null ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TOOLS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTool(item.id)}
                  className="group flex cursor-pointer flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-card p-5 text-left shadow-xs transition-all duration-150 hover:border-indigo-400/70 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-800 dark:hover:border-indigo-500/60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-950/70 dark:text-indigo-300">
                        <Icon className="size-5" aria-hidden="true" />
                      </div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </h2>
                    </div>
                    <ArrowRight
                      className="size-4 text-slate-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} variant={item.badgeVariant}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <ToolDropArea
            accept="image/*,application/pdf,.pdf"
            compact
            title="直接拖入图片或 PDF 快速进入对应工具"
            hint="所有文件均在浏览器本地完成转换与处理"
            onFiles={handleQuickDrop}
          />
        </div>
      ) : tool === "watermark" ? (
        <WatermarkTool
          room={room}
          initialFiles={initialFiles}
          onConsumeInitialFiles={onConsumeInitialFiles}
          onSendToRoom={onSendToRoom}
        />
      ) : tool === "image-convert" ? (
        <ImageConvertTool
          room={room}
          initialFiles={initialFiles}
          onConsumeInitialFiles={onConsumeInitialFiles}
          onSendToRoom={onSendToRoom}
        />
      ) : (
        <Suspense fallback={<ToolLoadingFallback />}>
          {tool === "pdf-image" ? (
            <PdfImageTool
              room={room}
              initialFiles={initialFiles}
              onConsumeInitialFiles={onConsumeInitialFiles}
              onSendToRoom={onSendToRoom}
            />
          ) : (
            <PdfEditTool
              room={room}
              initialFiles={initialFiles}
              onConsumeInitialFiles={onConsumeInitialFiles}
              onSendToRoom={onSendToRoom}
            />
          )}
        </Suspense>
      )}
    </div>
  );
}
