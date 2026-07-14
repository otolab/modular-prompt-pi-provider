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

export function isDebugLoggingEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.MODULAR_PROMPT_PI_DEBUG;
  return value === "1" || value === "true" || value === "yes";
}

export function resolveLoggingPolicy(
  yaml: PiProviderYamlConfig["logging"] | undefined,
  options: { defaultDir: string; debugEnv?: boolean },
): LoggingPolicy {
  const debug = options.debugEnv ?? isDebugLoggingEnv();
  const yamlLevel = yaml?.requestResponseLevel;

  let requestResponseLevel: RequestResponseLevel;
  if (yamlLevel) {
    requestResponseLevel = yamlLevel;
  } else if (yaml) {
    requestResponseLevel = debug ? "full" : "minimal";
  } else if (debug) {
    requestResponseLevel = "full";
  } else {
    requestResponseLevel = "none";
  }

  return {
    requestResponseLevel,
    dir: yaml?.dir ?? options.defaultDir,
  };
}

export function isLoggingEnabled(policy: LoggingPolicy): boolean {
  return policy.requestResponseLevel !== "none" && policy.dir.length > 0;
}
