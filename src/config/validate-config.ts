import { resolveSelection } from "./resolve-selection.js";
import type { LogicalModelDefinition, ResolvedProviderConfig } from "./types.js";

function requireNonEmptyString(
  value: unknown,
  message: string,
): asserts value is string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(message);
  }
}

/** models マップ 1 エントリの必須フィールド */
export function validateLogicalModelDefinition(
  logicalName: string,
  definition: LogicalModelDefinition,
): void {
  requireNonEmptyString(
    definition.provider,
    `Model "${logicalName}" requires provider.`,
  );
  requireNonEmptyString(
    definition.model,
    `Model "${logicalName}" requires model (physical model path).`,
  );
}

function validateProcesses(config: ResolvedProviderConfig): void {
  for (const [processName, process] of Object.entries(config.processes)) {
    requireNonEmptyString(
      process.model,
      `processes.${processName} requires model.`,
    );
    const selection = resolveSelection(process.model, config);
    if (!selection) {
      throw new Error(
        `processes.${processName}.model "${process.model}" is not a registered logical model or virtualModel.`,
      );
    }
    if (processName === "default" && selection.kind === "virtual") {
      throw new Error(
        `processes.default.model "${process.model}" must be a logical model, not virtualModel.`,
      );
    }
  }
}

function validateWorkflows(config: ResolvedProviderConfig): void {
  const seenVirtualModels = new Map<string, string>();

  for (const [workflowKey, workflow] of Object.entries(config.workflows)) {
    if (workflow.type !== "passthrough" && workflow.type !== "agentic") {
      throw new Error(
        `workflow.${workflowKey}.type must be "passthrough" or "agentic".`,
      );
    }

    if (workflow.modelSet && !config.modelSets[workflow.modelSet]) {
      throw new Error(
        `workflow.${workflowKey}.modelSet "${workflow.modelSet}" is not defined in modelSets.`,
      );
    }

    if (!workflow.virtualModel) {
      continue;
    }

    if (!workflow.modelSet) {
      throw new Error(
        `workflow.${workflowKey}.virtualModel requires modelSet.`,
      );
    }

    const duplicateKey = seenVirtualModels.get(workflow.virtualModel);
    if (duplicateKey) {
      throw new Error(
        `workflow.${workflowKey}.virtualModel "${workflow.virtualModel}" duplicates workflow.${duplicateKey}.virtualModel.`,
      );
    }
    seenVirtualModels.set(workflow.virtualModel, workflowKey);
  }
}

function validateModelSets(config: ResolvedProviderConfig): void {
  for (const [setName, roles] of Object.entries(config.modelSets)) {
    for (const [role, logicalName] of Object.entries(roles)) {
      if (config.virtualModels.has(logicalName)) {
        throw new Error(
          `modelSets.${setName}.${role} "${logicalName}" must reference a logical model, not virtualModel.`,
        );
      }

      const logical = config.logicalModels.get(logicalName);
      if (!logical) {
        throw new Error(
          `modelSets.${setName}.${role} "${logicalName}" is not defined in models.`,
        );
      }
      if (logical.disabled) {
        throw new Error(
          `modelSets.${setName}.${role} "${logicalName}" references a disabled model.`,
        );
      }
    }
  }
}

/** 正規化済み config の簡易バリデーション（ロード時に fail-fast） */
export function validateProviderConfig(config: ResolvedProviderConfig): void {
  validateProcesses(config);
  validateWorkflows(config);
  validateModelSets(config);
}
