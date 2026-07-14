import type { PiProviderYamlConfig } from "../pi-provider-config.js";

export type RequestResponseLevel = "none" | "minimal" | "full";

export interface LoggingPolicy {
  requestResponseLevel: RequestResponseLevel;
  dir: string;
}

export const DEFAULT_LOGGING_POLICY: LoggingPolicy = {
  requestResponseLevel: "none",
  dir: "",
};

export function resolveLoggingPolicy(
  yaml: PiProviderYamlConfig["logging"] | undefined,
  options: { defaultDir: string },
): LoggingPolicy {
  if (!yaml) {
    return DEFAULT_LOGGING_POLICY;
  }

  return {
    requestResponseLevel: yaml.requestResponseLevel ?? "minimal",
    dir: yaml.dir ?? options.defaultDir,
  };
}

export function isLoggingEnabled(policy: LoggingPolicy): boolean {
  return policy.requestResponseLevel !== "none" && policy.dir.length > 0;
}
