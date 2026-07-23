import type { CompactInput, CompactResult, CompactRunContext } from "./types.js";

/** 圧縮方式の実装契約。streamProcess 等の具体実行は strategy 内に閉じる */
export interface CompactStrategy {
  readonly id: string;
  run(input: CompactInput, context: CompactRunContext): Promise<CompactResult>;
}
