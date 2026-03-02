import { defineConfig } from "vite";

export default defineConfig({
  define: {
    // Polyfill Node.js globals referenced by the Deepgram SDK browser bundle
    global: "globalThis",
  },
  optimizeDeps: {
    // Pre-bundle the buffer polyfill so it's available synchronously before
    // any SDK code evaluates and calls Buffer.isBuffer()
    include: ["buffer"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
