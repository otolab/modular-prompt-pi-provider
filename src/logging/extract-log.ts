import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { LogEntry } from "./log-entry.js";

export interface RequestLogSummary {
  file: string;
  seqId: string;
  pid: number;
  startedAt: string;
  types: LogEntry["type"][];
}

export function parseLogFile(content: string): LogEntry[] {
  const entries: LogEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as LogEntry);
    } catch {
      // skip corrupt lines
    }
  }
  return entries;
}

export function summarizeRequestLog(file: string, entries: LogEntry[]): RequestLogSummary {
  const first = entries[0];
  return {
    file,
    seqId: first?.seqId ?? "????",
    pid: first?.pid ?? 0,
    startedAt: first?.timestamp ?? "unknown",
    types: [...new Set(entries.map((entry) => entry.type))],
  };
}

export async function listRequestLogFiles(dir: string): Promise<string[]> {
  try {
    const names = await readdir(dir);
    return names
      .filter((name) => name.endsWith(".jsonl"))
      .sort()
      .map((name) => basename(name));
  } catch {
    return [];
  }
}

export async function summarizeLogs(dir: string): Promise<RequestLogSummary[]> {
  const files = await listRequestLogFiles(dir);
  const summaries: RequestLogSummary[] = [];
  for (const file of files) {
    const content = await readFile(`${dir}/${file}`, "utf-8");
    summaries.push(summarizeRequestLog(file, parseLogFile(content)));
  }
  return summaries;
}

export async function loadRequestLog(
  dir: string,
  seqId: string,
): Promise<{ file: string; entries: LogEntry[] } | undefined> {
  const normalized = seqId.padStart(4, "0");
  const files = await listRequestLogFiles(dir);
  const match = files.find((file) => file.endsWith(`-${normalized}.jsonl`));
  if (!match) return undefined;
  const entries = parseLogFile(await readFile(`${dir}/${match}`, "utf-8"));
  return { file: match, entries };
}

export function formatSummaryTable(summaries: RequestLogSummary[]): string {
  if (summaries.length === 0) {
    return "リクエストログがありません";
  }
  const lines = ["seqId  startedAt                  types"];
  for (const item of summaries) {
    lines.push(
      `${item.seqId}  ${item.startedAt}  ${item.types.join(",")}`,
    );
  }
  return lines.join("\n");
}

export function formatShowOutput(file: string, entries: LogEntry[]): string {
  const lines = [`file: ${file}`, `entries: ${entries.length}`];
  for (const entry of entries) {
    lines.push(`- [${entry.type}] phase=${entry.phase} ts=${entry.timestamp}`);
  }
  return lines.join("\n");
}
