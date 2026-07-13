import type { ModelSpec } from "@modular-prompt/driver";

/**
 * MlxDriver.defaultOptions に渡してよいフィールド。
 *
 * modular-prompt の MlxMlModelOptions のうち、Python `mapOptionsToPython` が
 * 受け付けるものだけ。`mode` は ModelSpec.defaultOptions に入れない
 * （driver-usage スキルの MlxDriver.defaultOptions 参照）。
 *
 * @see modular-prompt/skills/driver-usage/SKILL.md — MlxDriver.defaultOptions
 */
export type MlxDriverDefaultOptions = Pick<
  NonNullable<ModelSpec["defaultOptions"]>,
  "maxTokens" | "temperature" | "topP" | "topK"
>;

export function pickMlxDriverDefaultOptions(
  options?: ModelSpec["defaultOptions"],
): MlxDriverDefaultOptions | undefined {
  if (!options) return undefined;

  const picked: MlxDriverDefaultOptions = {};
  if (options.maxTokens !== undefined) picked.maxTokens = options.maxTokens;
  if (options.temperature !== undefined) picked.temperature = options.temperature;
  if (options.topP !== undefined) picked.topP = options.topP;
  if (options.topK !== undefined) picked.topK = options.topK;

  return Object.keys(picked).length > 0 ? picked : undefined;
}
