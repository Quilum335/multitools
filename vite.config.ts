import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      },
      "/s/": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      },
      "/ffmpeg-core": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true
      }
    },
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  },
  preview: {
    port: 4173,
    strictPort: false
  }
});
