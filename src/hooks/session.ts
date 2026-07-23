import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeAllDrivers } from "../driver/pool.js";

export interface SessionHooksOptions {
  /** session_start で config 再読込・プロバイダ再登録などを行う */
  onSessionStart?: (cwd: string, isProjectTrusted: boolean) => Promise<void>;
}

export function registerSessionHooks(
  pi: ExtensionAPI,
  options: SessionHooksOptions = {},
): void {
  if (options.onSessionStart) {
    const onSessionStart = options.onSessionStart;
    pi.on("session_start", async (_event, ctx) => {
      await onSessionStart(ctx.cwd, ctx.isProjectTrusted());
    });
  }

  pi.on("session_shutdown", async () => {
    await closeAllDrivers();
  });
}
