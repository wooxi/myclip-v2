import { useState } from "react";
import { Search, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Item } from "@/types";
import { classifyItem, inFilterGroup, type FilterGroup } from "@/lib/classify";
import { cn } from "@/lib/utils";
import { ItemCard } from "./item-card";
import { EmptyDropzone } from "./empty-dropzone";

const FILTERS: { key: FilterGroup; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "text", label: "文本 / 代码" },
  { key: "file", label: "文件与图片" },
  { key: "link", label: "链接" },
];

/** 筛选头卡：tabs + 搜索 + 清空房间 */
function FilterHeader({
  countAll,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  onClearAll,
}: {
  countAll: number;
  filter: FilterGroup;
  onFilterChange: (f: FilterGroup) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onClearAll: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200/90 bg-card p-3 shadow-xs dark:border-slate-800 sm:flex-row sm:items-center sm:px-4 sm:py-3">
      <div role="tablist" aria-label="内容筛选" className="no-scrollbar flex items-center gap-1 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => onFilterChange(f.key)}
            className={cn(
              "shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              filter === f.key
                ? "bg-slate-900 font-semibold text-white dark:bg-indigo-600"
                : "font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            {f.label}
            {f.key === "all" && <span className="ms-1 opacity-80">{countAll}</span>}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:w-48">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜索内容或文件名..."
            aria-label="搜索条目"
            className="h-9 w-full rounded-lg border border-transparent bg-slate-100 pl-8 pr-3 text-xs text-slate-700 transition-colors duration-150 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
          />
        </div>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="清空当前房间所有记录"
          aria-label="清空当前房间"
          className="cursor-pointer rounded-lg p-2 text-slate-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:hover:bg-rose-950/50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清空当前房间？</DialogTitle>
            <DialogDescription>
              房间内全部 {countAll} 条记录将对所有人消失，操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" autoFocus>
                取消
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => { setConfirmOpen(false); onClearAll(); }}>
              <Trash2 aria-hidden="true" />
              全部删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ItemList({
  items,
  loading,
  error,
  onDeleted,
  onClearAll,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  onFiles,
  onPasteSend,
}: {
  items: Item[] | null;
  loading: boolean;
  error: string | null;
  onDeleted: (id: string) => void;
  onClearAll: (ids: string[]) => void;
  filter: FilterGroup;
  onFilterChange: (f: FilterGroup) => void;
  query: string;
  onQueryChange: (q: string) => void;
  onFiles: (files: File[]) => void;
  onPasteSend: () => void;
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
        <span
          className="size-6 animate-spin rounded-full border-2 border-border border-t-foreground"
          aria-label="加载中"
          role="status"
        />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = items.filter((it) => {
    const kind = classifyItem(it);
    const matchTab = inFilterGroup(kind, filter);
    const matchQuery =
      !q ||
      (it.content ?? "").toLowerCase().includes(q) ||
      (it.fileName ?? "").toLowerCase().includes(q);
    return matchTab && matchQuery;
  });

  return (
    <div className="flex flex-col gap-4">
      <FilterHeader
        countAll={items.length}
        filter={filter}
        onFilterChange={onFilterChange}
        query={query}
        onQueryChange={onQueryChange}
        onClearAll={() => onClearAll(items.map((it) => it.id))}
      />

      {filtered.length === 0 ? (
        <EmptyDropzone
          onFiles={onFiles}
          onPasteSend={onPasteSend}
          empty={items.length === 0}
          loading={loading}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3" aria-label="历史条目">
            {filtered.map((item) => (
              <li key={item.id}>
                <ItemCard item={item} onDeleted={onDeleted} />
              </li>
            ))}
          </ul>
          {/* 有内容时的矮条拖放区：仍可拖入文件 */}
          <EmptyDropzone onFiles={onFiles} onPasteSend={onPasteSend} empty={false} loading={false} />
        </>
      )}
    </div>
  );
}
