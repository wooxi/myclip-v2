import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// PWA：注册 SW（vite-pwa generateSW 产物 /sw.js，autoUpdate 模式下自带
// skipWaiting + clientsClaim，新 SW 就绪即接管）。接管瞬间自动刷新一次页面，
// 避免用户停留在旧 precache 资产上（sessionStorage 防刷新循环）。
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.addEventListener("controllerchange", () => {
          if (!sessionStorage.getItem("myclip-sw-reloaded")) {
            sessionStorage.setItem("myclip-sw-reloaded", "1");
            window.location.reload();
          }
        });
      })
      .catch(() => {
        // SW 注册失败不影响应用使用
      });
  });
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
