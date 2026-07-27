import { registerApiProvider, unregisterApiProviders } from "@earendil-works/pi-ai/compat";
import { streamModularPrompt } from "../../../src/stream-simple.js";
import { API_ID } from "../../../src/constants.js";

/** vitest セッション内で registerApiProvider の出所を識別する */
export const PI_OFFICIAL_PROVIDER_SOURCE = "modular-prompt-pi-official-tests";

/**
 * Pi 公式 provider テスト用に compat の api-registry へ本拡張を登録する。
 * `complete()` / `stream()` が `model.api === API_ID` のとき streamModularPrompt に到達する。
 */
export function installModularPromptApiProvider(): void {
  registerApiProvider(
    {
      api: API_ID,
      stream: streamModularPrompt,
      streamSimple: streamModularPrompt,
    },
    PI_OFFICIAL_PROVIDER_SOURCE,
  );
}

export function uninstallModularPromptApiProvider(): void {
  unregisterApiProviders(PI_OFFICIAL_PROVIDER_SOURCE);
}
