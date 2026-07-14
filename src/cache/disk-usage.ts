import { readdir, stat } from "node:fs/promises";
import { statfs } from "node:fs/promises";
import { join } from "node:path";

/** ディレクトリ内の `.safetensors` ファイル合計バイト数 */
export async function getSafetensorsSizeBytes(dir: string): Promise<number> {
  let total = 0;
  try {
    const names = await readdir(dir);
    for (const name of names) {
      if (!name.endsWith(".safetensors")) continue;
      const info = await stat(join(dir, name));
      if (info.isFile()) {
        total += info.size;
      }
    }
  } catch {
    return 0;
  }
  return total;
}

/** パスが載るファイルシステムの空き容量（バイト） */
export async function getFreeDiskBytes(path: string): Promise<number> {
  try {
    const info = await statfs(path);
    return info.bavail * info.bsize;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}

export function bytesToGb(bytes: number): number {
  return Math.round((bytes / 1024 ** 3) * 100) / 100;
}
