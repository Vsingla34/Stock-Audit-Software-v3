import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Fix: lovable-tagger removed. It imports tailwindcss/resolveConfig.js,
// which only exists in Tailwind v3 — this project is on Tailwind v4 (or
// a version where that file moved/was removed), so the dev server crashed
// on startup with ERR_MODULE_NOT_FOUND. lovable-tagger was only useful
// inside Lovable.dev's own editor anyway; it's dead weight now that
// development happens in VS Code / Cursor.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Fix 3.2: Split heavy vendor libraries into separate chunks.
    // Each chunk only downloads when the route that uses it is visited.
    rollupOptions: {
      output: {
        manualChunks: {
          // PDF generation — only loads when user opens Reports
          pdf: ["jspdf", "jspdf-autotable", "html2canvas"],
          // Excel export — only loads when user exports XLSX
          excel: ["xlsx"],
          // Charts — only loads when user opens Analytics
          charts: ["recharts"],
          // Core React vendor chunk
          vendor: ["react", "react-dom", "react-router-dom"],
          // Supabase client
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
    // Warn when any individual chunk exceeds 500 KB
    chunkSizeWarningLimit: 500,
  },
}));