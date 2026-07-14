import type { ApplicationConfig } from "@modular-prompt/driver";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API_ID, PROVIDER_API_KEY, PROVIDER_BASE_URL, PROVIDER_ID } from "./constants.js";
import { modelSpecToPiProviderModel } from "./driver/model-catalog.js";
import { initApplicationConfig } from "./driver/service.js";
import { loadPiProviderConfig } from "./pi-provider-config.js";
import { streamModularPromptMlx } from "./stream-simple.js";

function registerMlxProvider(pi: ExtensionAPI, appConfig: ApplicationConfig): void {
  const models = (appConfig.models ?? []).map(modelSpecToPiProviderModel);

  pi.registerProvider(PROVIDER_ID, {
    name: "Modular Prompt MLX",
    baseUrl: PROVIDER_BASE_URL,
    apiKey: PROVIDER_API_KEY,
    api: API_ID,
    models,
    streamSimple: streamModularPromptMlx,
  });
}

export default async function (pi: ExtensionAPI): Promise<void> {
  const loadAndRegister = (cwd: string, isProjectTrusted: boolean): ApplicationConfig => {
    const yamlConfig = loadPiProviderConfig({ cwd, isProjectTrusted });
    const appConfig = initApplicationConfig(yamlConfig);
    registerMlxProvider(pi, appConfig);
    return appConfig;
  };

  loadAndRegister(process.cwd(), false);

  pi.on("session_start", (_event, ctx) => {
    loadAndRegister(ctx.cwd, ctx.isProjectTrusted());
  });
}
