import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const proxyTarget = process.env.VITE_PROXY_TARGET || "http://localhost:80";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/create": {
        target: proxyTarget,
        changeOrigin: true
      },
      "/resolve": {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  }
});
