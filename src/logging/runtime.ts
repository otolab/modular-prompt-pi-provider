import type { PiProviderYamlConfig } from "../pi-provider-config.js";
import type { CacheCleanResult } from "../cache/cache-manager.js";
import { ProcessLogger } from "./process-logger.js";
import {
  DEFAULT_LOGGING_POLICY,
  isDebugLoggingEnv,
  isLoggingEnabled,
  resolveLoggingPolicy,
  type LoggingPolicy,
} from "./log-policy.js";
import { createRequestLogger, type RequestLogger } from "./request-logger.js";

let policy: LoggingPolicy = DEFAULT_LOGGING_POLICY;
let processLogger: ProcessLogger | undefined;

export function initLoggingRuntime(
  yaml: PiProviderYamlConfig | undefined,
  defaultLogDir: string,
): void {
  policy = resolveLoggingPolicy(yaml?.logging, {
    defaultDir: defaultLogDir,
    debugEnv: isDebugLoggingEnv(),
  });
  processLogger = isLoggingEnabled(policy) ? new ProcessLogger(policy) : undefined;
}

export function resetLoggingRuntime(): void {
  policy = DEFAULT_LOGGING_POLICY;
  processLogger = undefined;
}

export function getLoggingPolicy(): LoggingPolicy {
  return policy;
}

export function beginRequestLog(): RequestLogger | undefined {
  if (!isLoggingEnabled(policy)) return undefined;
  return createRequestLogger(policy.requestResponseLevel, policy.dir);
}

export async function logCacheEviction(
  trigger: string,
  result: CacheCleanResult,
): Promise<void> {
  if (result.deleted.length === 0) return;

  console.info(
    `[cache:${trigger}] ${result.cacheDir}: deleted ${result.deleted.length}, kept ${result.kept}, freed ${result.freedMb} MB`,
  );

  if (!processLogger) return;

  await processLogger.log("eviction", trigger, {
    cacheDir: result.cacheDir,
    deleted: result.deleted,
    kept: result.kept,
    freedMb: result.freedMb,
    dryRun: result.dryRun,
  });
}
