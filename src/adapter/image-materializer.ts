import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ImageContent } from "@earendil-works/pi-ai";

const TEMP_DIR = join(tmpdir(), "modular-prompt-pi-provider-images");

const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/** Pi `@file` 展開で付く `<file name="...">` からパスを抽出する */
export function collectFilePathsFromText(text: string): string[] {
  const paths: string[] = [];
  const re = /<file name="([^"]+)">/g;
  for (const match of text.matchAll(re)) {
    paths.push(match[1]);
  }
  return paths;
}

export interface ImageMaterializeScope {
  materialize(image: ImageContent, preferredPath?: string): string;
  /** このスコープで作成した一時ファイルを安全に削除する（冪等） */
  dispose(): Promise<void>;
}

function writeTempImageFile(image: ImageContent): string {
  const ext = MIME_EXT[image.mimeType] ?? ".bin";
  mkdirSync(TEMP_DIR, { recursive: true });
  const filePath = join(TEMP_DIR, `${randomBytes(8).toString("hex")}${ext}`);
  writeFileSync(filePath, Buffer.from(image.data, "base64"));
  return filePath;
}

function resolveImagePath(image: ImageContent, preferredPath?: string): string {
  if (preferredPath && existsSync(preferredPath)) {
    return preferredPath;
  }
  return writeTempImageFile(image);
}

/** リクエスト単位で一時画像パスを追跡し、処理後にまとめて削除する */
export function createImageMaterializeScope(): ImageMaterializeScope {
  const created: string[] = [];

  return {
    materialize(image, preferredPath) {
      const path = resolveImagePath(image, preferredPath);
      if (!preferredPath || !existsSync(preferredPath)) {
        created.push(path);
      }
      return path;
    },
    async dispose() {
      for (const path of created.splice(0)) {
        safeUnlink(path);
      }
    },
  };
}

function safeUnlink(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (isEnoent(error)) {
      return;
    }
    console.warn(
      `[image-materializer] failed to delete temp image ${path}:`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * テスト用。スコープなしで 1 枚 materialize する（呼び出し側で削除すること）。
 * MLX driver の Python 側は `Image.open(path)` でファイルパスのみ受け付ける。
 */
export function materializePiImageForMlx(
  image: ImageContent,
  preferredPath?: string,
): string {
  return resolveImagePath(image, preferredPath);
}
