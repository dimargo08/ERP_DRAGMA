export interface DragmaRuntimeConfig {
  apiUrl?: string;
  demo?: boolean;
}

declare global {
  interface Window {
    __DRAGMA_CONFIG__?: DragmaRuntimeConfig;
  }
}

export const RUNTIME_CONFIG: DragmaRuntimeConfig = window.__DRAGMA_CONFIG__ ?? {};
export const DEMO_MODE = RUNTIME_CONFIG.demo === true;
