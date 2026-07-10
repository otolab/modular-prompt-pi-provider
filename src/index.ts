import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROVIDER_ID = "modular-prompt-mlx";
const API_ID = "modular-prompt-mlx";

/**
 * Pi extension entry: registers modular-prompt MLX as a custom LLM provider.
 *
 * TODO: streamSimple, model discovery, compaction prompts, message_end overflow rewrite
 */
export default async function (pi: ExtensionAPI): Promise<void> {
  pi.registerProvider(PROVIDER_ID, {
    name: "Modular Prompt MLX",
    api: API_ID,
    models: [],
    streamSimple: () => {
      throw new Error(
        `${PROVIDER_ID}: streamSimple not implemented yet (see otolab/modular-prompt-pi-provider)`,
      );
    },
  });
}
