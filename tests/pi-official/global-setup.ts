import { resetMlxProbeCache } from "../integration/support/get-mlx-probe.js";

export default function globalSetup() {
  resetMlxProbeCache();
}
