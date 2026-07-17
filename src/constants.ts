/** コードデフォルト物理モデル（優先度最低） */
export const DEFAULT_MODEL_FALLBACK =
  "mlx-community/gemma-4-26B-A4B-it-heretic-4bit";

export const PROVIDER_ID = "modular-prompt-provider";
export const API_ID = "modular-prompt-provider";

/** Pi registerProvider 必須フィールド。streamSimple では HTTP に使わない */
export const PROVIDER_BASE_URL = "local://modular-prompt-provider";
export const PROVIDER_API_KEY = "local";
