import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";

// PWA：新 Service Worker 就绪后自动接管并刷新一次页面，
// 避免用户停留在旧 precache 资产上（sessionStorage 防刷新循环）
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    registration?.addEventListener("controllerchange", () => {
      if (!sessionStorage.getItem("myclip-sw-reloaded")) {
        sessionStorage.setItem("myclip-sw-reloaded", "1");
        window.location.reload();
      }
    });
  },
});

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
