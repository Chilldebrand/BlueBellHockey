import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Honour a PORT assigned by the harness/tooling; default to Vite's 5173.
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    allowedHosts: [".trycloudflare.com"]
  },
  // `vite preview` serves the built dist for friends over cloudflared quick
  // tunnels; accept those tunnel hostnames (dev server stays localhost-only).
  preview: {
    allowedHosts: [".trycloudflare.com"]
  },
  // drei's hooks (useGLTF/useAnimations) read the react-three-fiber Canvas
  // context. If Vite pre-bundles drei with its own inlined copy of fiber/three,
  // that context won't match the app's <Canvas>, and every drei hook throws
  // "Hooks can only be used within the Canvas component!". Pre-bundling them
  // together + deduping keeps a single fiber/three instance.
  optimizeDeps: {
    include: ["@react-three/fiber", "@react-three/drei", "three"]
  },
  resolve: {
    dedupe: ["@react-three/fiber", "three", "react", "react-dom"],
    alias: {
      "@bbh/arcade-core": resolve(__dirname, "../arcade-core/src/index.ts")
    }
  }
});
