import type { PiProviderYamlConfig } from "../pi-provider-config.js";

export interface CachePolicy {
  maxAgeDays: number;
  maxSizeGb: number;
  minFreeDiskGb: number;
  sweepOnStartup: boolean;
  sweepBeforeWrite: boolean;
}

export const DEFAULT_CACHE_POLICY: CachePolicy = {
  maxAgeDays: 7,
  maxSizeGb: 5.0,
  minFreeDiskGb: 2.0,
  sweepOnStartup: true,
  sweepBeforeWrite: true,
};

export function resolveCachePolicy(
  input?: PiProviderYamlConfig["cache"],
): CachePolicy {
  return {
    maxAgeDays: input?.maxAgeDays ?? DEFAULT_CACHE_POLICY.maxAgeDays,
    maxSizeGb: input?.maxSizeGb ?? DEFAULT_CACHE_POLICY.maxSizeGb,
    minFreeDiskGb: input?.minFreeDiskGb ?? DEFAULT_CACHE_POLICY.minFreeDiskGb,
    sweepOnStartup: input?.sweepOnStartup ?? DEFAULT_CACHE_POLICY.sweepOnStartup,
    sweepBeforeWrite:
      input?.sweepBeforeWrite ?? DEFAULT_CACHE_POLICY.sweepBeforeWrite,
  };
}
