import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { PROVIDER_ID } from "../../constants.js";
import type { ResolvedProviderConfig } from "../types.js";
import type { ValidationCollector } from "./collector.js";

const PHYSICAL_MODEL_HINT = /[/\\]|^mlx-community\//;

export interface LintPiSettingsOptions {
  cwd?: string;
  isProjectTrusted?: boolean;
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

interface PiSettings {
  defaultProvider?: string;
  defaultModel?: string;
}

function readSettingsFile(
  path: string,
  readFile: (path: string) => string,
): PiSettings | undefined {
  try {
    const parsed = JSON.parse(readFile(path)) as PiSettings;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function lintSettingsEntry(
  collector: ValidationCollector,
  path: string,
  settings: PiSettings | undefined,
  registeredLogicalNames: Set<string>,
): void {
  if (!settings?.defaultModel) {
    return;
  }

  if (settings.defaultProvider && settings.defaultProvider !== PROVIDER_ID) {
    return;
  }

  const modelId = settings.defaultModel;
  if (registeredLogicalNames.has(modelId)) {
    return;
  }

  if (PHYSICAL_MODEL_HINT.test(modelId)) {
    collector.warn(
      path,
      `defaultModel "${modelId}" looks like a physical model path. Use a logical name from config.yaml models (Issue #40).`,
    );
    return;
  }

  collector.warn(
    path,
    `defaultModel "${modelId}" is not registered in config.yaml models. Check logical model names or processes.default.`,
  );
}

/**
 * Pi settings.json の defaultModel が物理パスや未登録論理名のとき警告する。
 * エラーにはせず起動は継続する（Pi 管轄の設定のため）。
 */
export function lintPiSettings(
  collector: ValidationCollector,
  config: ResolvedProviderConfig,
  options: LintPiSettingsOptions = {},
): void {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path) => readFileSync(path, "utf-8"));
  const registered = new Set(config.logicalModels.keys());

  const globalPath = join(getAgentDir(), "settings.json");
  if (fileExists(globalPath)) {
    lintSettingsEntry(collector, "settings.json", readSettingsFile(globalPath, readFile), registered);
  }

  const cwd = options.cwd ?? process.cwd();
  if (options.isProjectTrusted) {
    const projectPath = join(cwd, CONFIG_DIR_NAME, "settings.json");
    if (fileExists(projectPath)) {
      lintSettingsEntry(
        collector,
        ".pi/settings.json",
        readSettingsFile(projectPath, readFile),
        registered,
      );
    }
  }
}
