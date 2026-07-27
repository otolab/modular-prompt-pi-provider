import type { AIDriver } from "@modular-prompt/driver";

export interface ThinkingMarker {
  start: string;
  end: string;
}

interface SpecialToken {
  text: string;
  id: number;
}

interface SpecialTokenPair {
  start: SpecialToken;
  end: SpecialToken;
}

function isSpecialTokenPair(value: unknown): value is SpecialTokenPair {
  if (!value || typeof value !== "object") {
    return false;
  }
  const pair = value as SpecialTokenPair;
  return typeof pair.start?.text === "string" && typeof pair.end?.text === "string";
}

function markerFromPair(value: unknown): ThinkingMarker | undefined {
  if (!isSpecialTokenPair(value)) {
    return undefined;
  }
  return { start: value.start.text, end: value.end.text };
}

/**
 * content-utils.ts（@modular-prompt/driver）と同系の既知フォールバック。
 * modular-prompt #301 で driver 公開 API に移行予定。
 */
export const KNOWN_THINKING_MARKERS: readonly ThinkingMarker[] = [
  // driver content-utils.ts と同系
  { start: "<redacted_thinking>", end: "</think>" },
  { start: "<|channel>thought", end: "<channel|>" },
];

function dedupeMarkers(markers: ThinkingMarker[]): ThinkingMarker[] {
  const seen = new Set<string>();
  const result: ThinkingMarker[] = [];
  for (const marker of markers) {
    const key = `${marker.start}\0${marker.end}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(marker);
  }
  return result;
}

/** getCapabilities().specialTokens と既知フォールバックからマーカー一覧を構築する。 */
export function resolveThinkingMarkers(
  specialTokens?: Record<string, unknown>,
): ThinkingMarker[] {
  const markers: ThinkingMarker[] = [];

  if (specialTokens) {
    for (const key of ["thinking", "reasoning"] as const) {
      const marker = markerFromPair(specialTokens[key]);
      if (marker) {
        markers.push(marker);
      }
    }
  }

  return dedupeMarkers([...markers, ...KNOWN_THINKING_MARKERS]);
}

interface DriverWithCapabilities {
  getCapabilities?: () => Promise<{ specialTokens?: Record<string, unknown> }>;
}

/** stream 開始時に driver から thinking マーカーを取得する。 */
export async function getDriverThinkingMarkers(driver: AIDriver): Promise<ThinkingMarker[]> {
  const probe = driver as DriverWithCapabilities;
  if (typeof probe.getCapabilities !== "function") {
    return resolveThinkingMarkers();
  }

  try {
    const caps = await probe.getCapabilities();
    return resolveThinkingMarkers(caps.specialTokens);
  } catch {
    return resolveThinkingMarkers();
  }
}
