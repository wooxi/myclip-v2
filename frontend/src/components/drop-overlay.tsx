import { useEffect, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";

/**
 * 全页拖拽覆盖层：dragenter/dragleave 计数法避免子元素抖动；
 * drop 把文件交给回调。dragover 默认行为必须阻止才能触发 drop。
 */
export function DropOverlay({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [active, setActive] = useState(false);
  const counter = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counter.current++;
      setActive(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      counter.current = Math.max(0, counter.current - 1);
      if (counter.current === 0) setActive(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      counter.current = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, [onFiles]);

  if (!active) return null;
  return (
    <div
      data-drag-active="true"
      className="fixed inset-0 z-40 grid place-items-center bg-background/80 backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background/60 px-16 py-12">
        <UploadCloud className="size-12 text-primary" />
        <p className="text-sm font-medium">松手上传</p>
      </div>
    </div>
  );
}
