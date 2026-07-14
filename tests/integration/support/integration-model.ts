/**
 * MLX インテグレーションテスト用のデフォルトモデル。
 *
 * - text-only LM（KV キャッシュ対応）
 * - 1.7B 2bit で実機テストのサイズ・速度に最適
 *
 * アプリのコードデフォルト（Gemma 4 VLM）は KV キャッシュ非対応のため使わない。
 */
export const INTEGRATION_MLX_MODEL_DEFAULT =
  "prism-ml/Ternary-Bonsai-1.7B-mlx-2bit";

export function resolveIntegrationModelId(): string {
  return process.env.INTEGRATION_MLX_MODEL ?? INTEGRATION_MLX_MODEL_DEFAULT;
}
