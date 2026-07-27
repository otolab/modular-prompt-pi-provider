import { resolveCompactStrategy } from "../../compact/registry.js";
import { DRIVER_ROLES } from "../resolve-model-set.js";
import { resolveSelection } from "../resolve-selection.js";
import type { LogicalModelDefinition, ResolvedProviderConfig } from "../types.js";
import type { ValidationCollector } from "./collector.js";
import { lintPiSettings, type LintPiSettingsOptions } from "./lint-settings.js";
import { validateYamlProviderName } from "./providers.js";
import { validateDefaultQueryOptions } from "./query-options.js";
import type { ValidationIssue } from "./types.js";
import { ValidationCollector as Collector } from "./collector.js";

const RECOMMENDED_MODEL_SET_ROLES = new Set<string>(["default", ...DRIVER_ROLES]);

function requireNonEmptyString(
  collector: ValidationCollector,
  path: string,
  value: unknown,
  message: string,
): void {
  if (typeof value !== "string" || value.length === 0) {
    collector.error(path, message);
  }
}

export function collectLogicalModelDefinition(
  collector: ValidationCollector,
  logicalName: string,
  definition: LogicalModelDefinition,
): void {
  const basePath = `models.${logicalName}`;

  requireNonEmptyString(
    collector,
    `${basePath}.provider`,
    definition.provider,
    `Model "${logicalName}" requires provider.`,
  );
  requireNonEmptyString(
    collector,
    `${basePath}.model`,
    definition.model,
    `Model "${logicalName}" requires model (physical model path).`,
  );

  validateYamlProviderName(collector, `${basePath}.provider`, definition.provider);
  validateDefaultQueryOptions(
    collector,
    `${basePath}.defaultQueryOptions`,
    definition.defaultQueryOptions,
  );

  if (!definition.defaultQueryOptions || Object.keys(definition.defaultQueryOptions).length === 0) {
    collector.error(
      `${basePath}.defaultQueryOptions`,
      `Model "${logicalName}" requires defaultQueryOptions (or legacy defaultOptions).`,
    );
  }

  if (definition.maxInputTokens != null) {
    if (
      typeof definition.maxInputTokens !== "number" ||
      !Number.isFinite(definition.maxInputTokens) ||
      definition.maxInputTokens <= 0
    ) {
      collector.error(`${basePath}.maxInputTokens`, "maxInputTokens must be a number greater than 0.");
    }
  }

  if (definition.maxOutputTokens != null) {
    if (
      typeof definition.maxOutputTokens !== "number" ||
      !Number.isFinite(definition.maxOutputTokens) ||
      definition.maxOutputTokens <= 0
    ) {
      collector.error(`${basePath}.maxOutputTokens`, "maxOutputTokens must be a number greater than 0.");
    }
  }
}

/** models マップ 1 エントリの必須フィールド（後方互換の throw API） */
export function validateLogicalModelDefinition(
  logicalName: string,
  definition: LogicalModelDefinition,
): void {
  const collector = new Collector();
  collectLogicalModelDefinition(collector, logicalName, definition);
  collector.throwIfErrors();
}

function validateProcesses(collector: ValidationCollector, config: ResolvedProviderConfig): void {
  for (const [processName, process] of Object.entries(config.processes)) {
    const path = `processes.${processName}.model`;
    requireNonEmptyString(collector, path, process.model, `processes.${processName} requires model.`);

    const selection = resolveSelection(process.model, config);
    if (!selection) {
      collector.error(
        path,
        `processes.${processName}.model "${process.model}" is not a registered logical model or virtualModel.`,
      );
      continue;
    }
    if (processName === "default" && selection.kind === "virtual") {
      collector.error(
        path,
        `processes.default.model "${process.model}" must be a logical model, not virtualModel.`,
      );
    }
  }
}

