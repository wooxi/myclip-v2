import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Download,
  FilePlus2,
  Image as ImageIcon,
  Loader2,
  Send,
  Type,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WatermarkConfig, WatermarkPosition } from "@/lib/watermark";

export interface ToolCommonProps {
  room: string;
  initialFiles: File[];
  onConsumeInitialFiles: () => void;
  onSendToRoom: (files: File[]) => Promise<void>;
}

/** 统一滑块字段（标签 + 等宽数值 + range） */
export function SliderField({
  label,
  valueLabel,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {valueLabel}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-600 dark:bg-slate-700"
      />
    </div>
  );
}

/** 统一文件选择/拖放区 */
export function ToolDropArea({
  accept,
  multiple = true,
  title,
  hint,
  compact = false,
  onFiles,
}: {
  accept: string;
  multiple?: boolean;
  title: string;
  hint: string;
  compact?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        acceptFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-colors duration-200",
        compact ? "p-5" : "min-h-[340px] p-8",
        dragging
          ? "border-indigo-500 bg-indigo-500/5"
          : "border-slate-200 bg-white/60 dark:border-slate-800 dark:bg-slate-900/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          acceptFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group flex cursor-pointer flex-col items-center gap-3 rounded-2xl p-4 text-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-all duration-200 group-hover:scale-105 group-hover:bg-indigo-50 group-hover:text-indigo-500 dark:bg-slate-800 dark:text-slate-500 dark:group-hover:bg-indigo-950/80 dark:group-hover:text-indigo-400",
            compact ? "size-12" : "size-16",
          )}
        >
          <FilePlus2 className={compact ? "size-6" : "size-8"} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </div>
          <div className="text-xs text-slate-400 dark:text-slate-500">{hint}</div>
        </div>
      </button>
    </div>
  );
}

/** 统一输出操作栏（本地下载 / ZIP / 发送到剪贴板房间） */
export function ToolResultActions({
  room,
  hasResults,
  multiple,
  processing,
  sending,
  onDownload,
  onDownloadZip,
  onSendToRoom,
}: {
  room: string;
  hasResults: boolean;
  multiple: boolean;
  processing?: boolean;
  sending: boolean;
  onDownload: () => void;
  onDownloadZip?: () => void;
  onSendToRoom: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {multiple && onDownloadZip ? (
        <Button
          variant="outline"
          onClick={onDownloadZip}
          disabled={!hasResults || processing}
        >
          <Archive aria-hidden="true" />
          打包 ZIP
        </Button>
      ) : (
        <Button
          variant="outline"
          onClick={onDownload}
          disabled={!hasResults || processing}
        >
          <Download aria-hidden="true" />
          下载文件
        </Button>
      )}

      <Button
        onClick={onSendToRoom}
        disabled={!hasResults || processing || sending}
      >
        {sending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Send aria-hidden="true" />
        )}
        发送到 #{room}
      </Button>
    </div>
  );
}

const COLOR_PRESETS = ["#0f172a", "#ffffff", "#4f46e5", "#dc2626", "#d97706"];

const POSITION_ITEMS: { key: WatermarkPosition; label: string }[] = [
  { key: "top-left", label: "左上" },
  { key: "top-right", label: "右上" },
  { key: "center", label: "居中" },
  { key: "bottom-left", label: "左下" },
  { key: "bottom-right", label: "右下" },
];

