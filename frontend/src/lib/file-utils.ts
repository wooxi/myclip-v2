/**
 * 纯前端文件与 Canvas 通用工具
 */

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function downloadAsZip(files: File[], zipName: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const usedNames = new Map<string, number>();

  for (const file of files) {
    const count = usedNames.get(file.name) ?? 0;
    usedNames.set(file.name, count + 1);
    const entryName =
      count === 0 ? file.name : appendNameSuffix(file.name, `-${count + 1}`);
    zip.file(entryName, await file.arrayBuffer());
  }

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, zipName);
}

export function appendNameSuffix(name: string, suffix: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return `${name}${suffix}`;
  return `${name.slice(0, dot)}${suffix}${name.slice(dot)}`;
}

export function replaceFileExt(name: string, newExt: string, suffix = ""): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const cleanExt = newExt.startsWith(".") ? newExt : `.${newExt}`;
  return `${base}${suffix}${cleanExt}`;
}

export function mimeToExt(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/png":
    default:
      return "png";
  }
}

export function isImageFile(file: { type?: string; name?: string }): boolean {
  if (file.type?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i.test(file.name ?? "");
}

export function isPdfFile(file: { type?: string; name?: string }): boolean {
  if (file.type === "application/pdf") return true;
  return /\.pdf$/i.test(file.name ?? "");
}

export async function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function canvasToFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  mime: string,
  quality?: number,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Canvas 导出失败"));
          return;
        }
        resolve(new File([blob], fileName, { type: mime, lastModified: Date.now() }));
      },
      mime,
      quality,
    );
  });
}

export function canvasToBytes(
  canvas: HTMLCanvasElement,
  mime = "image/png",
  quality?: number,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("Canvas 转换失败"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      mime,
      quality,
    );
  });
}
