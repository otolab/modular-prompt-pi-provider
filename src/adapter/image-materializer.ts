import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

/**
 * MLX driver の Python 側は `Image.open(path)` でファイルパスのみ受け付ける。
 * Pi の base64 画像を一時ファイルへ書き出すか、既知の実ファイルパスをそのまま使う。
 */
export function materializePiImageForMlx(
  image: ImageContent,
  preferredPath?: string,
): string {
  if (preferredPath && existsSync(preferredPath)) {
    return preferredPath;
  }

  const ext = MIME_EXT[image.mimeType] ?? ".bin";
  mkdirSync(TEMP_DIR, { recursive: true });
  const filePath = join(TEMP_DIR, `${randomBytes(8).toString("hex")}${ext}`);
  writeFileSync(filePath, Buffer.from(image.data, "base64"));
  return filePath;
}
