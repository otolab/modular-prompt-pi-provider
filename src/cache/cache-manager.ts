import { existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lock } from "proper-lockfile";
import type { CachePolicy } from "./cache-policy.js";
import {
  bytesToGb,
  bytesToMb,
  getFreeDiskBytes,
  getSafetensorsSizeBytes,
} from "./disk-usage.js";

export interface CacheIndexEntry {
  key: string;
  model?: string;
  hint?: "release" | "retain";
  createdAt?: string;
  elementHashes?: string[];
  formatterOptionsHash?: string;
  toolsHash?: string;
  reasoningEffort?: string;
}

export interface CacheIndex {
  version: 1;
  entries: CacheIndexEntry[];
}

export interface CacheEntryInfo {
  key: string;
  model: string;
  createdAt: string;
  sizeMb: number;
  hint: string;
  elements: number;
}

export interface CacheShowResult {
  cacheDir: string;
  entryCount: number;
  totalSizeMb: number;
  totalSizeGb: number;
  entries: CacheEntryInfo[];
}

export interface CacheDeletion {
  key: string;
  model: string;
  sizeMb: number;
  reason: "released" | "age" | "size" | "disk" | "orphan";
}

export interface CacheCleanResult {
  cacheDir: string;
  deleted: CacheDeletion[];
  kept: number;
  freedMb: number;
  dryRun: boolean;
}

const INDEX_FILENAME = "cache-index.json";

function emptyIndex(): CacheIndex {
  return { version: 1, entries: [] };
}

function parseCreatedAt(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms);
}

function compareOldestFirst(a: CacheIndexEntry, b: CacheIndexEntry): number {
  const aTime = parseCreatedAt(a.createdAt)?.getTime() ?? 0;
  const bTime = parseCreatedAt(b.createdAt)?.getTime() ?? 0;
  return aTime - bTime;
}

function compareNewestFirst(a: CacheIndexEntry, b: CacheIndexEntry): number {
  return -compareOldestFirst(a, b);
}

async function withIndexLock<T>(
  cacheDir: string,
  indexPath: string,
  fn: () => Promise<T>,
): Promise<T> {
  await mkdir(cacheDir, { recursive: true });
  if (!existsSync(indexPath)) {
    await writeFile(indexPath, JSON.stringify(emptyIndex(), null, 2), "utf-8");
  }

  const release = await lock(indexPath, {
    realpath: false,
    retries: { retries: 3, minTimeout: 200, maxTimeout: 1000 },
  });
  try {
    return await fn();
  } finally {
    await release();
  }
}

export class CacheManager {
  constructor(
    private readonly cacheDir: string,
    private readonly policy: CachePolicy,
  ) {}

  get indexPath(): string {
    return join(this.cacheDir, INDEX_FILENAME);
  }

  async loadIndex(): Promise<CacheIndex> {
    if (!existsSync(this.indexPath)) {
      return emptyIndex();
    }

    return withIndexLock(this.cacheDir, this.indexPath, async () => {
      try {
        const raw = await readFile(this.indexPath, "utf-8");
        const parsed = JSON.parse(raw) as Partial<CacheIndex>;
        if (parsed.version === 1 && Array.isArray(parsed.entries)) {
          return parsed as CacheIndex;
        }
      } catch {
        // corrupt index
      }
      return emptyIndex();
    });
  }

