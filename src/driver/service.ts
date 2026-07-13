import { AIService, type ApplicationConfig } from "@modular-prompt/driver";
import { createApplicationConfig } from "../config.js";

let service: AIService | undefined;
let config: ApplicationConfig | undefined;

export function getApplicationConfig(): ApplicationConfig {
  if (!config) {
    config = createApplicationConfig();
  }
  return config;
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
}
