import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API_ID, PROVIDER_ID } from "./constants.js";
import { modelSpecToPiProviderModel } from "./driver/model-catalog.js";
import { getApplicationConfig } from "./driver/service.js";
import { streamModularPromptMlx } from "./stream-simple.js";

export default async function (pi: ExtensionAPI): Promise<void> {
  const appConfig = getApplicationConfig();
  const models = (appConfig.models ?? []).map(modelSpecToPiProviderModel);

  pi.registerProvider(PROVIDER_ID, {
    name: "Modular Prompt MLX",
    api: API_ID,
    models,
    streamSimple: streamModularPromptMlx,
  });
}
