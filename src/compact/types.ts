import type { AIDriver } from "@modular-prompt/driver";

/** streamProcess に渡す 1 チャンク */
export interface CompactChunk {
  content: string;
  partOf?: string;
  /** トークン見積もり（range 分割に使用。未指定時は process 側で文字数推定） */
  usage?: number;
}

/** compact strategy への入力 */
export interface CompactInput {
  chunks: CompactChunk[];
  state?: {
    content: string;
    usage?: number;
  };
  targetTokens?: number;
}

/** compact 実行結果 */
export interface CompactResult {
  summary: string;
  state: {
    content: string;
    usage?: number;
  };
}

/** strategy 実行時のランタイムコンテキスト */
export interface CompactRunContext {
  driver: AIDriver;
  signal?: AbortSignal;
  tokenLimit?: number;
  maxChunk?: number;
}
