import type { ApplicationConfig } from "@modular-prompt/driver";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API_ID, PROVIDER_API_KEY, PROVIDER_BASE_URL, PROVIDER_ID } from "./constants.js";
import { modelSpecToPiProviderModel } from "./driver/model-catalog.js";
import { discoverApplicationConfig } from "./driver/discovery.js";
import { initApplicationConfig } from "./driver/service.js";
import { createApplicationConfig } from "./config.js";
import { runCacheSweepOnStartup } from "./cache/runtime.js";
import { registerCacheCommands } from "./hooks/cache-commands.js";
import { registerSessionHooks } from "./hooks/session.js";
import { loadPiProviderConfig } from "./pi-provider-config.js";
import { streamModularPromptMlx } from "./stream-simple.js";

function registerMlxProvider(pi: ExtensionAPI, appConfig: ApplicationConfig): void {
  const models = (appConfig.models ?? []).map(modelSpecToPiProviderModel);

  pi.registerProvider(PROVIDER_ID, {
    name: "Modular Prompt",
    baseUrl: PROVIDER_BASE_URL,
    apiKey: PROVIDER_API_KEY,
    api: API_ID,
    models,
    streamSimple: streamModularPromptMlx,
  });
}

export default async function (pi: ExtensionAPI): Promise<void> {
  registerSessionHooks(pi);
  registerCacheCommands(pi);

  const loadAndRegister = async (
    cwd: string,
    isProjectTrusted: boolean,
  ): Promise<ApplicationConfig> => {
    const yamlConfig = loadPiProviderConfig({ cwd, isProjectTrusted });
    const baseConfig = createApplicationConfig(yamlConfig);
    const discoveredConfig = await discoverApplicationConfig(baseConfig);
    const appConfig = initApplicationConfig(yamlConfig, {
      models: discoveredConfig.models,
    });
    registerMlxProvider(pi, appConfig);
    await runCacheSweepOnStartup();
    return appConfig;
  };

  await loadAndRegister(process.cwd(), false);

  pi.on("session_start", async (_event, ctx) => {
    await loadAndRegister(ctx.cwd, ctx.isProjectTrusted());
  });
}
