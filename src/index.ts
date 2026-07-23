import type { ApplicationConfig } from "@modular-prompt/driver";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API_ID, PROVIDER_BASE_URL, PROVIDER_API_KEY, PROVIDER_ID } from "./constants.js";
import { buildPiProviderModels } from "./driver/model-catalog.js";
import { discoverApplicationConfig } from "./driver/discovery.js";
import { initResolvedProviderConfig } from "./driver/service.js";
import { runCacheSweepOnStartup } from "./cache/runtime.js";
import { registerCacheCommands } from "./hooks/cache-commands.js";
import { registerCompactionHooks } from "./hooks/compaction.js";
import { registerSessionHooks } from "./hooks/session.js";
import { loadPiProviderConfig } from "./pi-provider-config.js";
import { streamModularPrompt } from "./stream-simple.js";
import type { ResolvedProviderConfig } from "./config/types.js";

function registerMlxProvider(pi: ExtensionAPI, resolvedConfig: ResolvedProviderConfig): void {
  const models = buildPiProviderModels(resolvedConfig);

  pi.registerProvider(PROVIDER_ID, {
    name: "Modular Prompt",
    baseUrl: PROVIDER_BASE_URL,
    apiKey: PROVIDER_API_KEY,
    api: API_ID,
    models,
    streamSimple: streamModularPrompt,
  });
}

export default async function (pi: ExtensionAPI): Promise<void> {
  registerSessionHooks(pi);
  registerCompactionHooks(pi);
  registerCacheCommands(pi);

  const loadAndRegister = async (
    cwd: string,
    isProjectTrusted: boolean,
  ): Promise<ApplicationConfig> => {
    const yamlConfig = loadPiProviderConfig({ cwd, isProjectTrusted });
    const baseResolved = initResolvedProviderConfig(yamlConfig);
    const discoveredConfig = await discoverApplicationConfig(baseResolved.applicationConfig);
    const resolvedConfig = initResolvedProviderConfig(yamlConfig, {
      models: discoveredConfig.models,
    });
    registerMlxProvider(pi, resolvedConfig);
    await runCacheSweepOnStartup();
    return resolvedConfig.applicationConfig;
  };

  await loadAndRegister(process.cwd(), false);

  pi.on("session_start", async (_event, ctx) => {
    await loadAndRegister(ctx.cwd, ctx.isProjectTrusted());
  });
}
