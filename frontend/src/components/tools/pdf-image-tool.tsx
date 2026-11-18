import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FileImage,
  FileText,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes } from "@/lib/utils";
import {
  downloadAsZip,
  isImageFile,
  isPdfFile,
  replaceFileExt,
  triggerDownload,
} from "@/lib/file-utils";
import {
  getPdfPageCount,
  imagesToPdf,
  parsePageRange,
  pdfToImages,
  type ImageToPdfOrientation,
  type ImageToPdfPageSize,
} from "@/lib/pdf";
import {
  ToolDropArea,
  ToolResultActions,
  useObjectUrl,
  type ToolCommonProps,
} from "./tool-shared";

type Mode = "pdf2img" | "img2pdf";

function ImagePreviewTile({
  file,
  index,
}: {
  file: File;
  index: number;
}) {
  const url = useObjectUrl(file);
  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200/80 bg-card shadow-xs dark:border-slate-800">
      <div className="flex aspect-[3/4] items-center justify-center bg-slate-100/70 p-2 dark:bg-slate-950/60">
        {url ? (
          <img
            src={url}
            alt={file.name}
            className="max-h-full max-w-full rounded object-contain"
          />
        ) : (
          <div className="size-8 rounded bg-muted" />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2.5 py-2 text-xs dark:border-slate-800">
        <span className="font-mono text-[11px] font-semibold text-slate-500">
          #{index + 1} · {formatBytes(file.size)}
        </span>
        <button
          type="button"
          onClick={() => triggerDownload(file, file.name)}
          className="cursor-pointer rounded-md p-1 text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/60"
          aria-label={`下载 ${file.name}`}
        >
          <Download className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function ImageQueueThumb({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return url ? (
    <img
      src={url}
      alt={file.name}
      className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
    />
  ) : (
    <div className="size-11 shrink-0 rounded-lg bg-muted" />
  );
}

export function PdfImageTool({
  room,
  initialFiles,
  onConsumeInitialFiles,
  onSendToRoom,
}: ToolCommonProps) {
  const [mode, setMode] = useState<Mode>("pdf2img");

  // --- PDF → 图片 ---
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [pageRange, setPageRange] = useState("");
  const [imgFormat, setImgFormat] = useState<"image/png" | "image/jpeg">("image/png");
  const [scale, setScale] = useState<number>(2);
  const [renderedImages, setRenderedImages] = useState<File[]>([]);
  const [p2iProgress, setP2iProgress] = useState<number | null>(null);

  // --- 图片 → PDF ---
  const [imgFiles, setImgFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<ImageToPdfPageSize>("a4");
  const [orientation, setOrientation] = useState<ImageToPdfOrientation>("auto");
  const [marginPt, setMarginPt] = useState(24);
  const [outputPdfName, setOutputPdfName] = useState("images-merged.pdf");
  const [mergedPdf, setMergedPdf] = useState<File | null>(null);
  const [i2pProgress, setI2pProgress] = useState<number | null>(null);

  const [sending, setSending] = useState(false);
  const moreImgsRef = useRef<HTMLInputElement>(null);

  const loadPdfFile = useCallback(async (file: File) => {
    setPdfFile(file);
    setRenderedImages([]);
    setPageRange("");
    try {
      const numPages = await getPdfPageCount(file);
      setPdfPages(numPages);
    } catch (e) {
      setPdfFile(null);
      setPdfPages(0);
      toast.error(`无法读取 PDF：${e instanceof Error ? e.message : e}`);
    }
  }, []);

  const appendImgFiles = useCallback((incoming: File[]) => {
    const valid = incoming.filter((f) => isImageFile(f));
    if (valid.length === 0) {
      toast.error("请选择有效的图片文件");
      return;
    }
    setImgFiles((prev) => [...prev, ...valid]);
    setMergedPdf(null);
  }, []);

  useEffect(() => {
    if (initialFiles.length === 0) return;
    const pdf = initialFiles.find((f) => isPdfFile(f));
    const imgs = initialFiles.filter((f) => isImageFile(f));
    if (pdf) {
      setMode("pdf2img");
      void loadPdfFile(pdf);
    } else if (imgs.length > 0) {
      setMode("img2pdf");
      setImgFiles((prev) => [...prev, ...imgs]);
      setMergedPdf(null);
    }
    onConsumeInitialFiles();
  }, [initialFiles, loadPdfFile, onConsumeInitialFiles]);

  const runPdfToImages = async (): Promise<File[] | null> => {
    if (!pdfFile || pdfPages <= 0) return null;
    const selected = parsePageRange(pageRange, pdfPages);
    if (selected.length === 0) {
      toast.error(`页码范围无效（共 ${pdfPages} 页）`);
      return null;
    }
    setP2iProgress(0);
    try {
      const files = await pdfToImages(
        pdfFile,
        {
          scale,
          mime: imgFormat,
          quality: 0.92,
          pageNumbers: selected,
        },
        (done, total) => setP2iProgress(Math.round((done / total) * 100)),
      );
      setRenderedImages(files);
      toast.success(`已导出 ${files.length} 页图片`);
      return files;
    } catch (e) {
      toast.error(`转换失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setP2iProgress(null);
    }
  };

  const runImagesToPdf = async (): Promise<File | null> => {
    if (imgFiles.length === 0) return null;
    setI2pProgress(0);
    try {
      const cleanName = outputPdfName.trim() || "images-merged.pdf";
      const fileName = cleanName.toLowerCase().endsWith(".pdf")
        ? cleanName
        : `${cleanName}.pdf`;
      const out = await imagesToPdf(
        imgFiles,
        {
          pageSize,
          orientation,
          marginPt,
          outputName: fileName,
        },
        (done, total) => setI2pProgress(Math.round((done / total) * 100)),
      );
      setMergedPdf(out);
      toast.success(`已合成 ${out.name}`);
      return out;
    } catch (e) {
      toast.error(`合成失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setI2pProgress(null);
    }
  };

  const moveImg = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= imgFiles.length) return;
    setImgFiles((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
    setMergedPdf(null);
  };

  const handleP2iDownload = async () => {
    const out = renderedImages.length > 0 ? renderedImages : await runPdfToImages();
    if (!out || out.length === 0) return;
    if (out.length === 1) {
      triggerDownload(out[0], out[0].name);
    } else {
      await downloadAsZip(
        out,
        replaceFileExt(pdfFile?.name ?? "pages", "zip", "-images"),
      );
    }
  };

  const handleP2iSend = async () => {
    const out = renderedImages.length > 0 ? renderedImages : await runPdfToImages();
    if (!out || out.length === 0) return;
    setSending(true);
    try {
      await onSendToRoom(out);
    } finally {
      setSending(false);
    }
  };

  const handleI2pDownload = async () => {
    const out = mergedPdf ?? (await runImagesToPdf());
    if (out) triggerDownload(out, out.name);
  };

  const handleI2pSend = async () => {
    const out = mergedPdf ?? (await runImagesToPdf());
    if (!out) return;
    setSending(true);
    try {
      await onSendToRoom([out]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 模式切换 */}
      <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setMode("pdf2img")}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
            mode === "pdf2img"
              ? "bg-indigo-600 font-semibold text-white shadow-xs"
              : "font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          <FileImage className="size-3.5" aria-hidden="true" />
          PDF 转图片
        </button>
        <button
          type="button"
          onClick={() => setMode("img2pdf")}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
            mode === "img2pdf"
              ? "bg-indigo-600 font-semibold text-white shadow-xs"
              : "font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          <FileText className="size-3.5" aria-hidden="true" />
          图片转 PDF
        </button>
      </div>

      {mode === "pdf2img" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左 5 栏 */}
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    PDF 转图片
                  </h2>
                </div>
                {pdfPages > 0 && (
                  <Badge variant="indigo" className="font-mono">
                    {pdfPages} 页
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-4">
                {pdfFile && (
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {pdfFile.name}
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        {formatBytes(pdfFile.size)} · 共 {pdfPages} 页
                      </div>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="清除 PDF"
                      onClick={() => {
                        setPdfFile(null);
                        setPdfPages(0);
                        setRenderedImages([]);
                      }}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    图片格式
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    {(
                      [
                        { key: "image/png", label: "PNG" },
                        { key: "image/jpeg", label: "JPG" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setImgFormat(opt.key);
                          setRenderedImages([]);
                        }}
                        className={cn(
                          "cursor-pointer rounded-md px-3 py-1 text-xs transition-colors",
                          imgFormat === opt.key
                            ? "bg-indigo-600 font-medium text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    清晰度倍率
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setScale(s);
                          setRenderedImages([]);
                        }}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs font-medium transition-colors",
                          scale === s
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="pdf-page-range"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    页码范围（可选）
                  </label>
                  <Input
                    id="pdf-page-range"
                    value={pageRange}
                    onChange={(e) => {
                      setPageRange(e.target.value);
                      setRenderedImages([]);
                    }}
                    placeholder="留空全部导出，或填写如 1-3, 5"
                    className="font-mono text-xs"
                  />
                </div>

                {p2iProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px] text-slate-500">
                      <span>正在逐页渲染…</span>
                      <span>{p2iProgress}%</span>
                    </div>
                    <Progress value={p2iProgress} />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
                <Button
                  onClick={() => void runPdfToImages()}
                  disabled={!pdfFile || p2iProgress !== null}
                >
                  {p2iProgress !== null ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FileImage aria-hidden="true" />
                  )}
                  开始转换
                </Button>

                <ToolResultActions
                  room={room}
                  hasResults={Boolean(pdfFile)}
                  multiple={
                    renderedImages.length > 1 ||
                    (renderedImages.length === 0 && pdfPages > 1)
                  }
                  processing={p2iProgress !== null}
                  sending={sending}
                  onDownload={() => void handleP2iDownload()}
                  onDownloadZip={() => void handleP2iDownload()}
                  onSendToRoom={() => void handleP2iSend()}
                />
              </div>
            </div>
          </section>

          {/* 右 7 栏 */}
          <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            {!pdfFile ? (
              <ToolDropArea
                accept="application/pdf,.pdf"
                multiple={false}
                title="选择或拖入 PDF 文件"
                hint="逐页高清渲染导出 PNG / JPG，支持打包 ZIP"
                onFiles={(fs) => {
                  const f = fs.find((x) => isPdfFile(x));
                  if (f) void loadPdfFile(f);
                  else toast.error("请选择 PDF 文件");
                }}
              />
            ) : renderedImages.length === 0 ? (
              <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/90 bg-card p-8 text-center shadow-xs dark:border-slate-800">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300">
                  <FileText className="size-7" aria-hidden="true" />
                </div>
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {pdfFile.name}
                </div>
                <div className="font-mono text-xs text-slate-400">
                  共 {pdfPages} 页 · 点击左侧「开始转换」生成预览
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {renderedImages.map((img, idx) => (
                  <ImagePreviewTile
                    key={`${img.name}-${idx}`}
                    file={img}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左 5 栏：图片 → PDF 设置 */}
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    图片合成 PDF
                  </h2>
                </div>
                {imgFiles.length > 0 && (
                  <Badge variant="indigo" className="font-mono">
                    {imgFiles.length} 张
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    页面尺寸
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                    {(
                      [
                        { key: "a4", label: "A4 标准" },
                        { key: "fit", label: "适应原图" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => {
                          setPageSize(opt.key);
                          setMergedPdf(null);
                        }}
                        className={cn(
                          "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                          pageSize === opt.key
                            ? "bg-indigo-600 font-medium text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {pageSize === "a4" && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      页面方向
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
                      {(
                        [
                          { key: "auto", label: "自动" },
                          { key: "portrait", label: "竖向" },
                          { key: "landscape", label: "横向" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setOrientation(opt.key);
                            setMergedPdf(null);
                          }}
                          className={cn(
                            "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                            orientation === opt.key
                              ? "bg-indigo-600 font-medium text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-300",
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    页边距
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[
                      { val: 0, label: "无" },
                      { val: 24, label: "适中" },
                      { val: 48, label: "较宽" },
                    ].map((m) => (
                      <button
                        key={m.val}
                        type="button"
                        onClick={() => {
                          setMarginPt(m.val);
                          setMergedPdf(null);
                        }}
                        className={cn(
                          "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          marginPt === m.val
                            ? "border-indigo-600 bg-indigo-600 text-white"
                            : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
                        )}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="img2pdf-name"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    输出文件名
                  </label>
                  <Input
                    id="img2pdf-name"
                    value={outputPdfName}
                    onChange={(e) => {
                      setOutputPdfName(e.target.value);
                      setMergedPdf(null);
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                {i2pProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px] text-slate-500">
                      <span>正在合成 PDF…</span>
                      <span>{i2pProgress}%</span>
                    </div>
                    <Progress value={i2pProgress} />
                  </div>
                )}

                {mergedPdf && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="truncate font-medium">{mergedPdf.name}</span>
                    <span className="shrink-0 font-mono">
                      {formatBytes(mergedPdf.size)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
                <Button
                  onClick={() => void runImagesToPdf()}
                  disabled={imgFiles.length === 0 || i2pProgress !== null}
                >
                  {i2pProgress !== null ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <FileText aria-hidden="true" />
                  )}
                  合成 PDF
                </Button>

                <ToolResultActions
                  room={room}
                  hasResults={imgFiles.length > 0}
                  multiple={false}
                  processing={i2pProgress !== null}
                  sending={sending}
                  onDownload={() => void handleI2pDownload()}
                  onSendToRoom={() => void handleI2pSend()}
                />
              </div>
            </div>
          </section>

          {/* 右 7 栏：图片排序列表 */}
          <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            <input
              ref={moreImgsRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                appendImgFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            {imgFiles.length === 0 ? (
              <ToolDropArea
                accept="image/*"
                title="选择或拖入多张图片"
                hint="支持调整前后顺序，自动适配 A4 或保留原图比例"
                onFiles={appendImgFiles}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:px-4">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    页面顺序（{imgFiles.length} 页）
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moreImgsRef.current?.click()}
                    >
                      <Plus aria-hidden="true" />
                      添加图片
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setImgFiles([]);
                        setMergedPdf(null);
                      }}
                      aria-label="清空列表"
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <ul className="flex flex-col gap-2.5">
                  {imgFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-6 shrink-0 text-center font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          {idx + 1}
                        </span>
                        <ImageQueueThumb file={file} />
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {file.name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {formatBytes(file.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={idx === 0}
                          onClick={() => moveImg(idx, -1)}
                          aria-label="上移"
                        >
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={idx === imgFiles.length - 1}
                          onClick={() => moveImg(idx, 1)}
                          aria-label="下移"
                        >
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setImgFiles((prev) => prev.filter((_, i) => i !== idx));
                            setMergedPdf(null);
                          }}
                          aria-label="移除"
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
