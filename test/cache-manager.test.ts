import { mkdir, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CachePolicy } from "../src/cache/cache-policy.js";
import { CacheManager, type CacheIndex } from "../src/cache/cache-manager.js";
import * as diskUsage from "../src/cache/disk-usage.js";

const TEST_POLICY: CachePolicy = {
  maxAgeDays: 7,
  maxSizeGb: 100,
  minFreeDiskGb: 0,
  sweepOnStartup: true,
  sweepBeforeWrite: true,
};

async function writeIndex(cacheDir: string, index: CacheIndex): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(
    join(cacheDir, "cache-index.json"),
    JSON.stringify(index, null, 2),
    "utf-8",
  );
}

async function writeEntry(
  cacheDir: string,
  key: string,
  sizeBytes: number,
): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${key}.safetensors`), Buffer.alloc(sizeBytes));
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe("CacheManager", () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), "mpp-cache-test-"));
    vi.spyOn(diskUsage, "getFreeDiskBytes").mockResolvedValue(Number.POSITIVE_INFINITY);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(cacheDir, { recursive: true, force: true });
  });

  it("show は空ディレクトリで 0 件", async () => {
    const manager = new CacheManager(cacheDir, TEST_POLICY);
    const result = await manager.show();
    expect(result.entryCount).toBe(0);
    expect(result.entries).toEqual([]);
  });

  it("hint release のエントリを削除する", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "release-me",
          model: "m1",
          hint: "release",
          createdAt: daysAgo(0),
        },
        {
          key: "keep-me",
          model: "m1",
          hint: "retain",
          createdAt: daysAgo(0),
        },
      ],
    });
    await writeEntry(cacheDir, "release-me", 100);
    await writeEntry(cacheDir, "keep-me", 200);

    const manager = new CacheManager(cacheDir, TEST_POLICY);
    const result = await manager.clean();

    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0]).toMatchObject({
      key: "release-me",
      reason: "released",
    });
    expect(result.kept).toBe(1);

    const index = await manager.loadIndex();
    expect(index.entries.map((e) => e.key)).toEqual(["keep-me"]);
  });

  it("maxAgeDays を超えたエントリを削除する", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "old",
          model: "m1",
          createdAt: daysAgo(10),
        },
        {
          key: "fresh",
          model: "m1",
          createdAt: daysAgo(1),
        },
      ],
    });
    await writeEntry(cacheDir, "old", 50);
    await writeEntry(cacheDir, "fresh", 50);

    const manager = new CacheManager(cacheDir, {
      ...TEST_POLICY,
      maxAgeDays: 7,
    });
    const result = await manager.clean();

    expect(result.deleted.map((d) => d.key)).toEqual(["old"]);
    expect(result.deleted[0]?.reason).toBe("age");
    expect(result.kept).toBe(1);
  });

  it("minFreeDiskGb 未満なら古いエントリから削除する", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "older",
          model: "m1",
          createdAt: daysAgo(2),
        },
        {
          key: "newer",
          model: "m1",
          createdAt: daysAgo(0),
        },
      ],
    });
    await writeEntry(cacheDir, "older", 2 * 1024 * 1024);
    await writeEntry(cacheDir, "newer", 2 * 1024 * 1024);

    vi.mocked(diskUsage.getFreeDiskBytes).mockResolvedValue(0);

    const manager = new CacheManager(cacheDir, {
      ...TEST_POLICY,
      maxSizeGb: 100,
      // 2 MiB 分の解放で閾値を満たす（0.002 GiB だと 2 件とも削除される）
      minFreeDiskGb: 0.00191,
    });
    const result = await manager.clean();

    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0]).toMatchObject({ key: "older", reason: "disk" });
    expect(result.kept).toBe(1);
  });

  it("maxSizeGb 超過時は古いエントリから削除する", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "older",
          model: "m1",
          createdAt: daysAgo(2),
        },
        {
          key: "newer",
          model: "m1",
          createdAt: daysAgo(0),
        },
      ],
    });
    await writeEntry(cacheDir, "older", 600 * 1024);
    await writeEntry(cacheDir, "newer", 600 * 1024);

    const manager = new CacheManager(cacheDir, {
      ...TEST_POLICY,
      maxSizeGb: 0.001,
    });
    const result = await manager.clean();

    expect(result.deleted.map((d) => d.key)).toContain("older");
    expect(result.deleted.some((d) => d.reason === "size")).toBe(true);
    expect(result.kept).toBe(1);
    const kept = (await manager.loadIndex()).entries[0]?.key;
    expect(kept).toBe("newer");
  });

  it("インデックス外の orphan .safetensors を削除する", async () => {
    await writeIndex(cacheDir, { version: 1, entries: [] });
    await writeEntry(cacheDir, "orphan-key", 128);

    const manager = new CacheManager(cacheDir, TEST_POLICY);
    const result = await manager.clean();

    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0]).toMatchObject({
      key: "orphan-key",
      reason: "orphan",
    });
  });

  it("dry-run ではファイルを削除しない", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "gone",
          model: "m1",
          hint: "release",
          createdAt: daysAgo(0),
        },
      ],
    });
    await writeEntry(cacheDir, "gone", 2 * 1024 * 1024);

    const manager = new CacheManager(cacheDir, TEST_POLICY);
    const result = await manager.clean({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.deleted).toHaveLength(1);
    expect(result.freedMb).toBeGreaterThan(0);

    const index = await manager.loadIndex();
    expect(index.entries).toHaveLength(1);
    expect(manager.entrySizeBytes("gone")).toBe(2 * 1024 * 1024);
  });

  it("show はインデックスとサイズを返す", async () => {
    await writeIndex(cacheDir, {
      version: 1,
      entries: [
        {
          key: "abc123",
          model: "test-model",
          createdAt: "2026-01-01T00:00:00.000Z",
          hint: "retain",
          elementHashes: ["h1", "h2"],
        },
      ],
    });
    await writeEntry(cacheDir, "abc123", 2 * 1024 * 1024);

    const manager = new CacheManager(cacheDir, TEST_POLICY);
    const result = await manager.show();

    expect(result.entryCount).toBe(1);
    expect(result.entries[0]).toMatchObject({
      key: "abc123",
      model: "test-model",
      elements: 2,
      hint: "retain",
    });
    expect(result.totalSizeMb).toBeGreaterThan(0);
  });
});
