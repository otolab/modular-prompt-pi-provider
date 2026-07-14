import type { ApplicationConfig } from "@modular-prompt/driver";

/** ApplicationConfig から重複のない cacheDir 一覧を返す */
export function collectCacheDirs(config: ApplicationConfig): string[] {
  const dirs = new Set<string>();
  for (const spec of config.models ?? []) {
    const cacheDir = spec.driverOptions?.cacheDir;
    if (typeof cacheDir === "string" && cacheDir.length > 0) {
      dirs.add(cacheDir);
    }
  }
  return [...dirs];
}
