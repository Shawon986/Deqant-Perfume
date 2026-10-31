import devServer from "@hono/vite-dev-server"
import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    devServer({ entry: "server/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) return "charts-vendor";
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/")) return "firebase-vendor";
          if (id.includes("node_modules/@radix-ui/")) return "radix-vendor";
        },
      },
    },
  },
});
