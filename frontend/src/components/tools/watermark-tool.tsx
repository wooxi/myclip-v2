import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Stamp, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatBytes } from "@/lib/utils";
import {
  downloadAsZip,
  isImageFile,
  loadImageElement,
  triggerDownload,
} from "@/lib/file-utils";
import {
  DEFAULT_WATERMARK_CONFIG,
  renderWatermarkOverlay,
  watermarkImageFile,
  type WatermarkConfig,
  type WatermarkOutputFormat,
} from "@/lib/watermark";
import {
  SliderField,
  ToolDropArea,
  ToolResultActions,
  WatermarkControls,
  type ToolCommonProps,
} from "./tool-shared";

const OUTPUT_FORMATS: { key: WatermarkOutputFormat; label: string }[] = [
  { key: "keep", label: "原格式" },
  { key: "image/png", label: "PNG" },
  { key: "image/jpeg", label: "JPG" },
  { key: "image/webp", label: "WebP" },
];

export function WatermarkTool({
  room,
  initialFiles,
  onConsumeInitialFiles,
  onSendToRoom,
}: ToolCommonProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [config, setConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [outputFormat, setOutputFormat] = useState<WatermarkOutputFormat>("keep");
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<File[]>([]);

  const addMoreRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const appendImages = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => isImageFile(f));
    if (valid.length === 0) {
      toast.error("请选择有效的图片文件");
      return;
    }
    setFiles((prev) => [...prev, ...valid]);
    setResults([]);
  }, []);

  useEffect(() => {
    if (initialFiles.length === 0) return;
    const valid = initialFiles.filter((f) => isImageFile(f));
    if (valid.length > 0) {
      setFiles((prev) => [...prev, ...valid]);
      setResults([]);
    }
    onConsumeInitialFiles();
  }, [initialFiles, onConsumeInitialFiles]);

  // 解码 Logo 图片
  useEffect(() => {
    let alive = true;
    if (!logoFile) {
      setLogoImg(null);
      return;
    }
    loadImageElement(logoFile)
      .then((img) => {
        if (alive) setLogoImg(img);
      })
      .catch(() => {
        if (alive) {
          setLogoImg(null);
          toast.error("Logo 图片读取失败");
        }
      });
    return () => {
      alive = false;
    };
  }, [logoFile]);

  const activeFile = files[activeIdx] ?? null;

  // 实时渲染当前选中图片的 Canvas 水印预览
  useEffect(() => {
    let alive = true;
    const canvas = previewCanvasRef.current;
    if (!activeFile || !canvas) return;

    loadImageElement(activeFile)
      .then((img) => {
        if (!alive) return;
        const maxSide = 1280;
        const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        renderWatermarkOverlay(ctx, canvas.width, canvas.height, config, logoImg);
      })
      .catch(() => {
        /* 解码失败忽略 */
      });

    return () => {
      alive = false;
    };
  }, [activeFile, config, logoImg]);

  // 参数变更时清空旧批量结果，避免导出过期文件
  useEffect(() => {
    setResults([]);
  }, [config, logoFile, outputFormat, quality]);

  const generateAll = async (): Promise<File[] | null> => {
    if (files.length === 0) return null;
    if (config.mode === "text" && !config.text.trim()) {
      toast.error("请输入水印文本");
      return null;
    }
    if (config.mode === "image" && !logoImg) {
      toast.error("请先选择 Logo 图片");
      return null;
    }
    setProcessing(true);
    try {
      const out: File[] = [];
      for (const file of files) {
        out.push(
          await watermarkImageFile(
            file,
            config,
            logoImg,
            outputFormat,
            quality / 100,
          ),
        );
      }
      setResults(out);
      toast.success(`已处理 ${out.length} 张图片`);
      return out;
    } catch (e) {
      toast.error(`处理失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async () => {
    const out = results.length === files.length ? results : await generateAll();
    if (!out || out.length === 0) return;
    if (out.length === 1) {
      triggerDownload(out[0], out[0].name);
    } else {
      await downloadAsZip(out, "watermarked-images.zip");
    }
  };

  const handleSend = async () => {
    const out = results.length === files.length ? results : await generateAll();
    if (!out || out.length === 0) return;
    setSending(true);
    try {
      await onSendToRoom(out);
    } finally {
      setSending(false);
    }
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setActiveIdx((cur) => Math.max(0, Math.min(cur, next.length - 1)));
      return next;
    });
    setResults([]);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* 左 5 栏：参数面板 */}
      <section className="flex flex-col gap-4 lg:col-span-5">
        <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                图片加水印
              </h2>
            </div>
            {files.length > 0 && (
              <Badge variant="indigo" className="font-mono">
                {files.length} 张
              </Badge>
            )}
          </div>

          <div className="space-y-4 p-4">
            <WatermarkControls
              config={config}
              onChange={setConfig}
              logoFile={logoFile}
              onLogoFileChange={setLogoFile}
            />

            {/* 导出格式 */}
            <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  导出格式
                </span>
                <div className="flex items-center gap-1">
                  {OUTPUT_FORMATS.map((fmt) => (
                    <button
                      key={fmt.key}
                      type="button"
                      onClick={() => setOutputFormat(fmt.key)}
                      className={cn(
                        "cursor-pointer rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                        outputFormat === fmt.key
                          ? "border-indigo-600 bg-indigo-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                      )}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {outputFormat !== "image/png" && (
                <SliderField
                  label="导出质量"
                  valueLabel={`${quality}%`}
                  value={quality}
                  min={40}
                  max={100}
                  onChange={setQuality}
                />
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
            <Button
              onClick={() => void generateAll()}
              disabled={files.length === 0 || processing}
            >
              {processing ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Stamp aria-hidden="true" />
              )}
              生成{files.length > 1 ? `全部 (${files.length})` : ""}
            </Button>

            <ToolResultActions
              room={room}
              hasResults={files.length > 0}
              multiple={files.length > 1}
              processing={processing}
              sending={sending}
              onDownload={() => void handleDownload()}
              onDownloadZip={() => void handleDownload()}
              onSendToRoom={() => void handleSend()}
            />
          </div>
        </div>
      </section>

      {/* 右 7 栏：预览与批量列表 */}
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

        {files.length === 0 ? (
          <ToolDropArea
            accept="image/*"
            title="选择或拖入图片"
            hint="支持 PNG / JPG / WebP 批量添加，纯浏览器本地渲染"
            onFiles={appendImages}
          />
        ) : (
          <>
            {/* 队列头部 */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:px-4">
              <div className="no-scrollbar flex flex-1 items-center gap-1.5 overflow-x-auto">
                {files.map((f, idx) => (
                  <div
                    key={`${f.name}-${idx}`}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors",
                      idx === activeIdx
                        ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-700 dark:border-indigo-500 dark:bg-indigo-950/70 dark:text-indigo-200"
                        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className="max-w-[130px] cursor-pointer truncate"
                    >
                      {f.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`移除 ${f.name}`}
                      onClick={() => removeAt(idx)}
                      className="cursor-pointer text-slate-400 hover:text-rose-500"
                    >
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addMoreRef.current?.click()}
                >
                  <Plus aria-hidden="true" />
                  添加
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFiles([]);
                    setResults([]);
                    setActiveIdx(0);
                  }}
                  aria-label="清空列表"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>

            {/* 实时 Canvas 预览 */}
            <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                  {activeFile?.name}
                </span>
                <span className="shrink-0 font-mono">
                  {activeFile ? formatBytes(activeFile.size) : ""}
                </span>
              </div>
              <div className="flex min-h-[320px] items-center justify-center bg-slate-100/70 p-4 dark:bg-slate-950/60">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[480px] max-w-full rounded-xl shadow-sm"
                />
              </div>
            </div>

            {/* 已生成文件列表 */}
            {results.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-card p-4 shadow-xs dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    已生成文件（{results.length}）
                  </span>
                  <span className="font-mono text-slate-400">
                    {formatBytes(results.reduce((s, f) => s + f.size, 0))}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((res, idx) => (
                    <li
                      key={`${res.name}-${idx}`}
                      className="flex items-center justify-between gap-2 py-2 text-xs"
                    >
                      <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">
                        {res.name}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-slate-400">
                          {formatBytes(res.size)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => triggerDownload(res, res.name)}
                        >
                          下载
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
