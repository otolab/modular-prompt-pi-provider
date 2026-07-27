import type { DriverProvider } from "@modular-prompt/driver";

/** YAML プロバイダ名 → driver の DriverProvider */
export function normalizeDriverProvider(providerName: string): DriverProvider {
  if (providerName === "mlx_lm" || providerName === "mlx") {
    return "mlx";
  }
  return providerName as DriverProvider;
}
