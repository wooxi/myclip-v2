import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { legacyCopyText } from "@/lib/clipboard";

/** 房间分享：链接 + 二维码 + 复制 */
export function ShareDialog({
  room,
  open,
  onOpenChange,
}: {
  room: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${location.origin}/r/${encodeURIComponent(room)}`;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(url, {
      margin: 1,
      width: 256,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((u) => {
        if (alive) setDataUrl(u);
      })
      .catch(() => {
        if (alive) setDataUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [open, url]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("链接已复制");
    } catch {
      if (legacyCopyText(url)) {
        setCopied(true);
        toast.success("链接已复制");
      } else toast.error("复制失败");
    }
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>分享房间</DialogTitle>
          <DialogDescription className="sr-only">
            房间 {room} 的二维码与链接
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={`房间 ${room} 链接二维码`}
              className="size-52 rounded-2xl border border-slate-200 bg-white p-3 shadow-inner dark:border-slate-800"
            />
          ) : (
            <div className="grid size-52 place-items-center rounded-2xl border border-slate-200 bg-muted text-xs text-muted-foreground dark:border-slate-800">
              二维码生成中…
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            <Input
              ref={inputRef}
              value={url}
              readOnly
              aria-label="房间链接"
              onFocus={(e) => e.target.select()}
            />
            <Button variant="secondary" size="icon" onClick={() => void copyLink()} aria-label="复制链接">
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
          <Button variant="outline" className="w-full" onClick={() => void copyLink()}>
            <Link2 aria-hidden="true" />
            复制链接
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
