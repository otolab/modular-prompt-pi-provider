import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { showAllCaches, sweepAllCaches } from "../cache/runtime.js";

function formatShowOutput(
  results: Awaited<ReturnType<typeof showAllCaches>>,
): string {
  if (results.length === 0) {
    return "KV cache: 設定された cacheDir がありません";
  }

  return results
    .map((summary) => {
      const lines = [
        `cacheDir: ${summary.cacheDir}`,
        `entries: ${summary.entryCount}, total: ${summary.totalSizeGb} GB (${summary.totalSizeMb} MB)`,
      ];
      for (const entry of summary.entries) {
        lines.push(
          `  - ${entry.key.slice(0, 12)}… model=${entry.model} created=${entry.createdAt} size=${entry.sizeMb} MB hint=${entry.hint}`,
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function formatCleanOutput(
  results: Awaited<ReturnType<typeof sweepAllCaches>>,
  dryRun: boolean,
): string {
  if (results.length === 0) {
    return "KV cache: 設定された cacheDir がありません";
  }

  const prefix = dryRun ? "[dry-run] " : "";
  return results
    .map((result) => {
      const lines = [
        `${prefix}${result.cacheDir}: delete ${result.deleted.length}, keep ${result.kept}, free ${result.freedMb} MB`,
      ];
      for (const item of result.deleted) {
        lines.push(
          `  - ${item.key.slice(0, 12)}… ${item.reason} ${item.sizeMb} MB (${item.model})`,
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

export function registerCacheCommands(pi: ExtensionAPI): void {
  pi.registerCommand("cache", {
    description: "KV cache: show | clean [--dry-run]",
    handler: async (args, ctx) => {
      const tokens = args.trim().split(/\s+/).filter(Boolean);
      const sub = tokens[0] ?? "show";

      if (sub === "show") {
        const results = await showAllCaches();
        ctx.ui.notify(formatShowOutput(results), "info");
        return;
      }

      if (sub === "clean") {
        const dryRun = tokens.includes("--dry-run");
        const results = await sweepAllCaches({ dryRun, trigger: "manual" });
        ctx.ui.notify(formatCleanOutput(results, dryRun), "info");
        return;
      }

      ctx.ui.notify("Usage: /cache show | /cache clean [--dry-run]", "warning");
    },
  });
}
