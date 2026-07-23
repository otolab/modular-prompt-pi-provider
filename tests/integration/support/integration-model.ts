import { INTEGRATION_MLX_MODEL_DEFAULT } from "../../../src/constants.js";

/**
 * MLX インテグレーションテスト用のデフォルトモデル。
 *
 * - text-only LM（KV キャッシュ対応）
 * - 1.7B 2bit で実機テストのサイズ・速度に最適
 */
export { INTEGRATION_MLX_MODEL_DEFAULT };

export function resolveIntegrationModelId(): string {
  return process.env.INTEGRATION_MLX_MODEL ?? INTEGRATION_MLX_MODEL_DEFAULT;
}
