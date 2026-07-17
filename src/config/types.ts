import type {
  ApplicationConfig,
  DriverCapability,
  DriverProvider,
  ModelSpec,
} from "@modular-prompt/driver";
import type { PiProviderYamlModelEntry } from "../pi-provider-config.js";

/** プロバイダ接続設定（旧 `drivers.mlx` を `providers.mlx` に統合） */
export interface ProviderConnectionConfig {
  baseURL?: string;
  pythonPath?: string;
  /** MLX KV キャッシュ保存先（プロバイダ単位。全モデルで共有） */
  cacheDir?: string;
}

/** YAML `providers` セクション */
export type ProvidersConfig = Record<string, ProviderConnectionConfig>;

/** MLX 等に渡すデフォルトクエリオプション（正規化後は必須） */
export interface DefaultQueryOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

/** YAML `models` マップの 1 エントリ */
export interface LogicalModelDefinition {
  provider: string;
  model: string;
  defaultQueryOptions: DefaultQueryOptions;
  disabled?: boolean;
  capabilities?: string[];
  maxInputTokens?: number;
  maxOutputTokens?: number;
  priority?: number;
  driverOptions?: PiProviderYamlModelEntry["driverOptions"];
}

/** レガシー `models[]`（`id` 省略時は `model` が論理名） */
export interface LegacyModelEntry extends PiProviderYamlModelEntry {
  id?: string;
  defaultQueryOptions?: DefaultQueryOptions;
}

/** YAML `modelSets` — 役割名 → models 論理名 */
export type ModelSetsConfig = Record<string, Record<string, string>>;

/** YAML `workflow.*` */
export interface WorkflowDefinition {
  type: "passthrough" | "agentic";
  modelSet?: string;
  virtualModel?: string;
}

export type WorkflowConfig = Record<string, WorkflowDefinition>;

/** YAML `processes.*` */
export interface ProcessDefinition {
  model: string;
}

export type ProcessesConfig = Record<string, ProcessDefinition>;

/** 正規化済み論理モデル */
export interface ResolvedLogicalModel {
  logicalName: string;
  provider: DriverProvider;
  physicalModel: string;
  defaultQueryOptions: DefaultQueryOptions;
  disabled: boolean;
  spec: ModelSpec;
}

/** virtualModel 名 → workflow 解決情報 */
export interface ResolvedVirtualModel {
  name: string;
  workflowKey: string;
  workflow: WorkflowDefinition;
}

/** normalizeProviderConfig の出力 */
export interface ResolvedProviderConfig {
  providers: ProvidersConfig;
  logicalModels: Map<string, ResolvedLogicalModel>;
  modelSets: ModelSetsConfig;
  workflows: WorkflowConfig;
  processes: ProcessesConfig;
  virtualModels: Map<string, ResolvedVirtualModel>;
  defaultLogicalModel: string;
  applicationConfig: ApplicationConfig;
}

/** resolveSelection の結果 — 論理モデル */
export interface LogicalModelSelection {
  kind: "logical";
  logicalName: string;
  model: ResolvedLogicalModel;
}

/** resolveSelection の結果 — virtualModel（Phase 2 で実行） */
export interface VirtualModelSelection {
  kind: "virtual";
  virtualName: string;
  workflowKey: string;
  workflow: WorkflowDefinition;
}

export type ModelSelection = LogicalModelSelection | VirtualModelSelection;
