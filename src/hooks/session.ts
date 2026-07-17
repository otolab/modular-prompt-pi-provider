import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { closeAllDrivers } from "../driver/pool.js";

export function registerSessionHooks(pi: ExtensionAPI): void {
  pi.on("session_shutdown", async () => {
    await closeAllDrivers();
  });
}
