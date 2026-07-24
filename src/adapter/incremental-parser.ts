import type { ThinkingMarker } from "./thinking-markers.js";

export type ParserSegment =
  | { kind: "text"; delta: string }
  | { kind: "thinking"; delta: string }
  | { kind: "thinking_end" };

interface StartMatch {
  index: number;
  marker: ThinkingMarker;
}

function findEarliestStart(text: string, markers: ThinkingMarker[]): StartMatch | undefined {
  let best: StartMatch | undefined;

  for (const marker of markers) {
    const index = text.indexOf(marker.start);
    if (index < 0) {
      continue;
    }
    if (!best || index < best.index) {
      best = { index, marker };
    }
  }

  return best;
}

function longestPartialPrefix(text: string, candidates: string[]): number {
  let hold = 0;

  for (const candidate of candidates) {
    const max = Math.min(text.length, candidate.length - 1);
    for (let len = max; len > 0; len--) {
      if (candidate.startsWith(text.slice(-len))) {
        hold = Math.max(hold, len);
        break;
      }
    }
  }

  return hold;
}

function splitWithPartialSuffix(text: string, candidates: string[]): { safe: string; hold: string } {
  const holdLen = longestPartialPrefix(text, candidates);
  if (holdLen === 0) {
    return { safe: text, hold: "" };
  }
  return {
    safe: text.slice(0, -holdLen),
    hold: text.slice(-holdLen),
  };
}

/**
 * MLX 生ストリームから thinking タグを分離する増分パーサ。
 * @see docs/streaming.md
 */
export class IncrementalThinkingParser {
  private state: "outside" | "inside" = "outside";
  private activeMarker: ThinkingMarker | null = null;
  private pending = "";

  constructor(private readonly markers: ThinkingMarker[]) {}

  feed(chunk: string): ParserSegment[] {
    if (!chunk) {
      return [];
    }

    this.pending += chunk;
    const segments: ParserSegment[] = [];

    while (this.pending.length > 0) {
      if (this.state === "outside") {
        const start = findEarliestStart(this.pending, this.markers);
        if (start) {
          if (start.index > 0) {
            segments.push({ kind: "text", delta: this.pending.slice(0, start.index) });
          }
          this.pending = this.pending.slice(start.index + start.marker.start.length);
          this.state = "inside";
          this.activeMarker = start.marker;
          continue;
        }

        const { safe, hold } = splitWithPartialSuffix(
          this.pending,
          this.markers.map((marker) => marker.start),
        );
        if (safe) {
          segments.push({ kind: "text", delta: safe });
        }
        this.pending = hold;
        break;
      }

      const endTag = this.activeMarker!.end;
      const endIndex = this.pending.indexOf(endTag);
      if (endIndex >= 0) {
        if (endIndex > 0) {
          segments.push({ kind: "thinking", delta: this.pending.slice(0, endIndex) });
        }
        this.pending = this.pending.slice(endIndex + endTag.length);
        segments.push({ kind: "thinking_end" });
        this.state = "outside";
        this.activeMarker = null;
        continue;
      }

      const { safe, hold } = splitWithPartialSuffix(this.pending, [endTag]);
      if (safe) {
        segments.push({ kind: "thinking", delta: safe });
      }
      this.pending = hold;
      break;
    }

    return segments;
  }

  /** ストリーム終了時の残りバッファを吐き出す。 */
  flush(): ParserSegment[] {
    if (!this.pending) {
      return [];
    }

    const segments: ParserSegment[] = [];
    if (this.state === "inside") {
      segments.push({ kind: "thinking", delta: this.pending });
      segments.push({ kind: "thinking_end" });
    } else {
      segments.push({ kind: "text", delta: this.pending });
    }

    this.pending = "";
    this.state = "outside";
    this.activeMarker = null;
    return segments;
  }
}
