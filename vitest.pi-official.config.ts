import { defineConfig } from "vitest/config";

/**
 * Pi 公式 provider 互換テスト（#35）
 * - TestDriver 層: CI 必須（決定的）
 * - MLX 層: describe.skipIf でオプション
 */
export default defineConfig({
  test: {
    name: "pi-official",
    globals: false,
    environment: "node",
    include: ["tests/pi-official/**/*.test.ts"],
    globalSetup: ["tests/pi-official/global-setup.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: {
      concurrent: false,
    },
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
