import { vi } from "vitest";

vi.mock("../../../src/driver/pool.js", () => ({
  getDriverForLogicalModel: vi.fn(),
  getDriverForModel: vi.fn(),
  closeAllDrivers: vi.fn(),
  closeActiveDriver: vi.fn(),
}));

vi.mock("../../../src/driver/service.js", async () => {
  const actual = await vi.importActual<typeof import("../../../src/driver/service.js")>(
    "../../../src/driver/service.js",
  );
  return {
    ...actual,
    getResolvedProviderConfig: vi.fn(),
    initApplicationConfig: vi.fn(),
    initResolvedProviderConfig: vi.fn(),
    getAIService: vi.fn(),
    resetAIService: vi.fn(),
  };
});