  async saveIndex(index: CacheIndex): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true });
    await withIndexLock(this.cacheDir, this.indexPath, async () => {
      await writeFile(this.indexPath, JSON.stringify(index, null, 2), "utf-8");
    });
  }

  entrySizeBytes(key: string): number {
    try {
      const path = this.entryPath(key);
      if (!existsSync(path)) return 0;
      return statSync(path).size;
    } catch {
      return 0;
    }
  }

  private entryPath(key: string): string {
    return join(this.cacheDir, `${key}.safetensors`);
  }

  private async deleteEntryFiles(key: string): Promise<number> {
    let freed = 0;
    const candidates = [
      join(this.cacheDir, `${key}.safetensors`),
      join(this.cacheDir, `${key}.safetensors.meta.json`),
    ];
    for (const path of candidates) {
      try {
        if (existsSync(path)) {
          const size = statSync(path).size;
          await unlink(path);
          freed += size;
        }
      } catch {
        // best-effort
      }
    }
    return freed;
  }

  async show(): Promise<CacheShowResult> {
    if (!existsSync(this.cacheDir)) {
      return {
        cacheDir: this.cacheDir,
        entryCount: 0,
        totalSizeMb: 0,
        totalSizeGb: 0,
        entries: [],
      };
    }

    const index = await this.loadIndex();
    let totalSize = 0;
    const entries: CacheEntryInfo[] = [];

    for (const entry of index.entries) {
      const size = this.entrySizeBytes(entry.key);
      totalSize += size;
      entries.push({
        key: entry.key,
        model: entry.model ?? "unknown",
        createdAt: entry.createdAt ?? "unknown",
        sizeMb: bytesToMb(size),
        hint: entry.hint ?? "retain",
        elements: entry.elementHashes?.length ?? 0,
      });
    }

    return {
      cacheDir: this.cacheDir,
      entryCount: entries.length,
      totalSizeMb: bytesToMb(totalSize),
      totalSizeGb: bytesToGb(totalSize),
      entries,
    };
  }

  async clean(options?: { dryRun?: boolean }): Promise<CacheCleanResult> {
    const dryRun = options?.dryRun ?? false;
    const result: CacheCleanResult = {
      cacheDir: this.cacheDir,
      deleted: [],
      kept: 0,
      freedMb: 0,
      dryRun,
    };

    if (!existsSync(this.cacheDir)) {
      return result;
    }

    const index = await this.loadIndex();
    const now = Date.now();
    const toDelete: Array<{ entry: CacheIndexEntry; reason: CacheDeletion["reason"] }> =
      [];
    const candidates: CacheIndexEntry[] = [];

    for (const entry of index.entries) {
      if (entry.hint === "release") {
        toDelete.push({ entry, reason: "released" });
        continue;
      }

      const created = parseCreatedAt(entry.createdAt);
      if (created) {
        const ageDays = (now - created.getTime()) / 86_400_000;
        if (ageDays > this.policy.maxAgeDays) {
          toDelete.push({ entry, reason: "age" });
          continue;
        }
      }

      candidates.push(entry);
    }

    candidates.sort(compareNewestFirst);

    const maxSizeBytes = this.policy.maxSizeGb * 1024 ** 3;
    let runningSize = 0;
    const afterSizeQuota: CacheIndexEntry[] = [];

    for (const entry of candidates) {
      const size = this.entrySizeBytes(entry.key);
      if (runningSize + size > maxSizeBytes) {
        toDelete.push({ entry, reason: "size" });
      } else {
        runningSize += size;
        afterSizeQuota.push(entry);
      }
    }

    let freeBytes = await getFreeDiskBytes(this.cacheDir);
    const minFreeBytes = this.policy.minFreeDiskGb * 1024 ** 3;
    const diskEviction = [...afterSizeQuota].sort(compareOldestFirst);

    while (freeBytes < minFreeBytes && diskEviction.length > 0) {
      const entry = diskEviction.shift()!;
      const idx = afterSizeQuota.findIndex((e) => e.key === entry.key);
      if (idx >= 0) {
        afterSizeQuota.splice(idx, 1);
      }
      toDelete.push({ entry, reason: "disk" });
      freeBytes += this.entrySizeBytes(entry.key);
    }

    const indexedKeys = new Set(index.entries.map((e) => e.key));
    const orphanKeys: string[] = [];
    try {
      for (const name of await readdir(this.cacheDir)) {
        if (!name.endsWith(".safetensors")) continue;
        const key = name.slice(0, -".safetensors".length);
        if (!indexedKeys.has(key)) {
          orphanKeys.push(key);
        }
      }
    } catch {
      // ignore
    }

    let freedBytes = 0;
    const deletedKeys = new Set<string>();

    for (const { entry, reason } of toDelete) {
      if (deletedKeys.has(entry.key)) continue;
      deletedKeys.add(entry.key);
      const size = this.entrySizeBytes(entry.key);
      result.deleted.push({
        key: entry.key,
        model: entry.model ?? "unknown",
        sizeMb: bytesToMb(size),
        reason,
      });
      if (dryRun) {
        freedBytes += size;
      } else {
        freedBytes += await this.deleteEntryFiles(entry.key);
      }
    }

    for (const key of orphanKeys) {
      if (deletedKeys.has(key)) continue;
      deletedKeys.add(key);
      const size = this.entrySizeBytes(key);
      result.deleted.push({
        key,
        model: "orphan",
        sizeMb: bytesToMb(size),
        reason: "orphan",
      });
      if (dryRun) {
        freedBytes += size;
      } else {
        freedBytes += await this.deleteEntryFiles(key);
      }
    }

    const finalKeep = afterSizeQuota.filter((e) => !deletedKeys.has(e.key));
    result.kept = finalKeep.length;
    result.freedMb = bytesToMb(freedBytes);

    if (!dryRun && (toDelete.length > 0 || orphanKeys.length > 0)) {
      index.entries = finalKeep;
      await this.saveIndex(index);
    }

    return result;
  }
}
