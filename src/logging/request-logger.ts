import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { LogEntry, LogEntryType } from "./log-entry.js";
import type { RequestResponseLevel } from "./log-policy.js";

const globalRequestCounter = new Map<number, number>();

export function nextRequestSeqId(pid: number): string {
  const current = globalRequestCounter.get(pid) ?? 0;
  const next = current + 1;
  globalRequestCounter.set(pid, next);
  return String(next).padStart(4, "0");
}

/** テスト用 */
export function resetRequestSeqCounter(): void {
  globalRequestCounter.clear();
}

export class RequestLogger {
  private readonly logFilePath: string;

  constructor(
    readonly pid: number,
    readonly seqId: string,
    readonly level: RequestResponseLevel,
    logDir: string,
    timestamp = new Date(),
  ) {
    const stamp = timestamp.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${stamp}-${pid}-${seqId}.jsonl`;
    this.logFilePath = join(logDir, filename);
  }

  get filePath(): string {
    return this.logFilePath;
  }

  private async append(type: LogEntryType, phase: string, data: unknown): Promise<void> {
    if (this.level === "none") return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      pid: this.pid,
      seqId: this.seqId,
      phase,
      type,
      data,
    };

    try {
      await mkdir(dirname(this.logFilePath), { recursive: true });
      await appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, "utf-8");
    } catch (error) {
      console.error("Failed to append request log:", error);
    }
  }

  async logIn(phase: string, data: unknown): Promise<void> {
    await this.append("in", phase, data);
  }

  async logOut(phase: string, data: unknown): Promise<void> {
    await this.append("out", phase, data);
  }

  async logPrompt(phase: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.level === "none") return;
    await this.append("prompt", phase, { content, ...metadata });
  }

  async logLlmResponse(phase: string, data: unknown): Promise<void> {
    if (this.level === "none") return;

    let payload = data;
    if (this.level === "minimal" && data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const content = typeof record.content === "string" ? record.content : "";
      payload = {
        hasContent: content.length > 0,
        contentLength: content.length,
        finishReason: record.finishReason,
        usage: record.usage,
        toolCallCount: Array.isArray(record.toolCalls) ? record.toolCalls.length : 0,
      };
    }

    await this.append("llm_response", phase, payload);
  }

  async logError(phase: string, message: string, data?: unknown): Promise<void> {
    if (this.level === "none") return;
    await this.append("error", phase, { message, ...(data ?? {}) });
  }

  async logDriverInfo(phase: string, data: unknown): Promise<void> {
    if (this.level === "none") return;
    await this.append("driver_info", phase, data);
  }

  async logCacheStats(phase: string, data: unknown): Promise<void> {
    if (this.level === "none") return;
    await this.append("cache_stats", phase, data);
  }
}

export function createRequestLogger(
  level: RequestResponseLevel,
  logDir: string,
  pid = process.pid,
): RequestLogger {
  return new RequestLogger(pid, nextRequestSeqId(pid), level, logDir);
}
