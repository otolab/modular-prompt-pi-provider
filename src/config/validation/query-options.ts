import type { DefaultQueryOptions } from "../types.js";
import type { ValidationCollector } from "./collector.js";

function validatePositiveNumber(
  collector: ValidationCollector,
  path: string,
  value: unknown,
  label: string,
): void {
  if (value == null) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    collector.error(path, `${label} must be a number greater than 0.`);
  }
}

function validateBoundedNumber(
  collector: ValidationCollector,
  path: string,
  value: unknown,
  label: string,
  min: number,
  max: number,
): void {
  if (value == null) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    collector.error(path, `${label} must be between ${min} and ${max}.`);
  }
}

/** defaultQueryOptions / legacy defaultOptions の値域検証 */
export function validateDefaultQueryOptions(
  collector: ValidationCollector,
  pathPrefix: string,
  options: DefaultQueryOptions,
): void {
  validatePositiveNumber(collector, `${pathPrefix}.maxTokens`, options.maxTokens, "maxTokens");
  validateBoundedNumber(
    collector,
    `${pathPrefix}.temperature`,
    options.temperature,
    "temperature",
    0,
    2,
  );
  validateBoundedNumber(collector, `${pathPrefix}.topP`, options.topP, "topP", 0, 1);
  validatePositiveNumber(collector, `${pathPrefix}.topK`, options.topK, "topK");
}
