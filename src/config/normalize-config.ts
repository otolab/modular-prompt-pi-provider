import type { ApplicationConfig, DriverCapability, DriverProvider, ModelSpec } from "@modular-prompt/driver";
import { DEFAULT_MODEL_FALLBACK } from "../constants.js";
import type { PiProviderYamlConfig } from "../pi-provider-config.js";
import { pickMlxDriverDefaultOptions } from "../driver/mlx-options.js";
import type {
  DefaultQueryOptions,
  LegacyModelEntry,
  LogicalModelDefinition,
  ProvidersConfig,
  ResolvedLogicalModel,
  ResolvedProviderConfig,
  ResolvedVirtualModel,
} from "./types.js";

const DEFAULT_CAPABILITIES: DriverCapability[] = [
  "streaming",
  "local",
  "multilingual",
  "japanese",
  "chat",
  "tools",
  "reasoning",
  "function-calling",
];

const DEFAULT_LOGICAL_MODEL = "default";

function resolveDefaultPhysicalModel(): string {
  return process.env.MODULAR_PROMPT_PI_MODEL ?? DEFAULT_MODEL_FALLBACK;
}

/** YAML プロバイダ名 → driver の DriverProvider */
export function normalizeDriverProvider(providerName: string): DriverProvider {
  if (providerName === "mlx_lm" || providerName === "mlx") {
    return "mlx";
  }
  return providerName as DriverProvider;
}

/** レガシー `drivers` を `providers` にマージする */
export function normalizeProviders(yaml: PiProviderYamlConfig): ProvidersConfig {
  const providers: ProvidersConfig = {};

  for (const [name, connection] of Object.entries(yaml.providers ?? {})) {
    if (connection) {
      providers[name] = connection;
    }
  }

  if (yaml.drivers?.mlx) {
    providers.mlx = {
      ...providers.mlx,
      ...yaml.drivers.mlx,
    };
  }

  return providers;
}

function mergeDefaultQueryOptions(
  fromDefaultOptions?: DefaultQueryOptions,
  fromDefaultQueryOptions?: DefaultQueryOptions,
): DefaultQueryOptions {
  return {
    ...fromDefaultOptions,
    ...fromDefaultQueryOptions,
  };
}

function requireDefaultQueryOptions(
  logicalName: string,
  options: DefaultQueryOptions | undefined,
): DefaultQueryOptions {
  if (!options || Object.keys(options).length === 0) {
    throw new Error(
      `Model "${logicalName}" requires defaultQueryOptions (or legacy defaultOptions).`,
    );
  }
  return options;
}

function resolveProviderCacheDir(
  providerName: string,
  providers: ProvidersConfig,
): string | undefined {
  const connection =
    providers[providerName] ??
    (providerName === "mlx" || providerName === "mlx_lm"
      ? (providers.mlx ?? providers.mlx_lm)
      : undefined);
  const cacheDir = connection?.cacheDir;
  return typeof cacheDir === "string" && cacheDir.length > 0 ? cacheDir : undefined;
}

