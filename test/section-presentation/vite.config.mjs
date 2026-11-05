import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
export default defineConfig({
  root: path("./"),
  resolve: {
    alias: [
      { find: "@/lib/supabase/client", replacement: path("./mock-client.mjs") },
      { find: "next/navigation", replacement: path("./mock-next.mjs") },
      { find: "next/link", replacement: path("./mock-next.mjs") },
      { find: "@/features/lessons/session-actions", replacement: path("./mock-chapter-actions.mjs") },
      { find: "@/features/rooms/lifecycle-actions", replacement: path("./mock-chapter-actions.mjs") },
      { find: "@/features/rooms/session-reflection-actions", replacement: path("./mock-next.mjs") },
      { find: "@", replacement: path("../../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 4178, strictPort: true, fs: { allow: [path("../../")] } },
});
