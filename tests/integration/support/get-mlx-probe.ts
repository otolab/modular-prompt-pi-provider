import { writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { probeMlxIntegration, type MlxProbeResult } from "./mlx-probe.js";

const PROBE_CACHE_FILE = join(import.meta.dirname, ".mlx-probe-result.json");

let inFlight: Promise<MlxProbeResult> | undefined;

/**
 * integration セッション内で MLX プローブを 1 回だけ実行する。
 * ファイルキャッシュで vitest のファイル分離時も再利用する。
 */
export function getMlxProbe(): Promise<MlxProbeResult> {
  if (existsSync(PROBE_CACHE_FILE)) {
    return Promise.resolve(
      JSON.parse(readFileSync(PROBE_CACHE_FILE, "utf-8")) as MlxProbeResult,
    );
  }

  if (!inFlight) {
    inFlight = probeMlxIntegration().then((result) => {
      writeFileSync(PROBE_CACHE_FILE, JSON.stringify(result));
      return result;
    });
  }

  return inFlight;
}

/** vitest globalSetup から呼び、前回結果を消す */
export function resetMlxProbeCache(): void {
  if (existsSync(PROBE_CACHE_FILE)) {
    rmSync(PROBE_CACHE_FILE);
  }
  inFlight = undefined;
}
