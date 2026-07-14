import { defineConfig } from "vitest/config";

/** MLX 実機インテグレーション専用（tests/integration/ のみ） */
export default defineConfig({
  test: {
    name: "integration",
    globals: false,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
