import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// 后端联调目标：wrangler dev 默认 8787，可用 VITE_BACKEND_PORT 覆盖
const backendPort = process.env.VITE_BACKEND_PORT ?? "8787";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // network-only：在线场景才有意义，离线只缓存静态壳
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        id: "/",
        name: "MyClip",
        short_name: "MyClip",
        description: "文本与文件互传",
        start_url: "/",
        display: "standalone",
        // 暗色优先：theme_color 跟随暗色背景
        background_color: "#09090b",
        theme_color: "#09090b",
        icons: [
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "/icon-maskable.svg",
            sizes: "512x512",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // network-only 数据策略：只缓存静态资源壳，不缓存 API/WS
        runtimeCaching: [],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globIgnores: ["**/pdf.worker*"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
