/** sprite-claude 互換の JSONL 1 行エントリ */
export type LogEntryType =
  | "in"
  | "out"
  | "prompt"
  | "llm_response"
  | "error"
  | "driver_info"
  | "cache_stats"
  | "eviction";

export interface LogEntry {
  timestamp: string;
  pid: number;
  seqId: string;
  phase: string;
  type: LogEntryType;
  data: unknown;
}