function buildDriverOptions(
  definition: LogicalModelDefinition,
  providers: ProvidersConfig,
): ModelSpec["driverOptions"] | undefined {
  const providerCacheDir = resolveProviderCacheDir(definition.provider, providers);
  const { cacheDir: _ignored, ...rest } = definition.driverOptions ?? {};
  const merged = providerCacheDir ? { ...rest, cacheDir: providerCacheDir } : rest;
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/** 論理モデル定義 → ModelSpec（Pi catalog / driver 作成用） */
export function logicalModelToSpec(
  logicalName: string,
  definition: LogicalModelDefinition,
  providers: ProvidersConfig = {},
): ResolvedLogicalModel {
  const provider = normalizeDriverProvider(definition.provider);
  const defaultQueryOptions = requireDefaultQueryOptions(
    logicalName,
    definition.defaultQueryOptions,
  );
  const defaultOptions = pickMlxDriverDefaultOptions(defaultQueryOptions);
  const maxOutputTokens =
    definition.maxOutputTokens ?? defaultQueryOptions.maxTokens ?? 8_192;
  const driverOptions = buildDriverOptions(definition, providers);

  const spec: ModelSpec = {
    model: definition.model,
    provider,
    capabilities: (definition.capabilities ?? DEFAULT_CAPABILITIES) as DriverCapability[],
    ...(definition.maxInputTokens != null ? { maxInputTokens: definition.maxInputTokens } : {}),
    maxOutputTokens,
    priority: definition.priority ?? 10,
    ...(defaultOptions ? { defaultOptions } : {}),
    ...(driverOptions ? { driverOptions } : {}),
  };

  return {
    logicalName,
    provider,
    physicalModel: definition.model,
    defaultQueryOptions,
    disabled: definition.disabled === true,
    spec,
  };
}

function legacyEntryToDefinition(entry: LegacyModelEntry): {
  logicalName: string;
  definition: LogicalModelDefinition;
} {
  const logicalName = entry.id ?? entry.model;
  const defaultQueryOptions = requireDefaultQueryOptions(
    logicalName,
    mergeDefaultQueryOptions(entry.defaultOptions, entry.defaultQueryOptions),
  );

  return {
    logicalName,
    definition: {
      provider: entry.provider ?? "mlx",
      model: entry.model,
      defaultQueryOptions,
      ...(entry.disabled != null ? { disabled: entry.disabled } : {}),
      ...(entry.capabilities ? { capabilities: entry.capabilities } : {}),
      ...(entry.maxInputTokens != null ? { maxInputTokens: entry.maxInputTokens } : {}),
      ...(entry.maxOutputTokens != null ? { maxOutputTokens: entry.maxOutputTokens } : {}),
      ...(entry.priority != null ? { priority: entry.priority } : {}),
      ...(entry.driverOptions ? { driverOptions: entry.driverOptions } : {}),
    },
  };
}

function isLegacyModelsArray(
  models: PiProviderYamlConfig["models"],
): models is LegacyModelEntry[] {
  return Array.isArray(models);
}

/** YAML `models` を論理名 → ResolvedLogicalModel に解決する */
export function resolveLogicalModels(
  yaml: PiProviderYamlConfig,
): Map<string, ResolvedLogicalModel> {
  const providers = normalizeProviders(yaml);
  const result = new Map<string, ResolvedLogicalModel>();

  if (!yaml.models) {
    const physicalModel = resolveDefaultPhysicalModel();
    const resolved = logicalModelToSpec(
      DEFAULT_LOGICAL_MODEL,
      {
        provider: "mlx",
        model: physicalModel,
        defaultQueryOptions: { maxTokens: 8_192 },
      },
      providers,
    );
    result.set(DEFAULT_LOGICAL_MODEL, resolved);
    return result;
  }

  if (isLegacyModelsArray(yaml.models)) {
    for (const entry of yaml.models) {
      const { logicalName, definition } = legacyEntryToDefinition(entry);
      result.set(logicalName, logicalModelToSpec(logicalName, definition, providers));
    }
    return result;
  }

  for (const [logicalName, rawDefinition] of Object.entries(yaml.models)) {
    const definition = rawDefinition as LogicalModelDefinition;
    result.set(logicalName, logicalModelToSpec(logicalName, definition, providers));
  }

  return result;
}

function extractVirtualModels(
  workflows: ResolvedProviderConfig["workflows"],
): Map<string, ResolvedVirtualModel> {
  const virtualModels = new Map<string, ResolvedVirtualModel>();

  for (const [workflowKey, workflow] of Object.entries(workflows)) {
    if (!workflow.virtualModel) {
      continue;
    }
    virtualModels.set(workflow.virtualModel, {
      name: workflow.virtualModel,
      workflowKey,
      workflow,
    });
  }

  return virtualModels;
}

function providersToApplicationDrivers(
  providers: ProvidersConfig,
): ApplicationConfig["drivers"] {
  const mlx = providers.mlx ?? providers.mlx_lm;
  return mlx ? { mlx } : undefined;
}

function resolveDefaultLogicalModel(
  logicalModels: Map<string, ResolvedLogicalModel>,
): string {
  if (logicalModels.has(DEFAULT_LOGICAL_MODEL)) {
    return DEFAULT_LOGICAL_MODEL;
  }
  const firstEnabled = [...logicalModels.values()].find((model) => !model.disabled);
  return firstEnabled?.logicalName ?? [...logicalModels.keys()][0] ?? DEFAULT_LOGICAL_MODEL;
}

/** YAML を正規化し、論理モデル・workflow・ApplicationConfig を構築する */
export function normalizeProviderConfig(
  yaml: PiProviderYamlConfig = {},
): ResolvedProviderConfig {
  const providers = normalizeProviders(yaml);
  const logicalModels = resolveLogicalModels(yaml);
  const modelSets = yaml.modelSets ?? {};
  const workflows = yaml.workflow ?? {};
  const processes = yaml.processes ?? {};
  const virtualModels = extractVirtualModels(workflows);
  const defaultLogicalModel = resolveDefaultLogicalModel(logicalModels);

  const applicationConfig: ApplicationConfig = {
    ...(providersToApplicationDrivers(providers)
      ? { drivers: providersToApplicationDrivers(providers) }
      : {}),
    models: [...logicalModels.values()]
      .filter((model) => !model.disabled)
      .map((model) => model.spec),
  };

  return {
    providers,
    logicalModels,
    modelSets,
    workflows,
    processes,
    virtualModels,
    defaultLogicalModel,
    applicationConfig,
  };
}
