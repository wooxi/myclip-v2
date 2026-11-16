import { useEffect, useState } from "react";
import { isValidRoom } from "@/lib/utils";

/** 解析 /r/:room 路径，非法或缺省回退 public */
export function parseRoomFromPath(pathname: string): string {
  const m = pathname.match(/^\/r\/([^/]+)\/?$/);
  if (m && isValidRoom(decodeURIComponent(m[1]))) {
    return decodeURIComponent(m[1]);
  }
  return "public";
}

/** SPA 迷你路由：只监听 popstate + 提供 push */
export function useRoomRoute() {
  const [room, setRoom] = useState(() => parseRoomFromPath(location.pathname));

  useEffect(() => {
    const onPop = () => setRoom(parseRoomFromPath(location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = (next: string) => {
    const path = `/r/${encodeURIComponent(next)}`;
    if (path !== location.pathname) {
      history.pushState(null, "", path);
    }
    setRoom(next);
    document.title = `MyClip · ${next}`;
  };

  return { room, navigate };
}
