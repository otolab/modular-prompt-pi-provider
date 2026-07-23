/** コードデフォルト物理モデル（優先度最低）。text LM・KV キャッシュ対応 */
export const DEFAULT_MODEL_FALLBACK =
  "prism-ml/Ternary-Bonsai-1.7B-mlx-2bit";

/** インテグレーション / experimental のデフォルト物理モデル（{@link DEFAULT_MODEL_FALLBACK} と同一） */
export const INTEGRATION_MLX_MODEL_DEFAULT = DEFAULT_MODEL_FALLBACK;

export const PROVIDER_ID = "modular-prompt-provider";
export const API_ID = "modular-prompt-provider";

/** Pi registerProvider 必須フィールド。streamSimple では HTTP に使わない */
export const PROVIDER_BASE_URL = "local://modular-prompt-provider";
export const PROVIDER_API_KEY = "local";
