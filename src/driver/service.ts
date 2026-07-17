import { AIService, type ApplicationConfig } from "@modular-prompt/driver";
import { initCacheRuntime, resetCacheRuntime } from "../cache/runtime.js";
import { initLoggingRuntime, resetLoggingRuntime } from "../logging/runtime.js";
import {
  createApplicationConfig,
  createResolvedProviderConfig,
  type ResolvedProviderConfig,
} from "../config.js";
import type { PiProviderYamlConfig } from "../pi-provider-config.js";
import { resolveConfiguredRequestLogDir } from "../pi-provider-config.js";
import { resetModelRegistry } from "./model-registry.js";

let service: AIService | undefined;
let config: ApplicationConfig | undefined;
let resolvedConfig: ResolvedProviderConfig | undefined;

export function getApplicationConfig(): ApplicationConfig {
  if (!config) {
    config = createApplicationConfig();
    resolvedConfig = createResolvedProviderConfig();
  }
  return config;
}

export function getResolvedProviderConfig(): ResolvedProviderConfig {
  if (!resolvedConfig) {
    resolvedConfig = createResolvedProviderConfig();
    config = resolvedConfig.applicationConfig;
  }
  return resolvedConfig;
}

export function initApplicationConfig(
  yamlConfig?: PiProviderYamlConfig,
  overrides?: Partial<ApplicationConfig>,
): ApplicationConfig {
  resolvedConfig = createResolvedProviderConfig(yamlConfig, overrides);
  config = resolvedConfig.applicationConfig;
  initCacheRuntime(yamlConfig, config);
  initLoggingRuntime(
    yamlConfig,
    yamlConfig?.logging?.dir || resolveConfiguredRequestLogDir(),
  );
  service = undefined;
  return config;
}

export function initResolvedProviderConfig(
  yamlConfig?: PiProviderYamlConfig,
  overrides?: Partial<ApplicationConfig>,
): ResolvedProviderConfig {
  initApplicationConfig(yamlConfig, overrides);
  return getResolvedProviderConfig();
}

export function getAIService(appConfig?: ApplicationConfig): AIService {
  if (appConfig) {
    service = new AIService(appConfig);
    config = appConfig;
    return service;
  }
  if (!service) {
    const resolved = getApplicationConfig();
    service = new AIService(resolved);
  }
  return service;
}

/** テスト用: シングルトンをリセット */
export function resetAIService(): void {
  service = undefined;
  config = undefined;
  resolvedConfig = undefined;
  resetModelRegistry();
  resetCacheRuntime();
  resetLoggingRuntime();
}
