import { normalizeDriverProvider } from "../normalize-provider.js";
import type { ValidationCollector } from "./collector.js";

/**
 * YAML `models.*.provider` で許容する名前。
 * driver 側の DriverProvider とは別に、ユーザー向けエイリアスもここで管理する。
 */
export const KNOWN_YAML_PROVIDER_NAMES = new Set(["mlx", "mlx_lm"]);

export function validateYamlProviderName(
  collector: ValidationCollector,
  path: string,
  providerName: string,
): void {
  if (!providerName) {
    return;
  }
  if (KNOWN_YAML_PROVIDER_NAMES.has(providerName)) {
    return;
  }

  try {
    const normalized = normalizeDriverProvider(providerName);
    if (normalized !== providerName) {
      collector.warn(
        path,
        `provider "${providerName}" is normalized to "${normalized}". Prefer "${normalized}" in config.yaml.`,
      );
      return;
    }
  } catch {
    // normalizeDriverProvider は現状 throw しないが将来の拡張に備える
  }

  collector.error(
    path,
    `unknown provider "${providerName}". Supported values: ${[...KNOWN_YAML_PROVIDER_NAMES].join(", ")}.`,
  );
}
