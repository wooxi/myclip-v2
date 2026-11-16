import { ClipboardCopy, FilePlus2 } from "lucide-react";
import type { Item } from "@/types";
import { ItemCard } from "./item-card";

/** 空状态：纯图形语言引导（图标块构图 + sr-only 状态描述） */
function EmptyState() {
  return (
    <div
      className="flex min-h-[40dvh] flex-col items-center justify-center gap-6 rounded-xl border border-dashed border-border/60 p-10 text-center md:min-h-[50dvh]"
      aria-label="暂无内容"
    >
      <div
        className="grid grid-cols-2 gap-4 text-muted-foreground/40"
        aria-hidden="true"
      >
        <div className="grid place-items-center rounded-xl bg-muted/40 p-7">
          <FilePlus2 className="size-12" />
        </div>
        <div className="grid place-items-center rounded-xl bg-muted/40 p-7">
          <ClipboardCopy className="size-12" />
        </div>
      </div>
    </div>
  );
}

export function ItemList({
  items,
  loading,
  error,
  onDeleted,
}: {
  items: Item[] | null;
  loading: boolean;
  error: string | null;
  onDeleted: (id: string) => void;
}) {
  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
        加载失败：{error}
      </div>
    );
  }
  if (items === null) {
    return (
      <div className="flex min-h-40 items-center justify-center" aria-busy="true">
        <span className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground" aria-label="加载中" role="status" />
      </div>
    );
  }
  if (items.length === 0) {
    return loading ? null : <EmptyState />;
  }
  return (
    <ul className="flex flex-col gap-3" aria-label="历史条目">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} onDeleted={onDeleted} />
        </li>
      ))}
    </ul>
  );
}
