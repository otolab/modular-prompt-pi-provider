import type { ApplicationConfig } from "@modular-prompt/driver";
import type { PiProviderYamlConfig } from "../pi-provider-config.js";
import { collectCacheDirs } from "./cache-dirs.js";
import {
  CacheManager,
  type CacheCleanResult,
  type CacheShowResult,
} from "./cache-manager.js";
import { logCacheEviction } from "../logging/runtime.js";
import {
  DEFAULT_CACHE_POLICY,
  resolveCachePolicy,
  type CachePolicy,
} from "./cache-policy.js";

let policy: CachePolicy = DEFAULT_CACHE_POLICY;
let cacheDirs: string[] = [];

export function initCacheRuntime(
  yaml: PiProviderYamlConfig | undefined,
  appConfig: ApplicationConfig,
): void {
  policy = resolveCachePolicy(yaml?.cache);
  cacheDirs = collectCacheDirs(appConfig);
}

export function resetCacheRuntime(): void {
  policy = DEFAULT_CACHE_POLICY;
  cacheDirs = [];
}

export function getCachePolicy(): CachePolicy {
  return policy;
}

export function getCacheDirs(): string[] {
  return cacheDirs;
}

function managerFor(cacheDir: string): CacheManager {
  return new CacheManager(cacheDir, policy);
}

export async function showAllCaches(): Promise<CacheShowResult[]> {
  return Promise.all(cacheDirs.map((dir) => managerFor(dir).show()));
}

function logEviction(result: CacheCleanResult, trigger: string): void {
  void logCacheEviction(trigger, result);
}

export async function sweepAllCaches(options?: {
  dryRun?: boolean;
  trigger?: string;
}): Promise<CacheCleanResult[]> {
  const trigger = options?.trigger ?? "sweep";
  const results: CacheCleanResult[] = [];
  for (const dir of cacheDirs) {
    const result = await managerFor(dir).clean({ dryRun: options?.dryRun });
    results.push(result);
    if (!options?.dryRun) {
      logEviction(result, trigger);
    }
  }
  return results;
}

export async function sweepCacheDirBeforeWrite(cacheDir: string): Promise<void> {
  if (!policy.sweepBeforeWrite) return;
  if (!cacheDirs.includes(cacheDir)) return;
  const result = await managerFor(cacheDir).clean();
  logEviction(result, "before-write");
}

export async function runCacheSweepOnStartup(): Promise<void> {
  if (!policy.sweepOnStartup) return;
  await sweepAllCaches({ trigger: "startup" });
}
