import { useEffect, useState } from "react";
import { api, type WsStatus } from "@/api";
import type { Item } from "@/types";

/**
 * 房间数据源：初始加载 + WebSocket 实时事件合并。
 * 排序统一按 createdAt 降序；删除/过期事件直接移除。
 */
export function useRoomItems(room: string) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  useEffect(() => {
    setItems(null);
    setError(null);
    let alive = true;

    const unsub = api.subscribe(room, (ev) => {
      if (ev.type === "new") {
        // 收到广播的提交者已在列表里（提交时乐观插入），按 id 去重
        setItems((prev) => {
          const list = prev ?? [];
          if (list.some((it) => it.id === ev.item.id)) return list;
          return [ev.item, ...list];
        });
      } else if (ev.type === "delete" || ev.type === "expire") {
        setItems((prev) =>
          (prev ?? []).filter((it) => it.id !== ev.id),
        );
      }
    }, setWsStatus);

    api
      .listItems(room)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      alive = false;
      unsub();
    };
  }, [room]);

  /** 本端提交后直接置顶插入（去重交给 ws 事件分支） */
  const prepend = (item: Item) => {
    setItems((prev) => {
      const list = prev ?? [];
      if (list.some((it) => it.id === item.id)) return list;
      return [item, ...list];
    });
  };

  const remove = (id: string) => {
    setItems((prev) => (prev ?? []).filter((it) => it.id !== id));
  };

  return { items, error, wsStatus, prepend, remove };
}
