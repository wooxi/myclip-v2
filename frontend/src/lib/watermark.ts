import {
  canvasToFile,
  loadImageElement,
  mimeToExt,
  replaceFileExt,
} from "./file-utils";

export type WatermarkPosition =
  | "top-left"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-right";

export type WatermarkConfig = {
  mode: "text" | "image";
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  layout: "tile" | "single";
  position: WatermarkPosition;
  tileGap: number;
  margin: number;
  logoScale: number;
};

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  mode: "text",
  text: "MyClip 仅供内部使用",
  fontSize: 32,
  color: "#1e293b",
  opacity: 0.28,
  rotation: -28,
  layout: "tile",
  position: "bottom-right",
  tileGap: 140,
  margin: 36,
  logoScale: 18,
};

/**
 * 在目标画布坐标系 (width x height) 上绘制水印层。
 * 供图片加水印与 PDF 透明水印图层复用。
 */
export function renderWatermarkOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig,
  logoImg: HTMLImageElement | null = null,
): void {
  if (config.mode === "text" && !config.text.trim()) return;
  if (config.mode === "image" && !logoImg) return;

  // 按画布相对 1200px 基准自适应缩放，避免小图/大图水印尺寸失衡
  const scaleFactor = Math.max(0.35, Math.min(width, height) / 1000);
  const rad = (config.rotation * Math.PI) / 180;

  let stampW = 0;
  let stampH = 0;
  const fontSize = Math.max(10, Math.round(config.fontSize * scaleFactor));
  const lines = config.text.split(/\r?\n/);

  if (config.mode === "text") {
    ctx.save();
    ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
    const maxLineW = Math.max(
      1,
      ...lines.map((line) => ctx.measureText(line || " ").width),
    );
    ctx.restore();
    stampW = maxLineW;
    stampH = lines.length * fontSize * 1.3;
  } else if (logoImg) {
    const targetW = Math.max(24, (width * config.logoScale) / 100);
    const ratio = logoImg.naturalHeight / Math.max(1, logoImg.naturalWidth);
    stampW = targetW;
    stampH = targetW * ratio;
  }

  const drawStampAt = (cx: number, cy: number) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0.02, Math.min(1, config.opacity));
    ctx.translate(cx, cy);
    ctx.rotate(rad);

    if (config.mode === "text") {
      ctx.font = `600 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = config.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lineHeight = fontSize * 1.3;
      const startY = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, idx) => {
        ctx.fillText(line, 0, startY + idx * lineHeight);
      });
    } else if (logoImg) {
      ctx.drawImage(logoImg, -stampW / 2, -stampH / 2, stampW, stampH);
    }

    ctx.restore();
  };

  if (config.layout === "single") {
    const pad = Math.max(12, config.margin * scaleFactor);
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const boundW = stampW * cos + stampH * sin;
    const boundH = stampW * sin + stampH * cos;
    const halfW = boundW / 2;
    const halfH = boundH / 2;

    let cx = width / 2;
    let cy = height / 2;
    if (config.position === "top-left") {
      cx = pad + halfW;
      cy = pad + halfH;
    } else if (config.position === "top-right") {
      cx = width - pad - halfW;
      cy = pad + halfH;
    } else if (config.position === "bottom-left") {
      cx = pad + halfW;
      cy = height - pad - halfH;
    } else if (config.position === "bottom-right") {
      cx = width - pad - halfW;
      cy = height - pad - halfH;
    }
    drawStampAt(cx, cy);
    return;
  }

  // 全图平铺：使用对角线覆盖，保证任意旋转角度不留边角空白
  const gap = Math.max(24, config.tileGap * scaleFactor);
  const stepX = Math.max(40, stampW + gap);
  const stepY = Math.max(40, stampH + gap);
  const diag = Math.hypot(width, height);
  const start = -diag * 0.6;
  const endX = width + diag * 0.6;
  const endY = height + diag * 0.6;

  let row = 0;
  for (let y = start; y <= endY; y += stepY) {
    const offset = row % 2 === 1 ? stepX * 0.5 : 0;
    for (let x = start + offset; x <= endX; x += stepX) {
      if (x + stepX < -width * 0.3 || y + stepY < -height * 0.3) continue;
      drawStampAt(x, y);
    }
    row++;
  }
}

export type WatermarkOutputFormat = "keep" | "image/png" | "image/jpeg" | "image/webp";

export function resolveOutputMime(
  inputMime: string,
  preferred: WatermarkOutputFormat,
): "image/png" | "image/jpeg" | "image/webp" {
  if (preferred !== "keep") return preferred;
  if (inputMime === "image/jpeg" || inputMime === "image/webp") return inputMime;
  return "image/png";
}

export async function watermarkImageFile(
  file: File,
  config: WatermarkConfig,
  logoImg: HTMLImageElement | null,
  preferredFormat: WatermarkOutputFormat = "keep",
  quality = 0.92,
): Promise<File> {
  const img = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  const outputMime = resolveOutputMime(file.type, preferredFormat);
  if (outputMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  renderWatermarkOverlay(ctx, canvas.width, canvas.height, config, logoImg);

  const outName = replaceFileExt(
    file.name,
    mimeToExt(outputMime),
    "-watermarked",
  );
  return canvasToFile(
    canvas,
    outName,
    outputMime,
    outputMime === "image/png" ? undefined : quality,
  );
}
