import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { PDFDocument } from "pdf-lib";
import {
  canvasToBytes,
  canvasToFile,
  loadImageElement,
  mimeToExt,
  replaceFileExt,
} from "./file-utils";
import { renderWatermarkOverlay, type WatermarkConfig } from "./watermark";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function withPdfDocument<T>(
  file: File,
  fn: (doc: pdfjsLib.PDFDocumentProxy) => Promise<T>,
): Promise<T> {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjsLib.getDocument({ data });
  try {
    const doc = await task.promise;
    return await fn(doc);
  } finally {
    await task.destroy();
  }
}

export async function getPdfPageCount(file: File): Promise<number> {
  return withPdfDocument(file, async (doc) => doc.numPages);
}

export async function renderPdfPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return canvas;
}

/**
 * 解析页码范围字符串，例如 "1-3, 5, 8-10"
 */
export function parsePageRange(input: string, maxPages: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return Array.from({ length: maxPages }, (_, idx) => idx + 1);
  }
  const selected = new Set<number>();
  for (const part of trimmed.split(/[,，\s]+/)) {
    if (!part) continue;
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = Math.max(1, Math.min(maxPages, Number(rangeMatch[1])));
      const end = Math.max(1, Math.min(maxPages, Number(rangeMatch[2])));
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);
      for (let p = lo; p <= hi; p++) selected.add(p);
      continue;
    }
    const single = Number(part);
    if (Number.isInteger(single) && single >= 1 && single <= maxPages) {
      selected.add(single);
    }
  }
  return Array.from(selected).sort((a, b) => a - b);
}

export async function pdfToImages(
  file: File,
  opts: {
    scale: number;
    mime: "image/png" | "image/jpeg";
    quality: number;
    pageNumbers?: number[];
  },
  onProgress?: (done: number, total: number) => void,
): Promise<File[]> {
  return withPdfDocument(file, async (doc) => {
    const pages =
      opts.pageNumbers && opts.pageNumbers.length > 0
        ? opts.pageNumbers
        : Array.from({ length: doc.numPages }, (_, i) => i + 1);

    const ext = mimeToExt(opts.mime);
    const padWidth = String(doc.numPages).length;
    const outputs: File[] = [];

    for (let i = 0; i < pages.length; i++) {
      const pageNum = pages[i];
      const canvas = await renderPdfPageToCanvas(doc, pageNum, opts.scale);
      const outName = replaceFileExt(
        file.name,
        ext,
        `-p${String(pageNum).padStart(padWidth, "0")}`,
      );
      const outFile = await canvasToFile(
        canvas,
        outName,
        opts.mime,
        opts.mime === "image/png" ? undefined : opts.quality,
      );
      outputs.push(outFile);
      onProgress?.(i + 1, pages.length);
    }
    return outputs;
  });
}

export type ImageToPdfPageSize = "fit" | "a4";
export type ImageToPdfOrientation = "auto" | "portrait" | "landscape";

