import { useCallback, useEffect, useState } from "react";
import { isValidRoom } from "@/lib/utils";

export type ToolId = "watermark" | "pdf-image" | "image-convert" | "pdf-edit";

export const TOOL_IDS: readonly ToolId[] = [
  "watermark",
  "pdf-image",
  "image-convert",
  "pdf-edit",
];

const TOOL_TITLES: Record<ToolId, string> = {
  watermark: "图片加水印",
  "pdf-image": "PDF ↔ 图片",
  "image-convert": "图片转换压缩",
  "pdf-edit": "PDF 水印与合并拆分",
};

const LAST_ROOM_KEY = "myclip-last-room";

function readLastRoom(): string {
  try {
    const saved = sessionStorage.getItem(LAST_ROOM_KEY);
    if (saved && isValidRoom(saved)) return saved;
  } catch {
    /* ignore */
  }
  return "public";
}

function saveLastRoom(room: string): void {
  try {
    sessionStorage.setItem(LAST_ROOM_KEY, room);
  } catch {
    /* ignore */
  }
}

export function isToolId(val: string): val is ToolId {
  return (TOOL_IDS as readonly string[]).includes(val);
}

/** 解析 /r/:room 路径，非法或缺省回退 public */
export function parseRoomFromPath(pathname: string): string {
  const m = pathname.match(/^\/r\/([^/]+)\/?$/);
  if (m && isValidRoom(decodeURIComponent(m[1]))) {
    return decodeURIComponent(m[1]);
  }
  return "public";
}

export type AppRoute =
  | { section: "clip"; room: string }
  | { section: "tools"; tool: ToolId | null; room: string };

export function parseAppRoute(pathname: string, fallbackRoom?: string): AppRoute {
  if (pathname === "/tools" || pathname === "/tools/") {
    return { section: "tools", tool: null, room: fallbackRoom ?? readLastRoom() };
  }
  const tm = pathname.match(/^\/tools\/([^/]+)\/?$/);
  if (tm) {
    const candidate = decodeURIComponent(tm[1]);
    if (isToolId(candidate)) {
      return { section: "tools", tool: candidate, room: fallbackRoom ?? readLastRoom() };
    }
    return { section: "tools", tool: null, room: fallbackRoom ?? readLastRoom() };
  }
  const room = parseRoomFromPath(pathname);
  saveLastRoom(room);
  return { section: "clip", room };
}

function updateDocumentTitle(route: AppRoute): void {
  if (route.section === "clip") {
    document.title = `MyClip · ${route.room}`;
  } else if (route.tool) {
    document.title = `MyClip · ${TOOL_TITLES[route.tool]}`;
  } else {
    document.title = "MyClip · 工具箱";
  }
}

/** SPA 路由：支持 / /r/:room（剪贴板）与 /tools/*（工具箱），同时保留最近房间上下文 */
export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(location.pathname));

  useEffect(() => {
    updateDocumentTitle(route);
  }, [route]);

  useEffect(() => {
    const onPop = () => {
      setRoute((prev) => parseAppRoute(location.pathname, prev.room));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigateRoom = useCallback((nextRoom: string) => {
    saveLastRoom(nextRoom);
    const path = `/r/${encodeURIComponent(nextRoom)}`;
    if (path !== location.pathname) {
      history.pushState(null, "", path);
    }
    setRoute({ section: "clip", room: nextRoom });
  }, []);

  const setActiveRoom = useCallback((nextRoom: string) => {
    saveLastRoom(nextRoom);
    setRoute((prev) => {
      if (prev.section === "clip") {
        const path = `/r/${encodeURIComponent(nextRoom)}`;
        if (path !== location.pathname) history.pushState(null, "", path);
        return { section: "clip", room: nextRoom };
      }
      return { ...prev, room: nextRoom };
    });
  }, []);

  const navigateTools = useCallback((tool: ToolId | null = null) => {
    const path = tool ? `/tools/${tool}` : "/tools";
    if (path !== location.pathname) {
      history.pushState(null, "", path);
    }
    setRoute((prev) => ({ section: "tools", tool, room: prev.room }));
  }, []);

  return { route, navigateRoom, setActiveRoom, navigateTools };
}
