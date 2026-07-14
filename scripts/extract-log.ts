#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import {
  formatShowOutput,
  formatSummaryTable,
  loadRequestLog,
  summarizeLogs,
} from "../src/logging/extract-log.ts";

const DEFAULT_DIR = join(
  homedir(),
  ".pi/agent/modular-prompt-provider/logs/requests",
);

function usage(): void {
  console.log(`Usage:
  extract-log summary [--dir PATH]
  extract-log show --seq SEQ [--dir PATH]
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  let dir = DEFAULT_DIR;
  let seqId: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) {
      dir = args[++i]!;
    } else if (args[i] === "--seq" && args[i + 1]) {
      seqId = args[++i];
    }
  }

  if (cmd === "summary") {
    const summaries = await summarizeLogs(dir);
    console.log(formatSummaryTable(summaries));
    return;
  }

  if (cmd === "show") {
    if (!seqId) {
      usage();
      process.exitCode = 1;
      return;
    }
    const loaded = await loadRequestLog(dir, seqId);
    if (!loaded) {
      console.error(`seq ${seqId} のログが見つかりません (${dir})`);
      process.exitCode = 1;
      return;
    }
    console.log(formatShowOutput(loaded.file, loaded.entries));
    return;
  }

  usage();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
