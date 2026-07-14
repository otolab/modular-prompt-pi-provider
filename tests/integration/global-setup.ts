import { resetMlxProbeCache } from "./support/get-mlx-probe.js";

export default function globalSetup() {
  resetMlxProbeCache();
}
