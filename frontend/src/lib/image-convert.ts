import {
  canvasToFile,
  loadImageElement,
  mimeToExt,
  replaceFileExt,
} from "./file-utils";

export type ImageTargetFormat = "image/webp" | "image/jpeg" | "image/png";

export type ImageConvertOptions = {
  format: ImageTargetFormat;
  quality: number;
  maxDimension: number | null;
};

export type ImageConvertResult = {
  sourceFile: File;
  outputFile: File;
  origWidth: number;
  origHeight: number;
  width: number;
  height: number;
};

/**
 * 浏览器端格式转换 + 尺寸缩放 + 压缩（通过重绘自动移除 EXIF 元数据）
 */
export async function convertAndCompressImage(
  file: File,
  opts: ImageConvertOptions,
): Promise<ImageConvertResult> {
  const img = await loadImageElement(file);
  const origWidth = img.naturalWidth;
  const origHeight = img.naturalHeight;

  let width = origWidth;
  let height = origHeight;
  if (opts.maxDimension && opts.maxDimension > 0) {
    const longest = Math.max(origWidth, origHeight);
    if (longest > opts.maxDimension) {
      const ratio = opts.maxDimension / longest;
      width = Math.max(1, Math.round(origWidth * ratio));
      height = Math.max(1, Math.round(origHeight * ratio));
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");

  if (opts.format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, width, height);

  const outName = replaceFileExt(file.name, mimeToExt(opts.format));
  const outputFile = await canvasToFile(
    canvas,
    outName,
    opts.format,
    opts.format === "image/png" ? undefined : opts.quality,
  );

  return {
    sourceFile: file,
    outputFile,
    origWidth,
    origHeight,
    width,
    height,
  };
}