function validateWorkflows(collector: ValidationCollector, config: ResolvedProviderConfig): void {
  const seenVirtualModels = new Map<string, string>();

  for (const [workflowKey, workflow] of Object.entries(config.workflows)) {
    const basePath = `workflow.${workflowKey}`;

    if (workflow.type !== "passthrough" && workflow.type !== "agentic") {
      collector.error(`${basePath}.type`, `workflow.${workflowKey}.type must be "passthrough" or "agentic".`);
    }

    if (workflow.type === "agentic" && !workflow.modelSet) {
      collector.error(`${basePath}.modelSet`, `workflow.${workflowKey}.type "agentic" requires modelSet.`);
    }

    if (workflow.modelSet && !config.modelSets[workflow.modelSet]) {
      collector.error(
        `${basePath}.modelSet`,
        `workflow.${workflowKey}.modelSet "${workflow.modelSet}" is not defined in modelSets.`,
      );
    }

    if (!workflow.virtualModel) {
      continue;
    }

    if (!workflow.modelSet) {
      collector.error(
        `${basePath}.virtualModel`,
        `workflow.${workflowKey}.virtualModel requires modelSet.`,
      );
    }

    const duplicateKey = seenVirtualModels.get(workflow.virtualModel);
    if (duplicateKey) {
      collector.error(
        `${basePath}.virtualModel`,
        `workflow.${workflowKey}.virtualModel "${workflow.virtualModel}" duplicates workflow.${duplicateKey}.virtualModel.`,
      );
    }
    seenVirtualModels.set(workflow.virtualModel, workflowKey);
  }
}

function validateModelSets(collector: ValidationCollector, config: ResolvedProviderConfig): void {
  for (const [setName, roles] of Object.entries(config.modelSets)) {
    for (const [role, logicalName] of Object.entries(roles)) {
      const path = `modelSets.${setName}.${role}`;

      if (!RECOMMENDED_MODEL_SET_ROLES.has(role)) {
        collector.warn(
          path,
          `role "${role}" is not a recommended modelSet role (${[...RECOMMENDED_MODEL_SET_ROLES].join(", ")}).`,
        );
      }

      if (config.virtualModels.has(logicalName)) {
        collector.error(path, `modelSets.${setName}.${role} "${logicalName}" must reference a logical model, not virtualModel.`);
        continue;
      }

      const logical = config.logicalModels.get(logicalName);
      if (!logical) {
        collector.error(path, `modelSets.${setName}.${role} "${logicalName}" is not defined in models.`);
        continue;
      }
      if (logical.disabled) {
        collector.error(path, `modelSets.${setName}.${role} "${logicalName}" references a disabled model.`);
      }
    }
  }
}

function validateCompact(collector: ValidationCollector, config: ResolvedProviderConfig): void {
  const strategy = config.compact?.strategy;
  if (!strategy) {
    return;
  }
  try {
    resolveCompactStrategy(strategy);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    collector.error("compact.strategy", message);
  }
}

export interface ValidateProviderConfigOptions extends LintPiSettingsOptions {
  /** Pi settings.json の lint を実行する（load 時のみ true 推奨） */
  lintPiSettings?: boolean;
}

export interface ProviderConfigValidationResult {
  warnings: ValidationIssue[];
}

/**
 * 正規化済み config を検証する。
 * error は ConfigValidationError で throw、warning は戻り値で返す。
 */
export function validateProviderConfig(
  config: ResolvedProviderConfig,
  options: ValidateProviderConfigOptions = {},
): ProviderConfigValidationResult {
  const collector = new Collector();

  for (const [logicalName, logicalModel] of config.logicalModels) {
    collectLogicalModelDefinition(collector, logicalName, {
      provider: logicalModel.provider,
      model: logicalModel.physicalModel,
      defaultQueryOptions: logicalModel.defaultQueryOptions,
      disabled: logicalModel.disabled,
      capabilities: logicalModel.spec.capabilities,
      ...(logicalModel.spec.maxInputTokens != null
        ? { maxInputTokens: logicalModel.spec.maxInputTokens }
        : {}),
      ...(logicalModel.spec.maxOutputTokens != null
        ? { maxOutputTokens: logicalModel.spec.maxOutputTokens }
        : {}),
    });
  }

  validateProcesses(collector, config);
  validateWorkflows(collector, config);
  validateModelSets(collector, config);
  validateCompact(collector, config);
  if (options.lintPiSettings) {
    lintPiSettings(collector, config, options);
  }

  collector.throwIfErrors();
  return { warnings: collector.getWarnings() };
}

export function logConfigValidationWarnings(warnings: ValidationIssue[]): void {
  for (const warning of warnings) {
    console.warn(`[modular-prompt-provider] ${warning.path}: ${warning.message}`);
  }
}
