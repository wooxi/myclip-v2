import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  Layers,
  Loader2,
  Plus,
  Scissors,
  Stamp,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn, formatBytes } from "@/lib/utils";
import { isPdfFile, loadImageElement, triggerDownload } from "@/lib/file-utils";
import {
  getPdfPageCount,
  mergePdfs,
  parsePageRange,
  renderPdfPageToCanvas,
  splitPdf,
  watermarkPdf,
  withPdfDocument,
} from "@/lib/pdf";
import {
  DEFAULT_WATERMARK_CONFIG,
  renderWatermarkOverlay,
  type WatermarkConfig,
} from "@/lib/watermark";
import {
  ToolDropArea,
  ToolResultActions,
  WatermarkControls,
  type ToolCommonProps,
} from "./tool-shared";

type PdfEditTab = "watermark" | "merge" | "split";

type PdfEntry = {
  file: File;
  pages: number;
};

export function PdfEditTool({
  room,
  initialFiles,
  onConsumeInitialFiles,
  onSendToRoom,
}: ToolCommonProps) {
  const [tab, setTab] = useState<PdfEditTab>("watermark");
  const [sending, setSending] = useState(false);

  // --- Tab 1: PDF 加水印 ---
  const [wmPdf, setWmPdf] = useState<PdfEntry | null>(null);
  const [wmConfig, setWmConfig] = useState<WatermarkConfig>(DEFAULT_WATERMARK_CONFIG);
  const [wmLogoFile, setWmLogoFile] = useState<File | null>(null);
  const [wmLogoImg, setWmLogoImg] = useState<HTMLImageElement | null>(null);
  const [wmPageRange, setWmPageRange] = useState("");
  const [wmResult, setWmResult] = useState<File | null>(null);
  const [wmProgress, setWmProgress] = useState<number | null>(null);
  const [basePageCanvas, setBasePageCanvas] = useState<HTMLCanvasElement | null>(null);
  const wmPreviewRef = useRef<HTMLCanvasElement>(null);

  // --- Tab 2: PDF 合并 ---
  const [mergeList, setMergeList] = useState<PdfEntry[]>([]);
  const [mergeName, setMergeName] = useState("merged.pdf");
  const [mergeResult, setMergeResult] = useState<File | null>(null);
  const [merging, setMerging] = useState(false);
  const moreMergeRef = useRef<HTMLInputElement>(null);

  // --- Tab 3: PDF 拆分提取 ---
  const [splitEntry, setSplitEntry] = useState<PdfEntry | null>(null);
  const [splitThumbs, setSplitThumbs] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [splitRangeInput, setSplitRangeInput] = useState("");
  const [splitResult, setSplitResult] = useState<File | null>(null);
  const [splitting, setSplitting] = useState(false);

  const loadSinglePdf = useCallback(async (file: File): Promise<PdfEntry | null> => {
    try {
      const pages = await getPdfPageCount(file);
      return { file, pages };
    } catch (e) {
      toast.error(`无法读取 ${file.name}：${e instanceof Error ? e.message : e}`);
      return null;
    }
  }, []);

  const loadWmPdf = useCallback(
    async (file: File) => {
      try {
        const result = await withPdfDocument(file, async (doc) => {
          const pageCanvas = await renderPdfPageToCanvas(doc, 1, 1.4);
          return { pages: doc.numPages, pageCanvas };
        });
        setWmPdf({ file, pages: result.pages });
        setWmResult(null);
        setWmPageRange("");
        setBasePageCanvas(result.pageCanvas);
      } catch (e) {
        toast.error(`无法读取 ${file.name}：${e instanceof Error ? e.message : e}`);
      }
    },
    [],
  );

  const loadSplitPdf = useCallback(
    async (file: File) => {
      try {
        const result = await withPdfDocument(file, async (doc) => {
          const thumbLimit = Math.min(doc.numPages, 36);
          const urls: string[] = [];
          for (let p = 1; p <= thumbLimit; p++) {
            const canvas = await renderPdfPageToCanvas(doc, p, 0.4);
            urls.push(canvas.toDataURL("image/jpeg", 0.75));
          }
          return { pages: doc.numPages, urls };
        });
        setSplitEntry({ file, pages: result.pages });
        setSplitResult(null);
        setSelectedPages([]);
        setSplitRangeInput("");
        setSplitThumbs(result.urls);
      } catch (e) {
        toast.error(`无法读取 ${file.name}：${e instanceof Error ? e.message : e}`);
      }
    },
    [],
  );

  const appendMergeFiles = useCallback(
    async (incoming: File[]) => {
      const pdfs = incoming.filter((f) => isPdfFile(f));
      if (pdfs.length === 0) {
        toast.error("请选择 PDF 文件");
        return;
      }
      const loaded: PdfEntry[] = [];
      for (const f of pdfs) {
        const e = await loadSinglePdf(f);
        if (e) loaded.push(e);
      }
      if (loaded.length > 0) {
        setMergeList((prev) => [...prev, ...loaded]);
        setMergeResult(null);
      }
    },
    [loadSinglePdf],
  );

  useEffect(() => {
    if (initialFiles.length === 0) return;
    const pdfs = initialFiles.filter((f) => isPdfFile(f));
    if (pdfs.length > 1) {
      setTab("merge");
      void appendMergeFiles(pdfs);
    } else if (pdfs.length === 1) {
      void loadWmPdf(pdfs[0]);
      void loadSplitPdf(pdfs[0]);
    }
    onConsumeInitialFiles();
  }, [initialFiles, appendMergeFiles, loadWmPdf, loadSplitPdf, onConsumeInitialFiles]);

  // 解码水印 Logo
  useEffect(() => {
    let alive = true;
    if (!wmLogoFile) {
      setWmLogoImg(null);
      return;
    }
    loadImageElement(wmLogoFile)
      .then((img) => {
        if (alive) setWmLogoImg(img);
      })
      .catch(() => {
        if (alive) {
          setWmLogoImg(null);
          toast.error("Logo 读取失败");
        }
      });
    return () => {
      alive = false;
    };
  }, [wmLogoFile]);

  // 合成首页 PDF + 水印实时预览
  useEffect(() => {
    const out = wmPreviewRef.current;
    if (!out || !basePageCanvas) return;
    out.width = basePageCanvas.width;
    out.height = basePageCanvas.height;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, out.width, out.height);
    ctx.drawImage(basePageCanvas, 0, 0);
    renderWatermarkOverlay(ctx, out.width, out.height, wmConfig, wmLogoImg);
  }, [basePageCanvas, wmConfig, wmLogoImg]);

  useEffect(() => {
    setWmResult(null);
  }, [wmConfig, wmLogoFile, wmPageRange]);

  const runPdfWatermark = async (): Promise<File | null> => {
    if (!wmPdf) return null;
    if (wmConfig.mode === "text" && !wmConfig.text.trim()) {
      toast.error("请输入水印文本");
      return null;
    }
    if (wmConfig.mode === "image" && !wmLogoImg) {
      toast.error("请先选择 Logo 图片");
      return null;
    }
    const pages = parsePageRange(wmPageRange, wmPdf.pages);
    if (pages.length === 0) {
      toast.error(`页码范围无效（共 ${wmPdf.pages} 页）`);
      return null;
    }
    setWmProgress(0);
    try {
      const out = await watermarkPdf(
        wmPdf.file,
        wmConfig,
        wmLogoImg,
        pages,
        (done, total) => setWmProgress(Math.round((done / total) * 100)),
      );
      setWmResult(out);
      toast.success(`已为 ${pages.length} 页添加水印`);
      return out;
    } catch (e) {
      toast.error(`处理失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setWmProgress(null);
    }
  };

  const runMerge = async (): Promise<File | null> => {
    if (mergeList.length < 2) {
      toast.error("请至少添加 2 个 PDF 文件");
      return null;
    }
    setMerging(true);
    try {
      const name = mergeName.trim() || "merged.pdf";
      const finalName = name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
      const out = await mergePdfs(
        mergeList.map((m) => m.file),
        finalName,
      );
      setMergeResult(out);
      toast.success(`已合并 ${mergeList.length} 个 PDF`);
      return out;
    } catch (e) {
      toast.error(`合并失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setMerging(false);
    }
  };

  const runSplit = async (): Promise<File | null> => {
    if (!splitEntry) return null;
    const pages =
      selectedPages.length > 0
        ? selectedPages
        : parsePageRange(splitRangeInput, splitEntry.pages);
    if (pages.length === 0) {
      toast.error("请先选择需要提取的页码");
      return null;
    }
    setSplitting(true);
    try {
      const out = await splitPdf(splitEntry.file, pages);
      setSplitResult(out);
      toast.success(`已提取 ${pages.length} 页`);
      return out;
    } catch (e) {
      toast.error(`提取失败：${e instanceof Error ? e.message : e}`);
      return null;
    } finally {
      setSplitting(false);
    }
  };

  const sendSingleResult = async (getFile: () => Promise<File | null>) => {
    const out = await getFile();
    if (!out) return;
    setSending(true);
    try {
      await onSendToRoom([out]);
    } finally {
      setSending(false);
    }
  };

  const moveMerge = (idx: number, delta: -1 | 1) => {
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= mergeList.length) return;
    setMergeList((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
    setMergeResult(null);
  };

  const toggleSplitPage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const exists = prev.includes(pageNum);
      const next = exists
        ? prev.filter((p) => p !== pageNum)
        : [...prev, pageNum].sort((a, b) => a - b);
      setSplitRangeInput(next.join(", "));
      return next;
    });
    setSplitResult(null);
  };

  return (
    <div className="space-y-4">
      {/* 子工具切换 */}
      <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {(
          [
            { key: "watermark", label: "PDF 加水印", icon: Stamp },
            { key: "merge", label: "PDF 合并", icon: Layers },
            { key: "split", label: "PDF 拆分提取", icon: Scissors },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                tab === item.key
                  ? "bg-indigo-600 font-semibold text-white shadow-xs"
                  : "font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: PDF 加水印 */}
      {tab === "watermark" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    PDF 加水印
                  </h2>
                </div>
                {wmPdf && (
                  <Badge variant="indigo" className="font-mono">
                    {wmPdf.pages} 页
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-4">
                <WatermarkControls
                  config={wmConfig}
                  onChange={setWmConfig}
                  logoFile={wmLogoFile}
                  onLogoFileChange={setWmLogoFile}
                />

                <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <label
                    htmlFor="wm-pdf-range"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    应用页码（可选）
                  </label>
                  <Input
                    id="wm-pdf-range"
                    value={wmPageRange}
                    onChange={(e) => setWmPageRange(e.target.value)}
                    placeholder="留空应用全部页，或输入 1-3, 5"
                    className="font-mono text-xs"
                  />
                </div>

                {wmProgress !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-mono text-[11px] text-slate-500">
                      <span>正在写入水印…</span>
                      <span>{wmProgress}%</span>
                    </div>
                    <Progress value={wmProgress} />
                  </div>
                )}

                {wmResult && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="truncate font-medium">{wmResult.name}</span>
                    <span className="shrink-0 font-mono">
                      {formatBytes(wmResult.size)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
                <Button
                  onClick={() => void runPdfWatermark()}
                  disabled={!wmPdf || wmProgress !== null}
                >
                  {wmProgress !== null ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Stamp aria-hidden="true" />
                  )}
                  生成水印 PDF
                </Button>

                <ToolResultActions
                  room={room}
                  hasResults={Boolean(wmPdf)}
                  multiple={false}
                  processing={wmProgress !== null}
                  sending={sending}
                  onDownload={async () => {
                    const out = wmResult ?? (await runPdfWatermark());
                    if (out) triggerDownload(out, out.name);
                  }}
                  onSendToRoom={() =>
                    void sendSingleResult(async () => wmResult ?? runPdfWatermark())
                  }
                />
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            {!wmPdf ? (
              <ToolDropArea
                accept="application/pdf,.pdf"
                multiple={false}
                title="选择或拖入 PDF 文件"
                hint="支持中英文文字与图片 Logo 水印，首页实时效果预览"
                onFiles={(fs) => {
                  const f = fs.find((x) => isPdfFile(x));
                  if (f) void loadWmPdf(f);
                  else toast.error("请选择 PDF 文件");
                }}
              />
            ) : (
              <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs dark:border-slate-800">
                  <span className="truncate font-medium text-slate-700 dark:text-slate-200">
                    {wmPdf.file.name} · 第 1 页预览
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">
                      {formatBytes(wmPdf.file.size)}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="清除 PDF"
                      onClick={() => {
                        setWmPdf(null);
                        setWmResult(null);
                        setBasePageCanvas(null);
                      }}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="flex min-h-[360px] items-center justify-center bg-slate-100/70 p-4 dark:bg-slate-950/60">
                  <canvas
                    ref={wmPreviewRef}
                    className="max-h-[520px] max-w-full rounded-xl shadow-sm"
                  />
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tab 2: PDF 合并 */}
      {tab === "merge" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    PDF 合并
                  </h2>
                </div>
                {mergeList.length > 0 && (
                  <Badge variant="indigo" className="font-mono">
                    {mergeList.reduce((s, m) => s + m.pages, 0)} 页
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="merge-pdf-name"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    合并后文件名
                  </label>
                  <Input
                    id="merge-pdf-name"
                    value={mergeName}
                    onChange={(e) => {
                      setMergeName(e.target.value);
                      setMergeResult(null);
                    }}
                    className="font-mono text-xs"
                  />
                </div>

                {mergeResult && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="truncate font-medium">{mergeResult.name}</span>
                    <span className="shrink-0 font-mono">
                      {formatBytes(mergeResult.size)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
                <Button
                  onClick={() => void runMerge()}
                  disabled={mergeList.length < 2 || merging}
                >
                  {merging ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Layers aria-hidden="true" />
                  )}
                  合并 PDF
                </Button>

                <ToolResultActions
                  room={room}
                  hasResults={mergeList.length >= 2}
                  multiple={false}
                  processing={merging}
                  sending={sending}
                  onDownload={async () => {
                    const out = mergeResult ?? (await runMerge());
                    if (out) triggerDownload(out, out.name);
                  }}
                  onSendToRoom={() =>
                    void sendSingleResult(async () => mergeResult ?? runMerge())
                  }
                />
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            <input
              ref={moreMergeRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={(e) => {
                void appendMergeFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />

            {mergeList.length === 0 ? (
              <ToolDropArea
                accept="application/pdf,.pdf"
                title="选择或拖入多个 PDF 文件"
                hint="支持调整合并顺序，浏览器本地无损合并"
                onFiles={(fs) => void appendMergeFiles(fs)}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:px-4">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    待合并列表（{mergeList.length} 个文件）
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => moreMergeRef.current?.click()}
                    >
                      <Plus aria-hidden="true" />
                      添加 PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMergeList([]);
                        setMergeResult(null);
                      }}
                      aria-label="清空列表"
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <ul className="flex flex-col gap-2.5">
                  {mergeList.map((entry, idx) => (
                    <li
                      key={`${entry.file.name}-${idx}`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-mono text-xs font-bold text-indigo-600 dark:bg-indigo-950/70 dark:text-indigo-300">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {entry.file.name}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {entry.pages} 页 · {formatBytes(entry.file.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={idx === 0}
                          onClick={() => moveMerge(idx, -1)}
                          aria-label="上移"
                        >
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          disabled={idx === mergeList.length - 1}
                          onClick={() => moveMerge(idx, 1)}
                          aria-label="下移"
                        >
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setMergeList((prev) => prev.filter((_, i) => i !== idx));
                            setMergeResult(null);
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

      {/* Tab 3: PDF 拆分提取 */}
      {tab === "split" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="flex flex-col gap-4 lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-xs dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800/80 dark:bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-indigo-500" aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    PDF 拆分提取
                  </h2>
                </div>
                {splitEntry && (
                  <Badge variant="indigo" className="font-mono">
                    {selectedPages.length} / {splitEntry.pages} 页
                  </Badge>
                )}
              </div>

              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="split-range"
                    className="text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    提取页码（可直接输入或右侧点选）
                  </label>
                  <Input
                    id="split-range"
                    value={splitRangeInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSplitRangeInput(val);
                      setSplitResult(null);
                      if (splitEntry && val.trim()) {
                        setSelectedPages(parsePageRange(val, splitEntry.pages));
                      } else if (!val.trim()) {
                        setSelectedPages([]);
                      }
                    }}
                    placeholder="例如 1-3, 5, 8"
                    className="font-mono text-xs"
                  />
                </div>

                {splitEntry && (
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const all = Array.from(
                          { length: splitEntry.pages },
                          (_, i) => i + 1,
                        );
                        setSelectedPages(all);
                        setSplitRangeInput(`1-${splitEntry.pages}`);
                        setSplitResult(null);
                      }}
                    >
                      全选
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const odd = Array.from(
                          { length: splitEntry.pages },
                          (_, i) => i + 1,
                        ).filter((p) => p % 2 === 1);
                        setSelectedPages(odd);
                        setSplitRangeInput(odd.join(", "));
                        setSplitResult(null);
                      }}
                    >
                      奇数页
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const even = Array.from(
                          { length: splitEntry.pages },
                          (_, i) => i + 1,
                        ).filter((p) => p % 2 === 0);
                        setSelectedPages(even);
                        setSplitRangeInput(even.join(", "));
                        setSplitResult(null);
                      }}
                    >
                      偶数页
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedPages([]);
                        setSplitRangeInput("");
                        setSplitResult(null);
                      }}
                    >
                      清空选择
                    </Button>
                  </div>
                )}

                {splitResult && (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <span className="truncate font-medium">{splitResult.name}</span>
                    <span className="shrink-0 font-mono">
                      {formatBytes(splitResult.size)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-4">
                <Button
                  onClick={() => void runSplit()}
                  disabled={!splitEntry || splitting}
                >
                  {splitting ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Scissors aria-hidden="true" />
                  )}
                  提取导出
                </Button>

                <ToolResultActions
                  room={room}
                  hasResults={Boolean(splitEntry)}
                  multiple={false}
                  processing={splitting}
                  sending={sending}
                  onDownload={async () => {
                    const out = splitResult ?? (await runSplit());
                    if (out) triggerDownload(out, out.name);
                  }}
                  onSendToRoom={() =>
                    void sendSingleResult(async () => splitResult ?? runSplit())
                  }
                />
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4 lg:col-span-7">
            {!splitEntry ? (
              <ToolDropArea
                accept="application/pdf,.pdf"
                multiple={false}
                title="选择或拖入需要拆分的 PDF"
                hint="点击页面缩略图或输入页码范围提取生成新 PDF"
                onFiles={(fs) => {
                  const f = fs.find((x) => isPdfFile(x));
                  if (f) void loadSplitPdf(f);
                  else toast.error("请选择 PDF 文件");
                }}
              />
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2 text-xs">
                    <FileText className="size-4 shrink-0 text-indigo-500" aria-hidden="true" />
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                      {splitEntry.file.name}
                    </span>
                    <span className="shrink-0 font-mono text-slate-400">
                      {splitEntry.pages} 页
                    </span>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="清除 PDF"
                    onClick={() => {
                      setSplitEntry(null);
                      setSplitThumbs([]);
                      setSelectedPages([]);
                      setSplitRangeInput("");
                      setSplitResult(null);
                    }}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </div>

                {splitThumbs.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {splitThumbs.map((src, idx) => {
                      const pageNum = idx + 1;
                      const picked = selectedPages.includes(pageNum);
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => toggleSplitPage(pageNum)}
                          className={cn(
                            "group relative cursor-pointer overflow-hidden rounded-xl border bg-card p-1.5 text-left transition-all",
                            picked
                              ? "border-indigo-600 ring-2 ring-indigo-500/30"
                              : "border-slate-200/90 hover:border-slate-300 dark:border-slate-800",
                          )}
                        >
                          <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg bg-slate-100/70 dark:bg-slate-950/50">
                            <img
                              src={src}
                              alt={`第 ${pageNum} 页`}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] font-mono">
                            <span className="text-slate-500">P{pageNum}</span>
                            {picked && (
                              <span className="inline-flex size-4 items-center justify-center rounded-full bg-indigo-600 text-white">
                                <Check className="size-2.5" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-200/90 bg-card p-6 text-xs text-slate-400 dark:border-slate-800">
                    正在渲染页面缩略图…
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
