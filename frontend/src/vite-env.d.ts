/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" 启用 localStorage mock 模式（无后端独立开发） */
  readonly VITE_USE_MOCK?: string;
  /** dev 代理后端端口，默认 8787 */
  readonly VITE_BACKEND_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
