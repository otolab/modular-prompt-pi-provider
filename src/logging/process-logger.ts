import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { LogEntry } from "./log-entry.js";
import type { LoggingPolicy } from "./log-policy.js";
import { isLoggingEnabled } from "./log-policy.js";

/** リクエスト外イベント（cache eviction 等）を記録する */
export class ProcessLogger {
  constructor(
    private readonly policy: LoggingPolicy,
    private readonly pid = process.pid,
  ) {}

  private eventsPath(): string {
    const base = dirname(this.policy.dir);
    return `${base}/server-${this.pid}.jsonl`;
  }

  async log(type: LogEntry["type"], phase: string, data: unknown): Promise<void> {
    if (!isLoggingEnabled(this.policy)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      pid: this.pid,
      seqId: "0000",
      phase,
      type,
      data,
    };

    const path = this.eventsPath();
    try {
      await mkdir(dirname(path), { recursive: true });
      await appendFile(path, `${JSON.stringify(entry)}\n`, "utf-8");
    } catch (error) {
      console.error("Failed to append process log:", error);
    }
  }
}
