import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@bbh/arcade-core": resolve(__dirname, "../arcade-core/src/index.ts")
    }
  }
});
