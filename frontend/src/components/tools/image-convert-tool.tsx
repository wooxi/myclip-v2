import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Download, ImageDown, Loader2, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn, formatBytes } from "@/lib/utils";
import { downloadAsZip, isImageFile, triggerDownload } from "@/lib/file-utils";
import {
  convertAndCompressImage,
  type ImageConvertResult,
  type ImageTargetFormat,
} from "@/lib/image-convert";
import {
  SliderField,
  ToolDropArea,
  ToolResultActions,
  useObjectUrl,
  type ToolCommonProps,
} from "./tool-shared";

const FORMAT_OPTIONS: { key: ImageTargetFormat; label: string }[] = [
  { key: "image/webp", label: "WebP" },
  { key: "image/jpeg", label: "JPG" },
  { key: "image/png", label: "PNG" },
];

const DIMENSION_PRESETS: { value: number | null; label: string }[] = [
  { value: null, label: "原尺寸" },
  { value: 1920, label: "1920px" },
  { value: 1280, label: "1280px" },
  { value: 800, label: "800px" },
];

function ResultRow({
  item,
  onRemove,
}: {
  item: ImageConvertResult;
  onRemove: () => void;
}) {
  const thumbUrl = useObjectUrl(item.outputFile);
  const diffPct = Math.round(
    ((item.outputFile.size - item.sourceFile.size) / Math.max(1, item.sourceFile.size)) * 100,
  );
  const saved = diffPct <= 0;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={item.outputFile.name}
            className="size-12 shrink-0 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-xl bg-muted" />
        )}
        <div className="min-w-0 space-y-1">
          <div className="truncate text-xs font-semibold text-slate-800 sm:text-sm dark:text-slate-100">
            {item.outputFile.name}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span>{formatBytes(item.sourceFile.size)}</span>
            <ArrowRight className="size-3" aria-hidden="true" />
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {formatBytes(item.outputFile.size)}
            </span>
            <Badge variant={saved ? "emerald" : "amber"} className="font-mono">
              {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
            </Badge>
            <span>
              {item.width}×{item.height}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => triggerDownload(item.outputFile, item.outputFile.name)}
        >
          <Download aria-hidden="true" />
          下载
        </Button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`移除 ${item.sourceFile.name}`}
          className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function ImageConvertTool({
  room,
  initialFiles,
  onConsumeInitialFiles,
  onSendToRoom,
}: ToolCommonProps) {
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<ImageTargetFormat>("image/webp");
  const [quality, setQuality] = useState(82);
  const [maxDimension, setMaxDimension] = useState<number | null>(null);
  const [customDim, setCustomDim] = useState("");
  const [results, setResults] = useState<ImageConvertResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);

  const addMoreRef = useRef<HTMLInputElement>(null);

  const appendImages = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => isImageFile(f));
    if (valid.length === 0) {
      toast.error("请选择有效的图片文件");
      return;
    }
    setSourceFiles((prev) => [...prev, ...valid]);
  }, []);

  useEffect(() => {
    if (initialFiles.length === 0) return;
    const valid = initialFiles.filter((f) => isImageFile(f));
    if (valid.length > 0) setSourceFiles((prev) => [...prev, ...valid]);
    onConsumeInitialFiles();
  }, [initialFiles, onConsumeInitialFiles]);

  // 源列表或参数变更时自动重新转换
  useEffect(() => {
    if (sourceFiles.length === 0) {
      setResults([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(() => {
      setProcessing(true);
      void (async () => {
        try {
          const out: ImageConvertResult[] = [];
          for (const file of sourceFiles) {
            if (!alive) return;
            out.push(
              await convertAndCompressImage(file, {
                format,
                quality: quality / 100,
                maxDimension,
              }),
            );
          }
          if (alive) setResults(out);
        } catch (e) {
          if (alive) toast.error(`转换失败：${e instanceof Error ? e.message : e}`);
        } finally {
          if (alive) setProcessing(false);
        }
      })();
    }, 120);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sourceFiles, format, quality, maxDimension]);

  const totalOrig = results.reduce((s, r) => s + r.sourceFile.size, 0);
  const totalOut = results.reduce((s, r) => s + r.outputFile.size, 0);
  const outputFiles = results.map((r) => r.outputFile);

  const handleDownload = async () => {
    if (outputFiles.length === 0) return;
    if (outputFiles.length === 1) {
      triggerDownload(outputFiles[0], outputFiles[0].name);
    } else {
      await downloadAsZip(outputFiles, "converted-images.zip");
    }
  };

  const handleSend = async () => {
    if (outputFiles.length === 0) return;
    setSending(true);
    try {
      await onSendToRoom(outputFiles);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 左 5 栏：转换参数 */}
      <section className="flex flex-col gap-4 lg:col-span-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                图片格式转换 & 压缩
              </h2>
            </div>
            <Badge variant="emerald" className="gap-1">
              <ShieldCheck className="size-3" aria-hidden="true" />
              自动清除 EXIF
            </Badge>
          </div>

          <div className="space-y-4 p-4">
            {/* 目标格式 */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                目标格式
              </span>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFormat(opt.key)}
                    className={cn(
                      "cursor-pointer rounded-lg py-1.5 text-xs transition-colors",
                      format === opt.key
                        ? "bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
                        : "font-medium text-slate-600 dark:text-slate-400",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {format !== "image/png" && (
              <SliderField
                label="压缩画质"
                valueLabel={`${quality}%`}
                value={quality}
                min={20}
                max={100}
                onChange={setQuality}
              />
            )}

            {/* 最长边限制 */}
            <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                最长边尺寸限制
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DIMENSION_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setMaxDimension(p.value);
                      setCustomDim(p.value ? String(p.value) : "");
                    }}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      maxDimension === p.value
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  min={64}
                  max={8192}
                  value={customDim}
                  placeholder="自定义最大像素边长（如 1600）"
                  className="h-8 text-xs font-mono"
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDim(val);
                    const n = Number(val);
                    setMaxDimension(Number.isFinite(n) && n >= 64 ? n : null);
                  }}
                />
              </div>
            </div>

            {results.length > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400">总体积变化</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {formatBytes(totalOrig)} → {formatBytes(totalOut)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              {processing ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-indigo-500" aria-hidden="true" />
                  处理中…
                </>
              ) : (
                <>
                  <ImageDown className="size-3.5 text-indigo-500" aria-hidden="true" />
                  已就绪 {results.length} 项
                </>
              )}
            </span>

            <ToolResultActions
              room={room}
              hasResults={outputFiles.length > 0}
              multiple={outputFiles.length > 1}
              processing={processing}
              sending={sending}
              onDownload={() => void handleDownload()}
              onDownloadZip={() => void handleDownload()}
              onSendToRoom={() => void handleSend()}
            />
          </div>
        </div>
      </section>

      {/* 右 7 栏：结果对照 */}
      <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
        <input
          ref={addMoreRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            appendImages(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />

        {sourceFiles.length === 0 ? (
          <ToolDropArea
            accept="image/*"
            title="选择或拖入需要转换/压缩的图片"
            hint="支持 PNG / JPG / WebP / GIF / BMP / SVG，批量输出对比"
            onFiles={appendImages}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:px-4">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                队列文件（{sourceFiles.length}）
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addMoreRef.current?.click()}
                >
                  <Plus aria-hidden="true" />
                  添加图片
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSourceFiles([])}
                  aria-label="清空队列"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>

            <ul className="flex flex-col gap-3">
              {results.map((item, idx) => (
                <ResultRow
                  key={`${item.sourceFile.name}-${idx}`}
                  item={item}
                  onRemove={() =>
                    setSourceFiles((prev) => prev.filter((_, i) => i !== idx))
                  }
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
