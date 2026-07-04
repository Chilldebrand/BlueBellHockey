import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Honour a PORT assigned by the harness/tooling; default to Vite's 5173.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173
  },
  resolve: {
    alias: {
      "@bbh/arcade-core": resolve(__dirname, "../arcade-core/src/index.ts")
    }
  }
});
