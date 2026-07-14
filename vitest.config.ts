import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    globals: false,
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
    // MLX 等のオンメモリモデルテストは逐次実行（並行禁止）
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    testTimeout: 10_000,
    hookTimeout: 300_000,
  },
});
