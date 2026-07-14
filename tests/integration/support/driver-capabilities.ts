import type { DriverCapability } from "@modular-prompt/driver";

/** integration テスト用 ModelSpec.capabilities（config.ts と同等） */
export const INTEGRATION_DRIVER_CAPABILITIES: DriverCapability[] = [
  "streaming",
  "local",
  "multilingual",
  "japanese",
  "chat",
  "tools",
  "reasoning",
  "function-calling",
];
