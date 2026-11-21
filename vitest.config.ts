import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["dotenv/config"],
    // Concurrency tests share one database; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