export async function imagesToPdf(
  files: File[],
  opts: {
    pageSize: ImageToPdfPageSize;
    orientation: ImageToPdfOrientation;
    marginPt: number;
    outputName: string;
  },
  onProgress?: (done: number, total: number) => void,
): Promise<File> {
  const pdfDoc = await PDFDocument.create();
  const A4_SHORT = 595.28;
  const A4_LONG = 841.89;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const embedded = await embedImageFile(pdfDoc, file);
    const imgW = embedded.width;
    const imgH = embedded.height;

    if (opts.pageSize === "fit") {
      const pad = opts.marginPt;
      const page = pdfDoc.addPage([imgW + pad * 2, imgH + pad * 2]);
      page.drawImage(embedded, {
        x: pad,
        y: pad,
        width: imgW,
        height: imgH,
      });
    } else {
      const isLandscape =
        opts.orientation === "landscape" ||
        (opts.orientation === "auto" && imgW > imgH);
      const pageW = isLandscape ? A4_LONG : A4_SHORT;
      const pageH = isLandscape ? A4_SHORT : A4_LONG;
      const availW = Math.max(10, pageW - opts.marginPt * 2);
      const availH = Math.max(10, pageH - opts.marginPt * 2);
      const scale = Math.min(availW / imgW, availH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(embedded, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    onProgress?.(i + 1, files.length);
  }

  const bytes = await pdfDoc.save();
  return new File([new Uint8Array(bytes)], opts.outputName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

async function embedImageFile(pdfDoc: PDFDocument, file: File) {
  if (file.type === "image/jpeg") {
    try {
      return await pdfDoc.embedJpg(await file.arrayBuffer());
    } catch {
      /* 文件扩展名与实际编码不一致时降级 Canvas 转 PNG */
    }
  }
  if (file.type === "image/png") {
    try {
      return await pdfDoc.embedPng(await file.arrayBuffer());
    } catch {
      /* 降级 Canvas 转 PNG */
    }
  }
  // WebP / BMP / GIF / SVG 等浏览器可解码格式先通过 Canvas 转成 PNG 嵌入
  const img = await loadImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布上下文");
  ctx.drawImage(img, 0, 0);
  const pngBytes = await canvasToBytes(canvas, "image/png");
  return pdfDoc.embedPng(pngBytes);
}

/**
 * 为 PDF 添加全语言透明水印（通过透明 Canvas PNG 叠层，天然支持中文与任意旋转/透明度）
 */
export async function watermarkPdf(
  file: File,
  config: WatermarkConfig,
  logoImg: HTMLImageElement | null,
  pageNumbers?: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<File> {
  const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
  });
  const total = pdfDoc.getPageCount();
  const targetSet = new Set(
    pageNumbers && pageNumbers.length > 0
      ? pageNumbers
      : Array.from({ length: total }, (_, i) => i + 1),
  );

  // 按页面尺寸缓存水印透明层，避免相同版式重复绘制
  const stampCache = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();

  let done = 0;
  for (let idx = 0; idx < total; idx++) {
    const pageNum = idx + 1;
    if (!targetSet.has(pageNum)) continue;

    const page = pdfDoc.getPage(idx);
    const { width, height } = page.getSize();
    const cacheKey = `${Math.round(width)}x${Math.round(height)}`;
    let embeddedStamp = stampCache.get(cacheKey);

    if (!embeddedStamp) {
      // 控制最大栅格像素，兼顾清晰度与内存占用
      const maxCanvasSide = 1600;
      const scale = Math.min(2, maxCanvasSide / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法创建画布上下文");
      renderWatermarkOverlay(ctx, canvas.width, canvas.height, config, logoImg);
      const pngBytes = await canvasToBytes(canvas, "image/png");
      embeddedStamp = await pdfDoc.embedPng(pngBytes);
      stampCache.set(cacheKey, embeddedStamp);
    }

    page.drawImage(embeddedStamp, {
      x: 0,
      y: 0,
      width,
      height,
    });

    done++;
    onProgress?.(done, targetSet.size);
  }

  const outBytes = await pdfDoc.save();
  const outName = replaceFileExt(file.name, "pdf", "-watermarked");
  return new File([new Uint8Array(outBytes)], outName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

export async function mergePdfs(
  files: File[],
  outputName = "merged.pdf",
): Promise<File> {
  const merged = await PDFDocument.create();
  for (const file of files) {
    const doc = await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
    });
    const copied = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of copied) merged.addPage(page);
  }
  const bytes = await merged.save();
  return new File([new Uint8Array(bytes)], outputName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}

export async function splitPdf(
  file: File,
  pageNumbers: number[],
  outputName?: string,
): Promise<File> {
  const src = await PDFDocument.load(await file.arrayBuffer(), {
    ignoreEncryption: true,
  });
  const total = src.getPageCount();
  const indices = pageNumbers
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < total);
  if (indices.length === 0) {
    throw new Error("未选择有效页码");
  }
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, indices);
  for (const page of copied) out.addPage(page);
  const bytes = await out.save();
  const finalName =
    outputName || replaceFileExt(file.name, "pdf", `-pages-${indices.length}`);
  return new File([new Uint8Array(bytes)], finalName, {
    type: "application/pdf",
    lastModified: Date.now(),
  });
}