/** 复用的水印参数面板（图片水印 & PDF 水印共用） */
export function WatermarkControls({
  config,
  onChange,
  logoFile,
  onLogoFileChange,
}: {
  config: WatermarkConfig;
  onChange: (next: WatermarkConfig) => void;
  logoFile: File | null;
  onLogoFileChange: (file: File | null) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);

  const patch = (partial: Partial<WatermarkConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* 水印类型 */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          type="button"
          onClick={() => patch({ mode: "text" })}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors",
            config.mode === "text"
              ? "bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
              : "font-medium text-slate-600 dark:text-slate-400",
          )}
        >
          <Type className="size-3.5" aria-hidden="true" />
          文字水印
        </button>
        <button
          type="button"
          onClick={() => patch({ mode: "image" })}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors",
            config.mode === "image"
              ? "bg-white font-semibold text-slate-900 shadow-xs dark:bg-slate-900 dark:text-white"
              : "font-medium text-slate-600 dark:text-slate-400",
          )}
        >
          <ImageIcon className="size-3.5" aria-hidden="true" />
          图片 Logo
        </button>
      </div>

      {config.mode === "text" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="wm-text"
              className="text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              水印文本
            </label>
            <Textarea
              id="wm-text"
              rows={2}
              value={config.text}
              onChange={(e) => patch({ text: e.target.value })}
              placeholder="输入水印内容（支持换行）"
              className="min-h-14 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              颜色
            </span>
            <div className="flex items-center gap-1.5">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`选择颜色 ${c}`}
                  onClick={() => patch({ color: c })}
                  className={cn(
                    "size-6 cursor-pointer rounded-full border transition-transform",
                    config.color.toLowerCase() === c
                      ? "scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900"
                      : "border-slate-300 dark:border-slate-600",
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
              <Input
                type="color"
                aria-label="自定义颜色"
                value={config.color}
                onChange={(e) => patch({ color: e.target.value })}
                className="size-7 cursor-pointer rounded-lg border-slate-200 p-0.5 dark:border-slate-700"
              />
            </div>
          </div>

          <SliderField
            label="字号"
            valueLabel={`${config.fontSize} px`}
            value={config.fontSize}
            min={14}
            max={96}
            onChange={(fontSize) => patch({ fontSize })}
          />
        </div>
      ) : (
        <div className="space-y-3">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              if (f) onLogoFileChange(f);
              e.target.value = "";
            }}
          />
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                {logoFile ? logoFile.name : "未选择 Logo 图片"}
              </div>
              <div className="text-[11px] text-slate-400">
                推荐使用透明底 PNG / SVG
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              选择
            </Button>
          </div>
          <SliderField
            label="Logo 占比"
            valueLabel={`${config.logoScale}%`}
            value={config.logoScale}
            min={5}
            max={60}
            onChange={(logoScale) => patch({ logoScale })}
          />
        </div>
      )}

      {/* 排版方式 */}
      <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            布局方式
          </span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {(
              [
                { key: "tile", label: "全图平铺" },
                { key: "single", label: "单点定位" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => patch({ layout: opt.key })}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 text-xs transition-colors",
                  config.layout === opt.key
                    ? "bg-indigo-600 font-medium text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {config.layout === "single" && (
          <div className="flex flex-wrap gap-1.5">
            {POSITION_ITEMS.map((pos) => (
              <Badge
                key={pos.key}
                asChild
                variant={config.position === pos.key ? "default" : "slate"}
                className="cursor-pointer px-2.5 py-1 text-xs"
              >
                <button
                  type="button"
                  onClick={() => patch({ position: pos.key })}
                >
                  {pos.label}
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 透明度 / 角度 / 间距 */}
      <div className="space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
        <SliderField
          label="透明度"
          valueLabel={`${Math.round(config.opacity * 100)}%`}
          value={Math.round(config.opacity * 100)}
          min={5}
          max={100}
          onChange={(v) => patch({ opacity: v / 100 })}
        />
        <SliderField
          label="旋转角度"
          valueLabel={`${config.rotation}°`}
          value={config.rotation}
          min={-90}
          max={90}
          onChange={(rotation) => patch({ rotation })}
        />
        {config.layout === "tile" ? (
          <SliderField
            label="平铺间距"
            valueLabel={`${config.tileGap} px`}
            value={config.tileGap}
            min={30}
            max={360}
            step={5}
            onChange={(tileGap) => patch({ tileGap })}
          />
        ) : (
          <SliderField
            label="边缘留白"
            valueLabel={`${config.margin} px`}
            value={config.margin}
            min={0}
            max={160}
            step={4}
            onChange={(margin) => patch({ margin })}
          />
        )}
      </div>
    </div>
  );
}

/** 快捷生成 blob URL 的 Hook，自动回收 */
export function useObjectUrl(file: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
