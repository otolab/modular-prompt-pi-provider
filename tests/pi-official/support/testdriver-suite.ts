import { afterAll, beforeAll } from "vitest";
import {
  installModularPromptApiProvider,
  uninstallModularPromptApiProvider,
} from "./register-provider.js";

/** TestDriver 層: compat 登録の beforeAll / afterAll */
export function installOfficialProviderRegistry(): void {
  beforeAll(() => {
    installModularPromptApiProvider();
  });

  afterAll(() => {
    uninstallModularPromptApiProvider();
  });
}
