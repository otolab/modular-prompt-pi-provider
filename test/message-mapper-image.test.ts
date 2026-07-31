import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectFilePathsFromText,
  createImageMaterializeScope,
  materializePiImageForMlx,
} from "../src/adapter/image-materializer.js";
import { piMessageToElements, contextHasImages } from "../src/adapter/message-mapper.js";

describe("collectFilePathsFromText", () => {
  it("extracts paths from Pi @file markers", () => {
    const text =
      '<file name="/tmp/a.jpeg"></file>\nWhat do you see?\n<file name="/tmp/b.png">hint</file>';
    expect(collectFilePathsFromText(text)).toEqual(["/tmp/a.jpeg", "/tmp/b.png"]);
  });
});

describe("createImageMaterializeScope", () => {
  it("deletes temp files on dispose", async () => {
    const scope = createImageMaterializeScope();
    const path = scope.materialize({
      type: "image",
      mimeType: "image/png",
      data: Buffer.from("hello").toString("base64"),
    });
    expect(existsSync(path)).toBe(true);

    await scope.dispose();
    expect(existsSync(path)).toBe(false);
  });

  it("dispose is safe when files are already deleted", async () => {
    const scope = createImageMaterializeScope();
    const path = scope.materialize({
      type: "image",
      mimeType: "image/png",
      data: Buffer.from("hello").toString("base64"),
    });
    unlinkSync(path);

    await expect(scope.dispose()).resolves.toBeUndefined();
    await expect(scope.dispose()).resolves.toBeUndefined();
  });

  it("does not delete reused @file paths", async () => {
    const scope = createImageMaterializeScope();
    const originalPath = import.meta.filename;
    const path = scope.materialize(
      { type: "image", mimeType: "image/png", data: "ignored" },
      originalPath,
    );
    expect(path).toBe(originalPath);

    await scope.dispose();
    expect(existsSync(originalPath)).toBe(true);
  });
});

describe("materializePiImageForMlx", () => {
  it("reuses an existing file path when provided", () => {
    const path = import.meta.filename;
    const result = materializePiImageForMlx(
      { type: "image", mimeType: "image/png", data: "abc" },
      path,
    );
    expect(result).toBe(path);
  });

  it("writes base64 image data to a temp file", () => {
    const data = Buffer.from("hello").toString("base64");
    const result = materializePiImageForMlx({
      type: "image",
      mimeType: "image/png",
      data,
    });
    expect(result.endsWith(".png")).toBe(true);
    expect(existsSync(result)).toBe(true);
    expect(readFileSync(result).toString()).toBe("hello");
    unlinkSync(result);
  });
});

describe("contextHasImages", () => {
  it("returns true when a user message includes an image block", () => {
    expect(
      contextHasImages([
        {
          role: "user",
          content: [
            { type: "text", text: "look" },
            { type: "image", mimeType: "image/png", data: "abc" },
          ],
          timestamp: 1,
        },
      ]),
    ).toBe(true);
  });

  it("returns false for text-only messages", () => {
    expect(
      contextHasImages([{ role: "user", content: "hello", timestamp: 1 }]),
    ).toBe(false);
  });
});

describe("piMessageToElements image mapping", () => {
  it("maps user image to MLX-compatible file path attachment", () => {
    const imagePath = import.meta.filename;
    const elements = piMessageToElements({
      role: "user",
      content: [
        { type: "text", text: `<file name="${imagePath}"></file>\nDescribe it.` },
        {
          type: "image",
          mimeType: "image/png",
          data: Buffer.from("ignored").toString("base64"),
        },
      ],
      timestamp: 1,
    });

    expect(elements).toEqual([
      {
        type: "message",
        role: "user",
        content: [
          { type: "text", text: `<file name="${imagePath}"></file>\nDescribe it.` },
          {
            type: "image_url",
            image_url: { url: imagePath },
          },
        ],
      },
    ]);
  });

  it("materializes image without @file path hint", () => {
    const elements = piMessageToElements({
      role: "user",
      content: [
        { type: "text", text: "What is this?" },
        {
          type: "image",
          mimeType: "image/jpeg",
          data: Buffer.from("jpeg-bytes").toString("base64"),
        },
      ],
      timestamp: 1,
    });

    const content = elements[0];
    expect(content?.type).toBe("message");
    if (content?.type !== "message" || content.role === "tool") {
      throw new Error("expected user message");
    }
    if (typeof content.content === "string") {
      throw new Error("expected attachment array");
    }

    const image = content.content.find((part) => part.type === "image_url");
    expect(image?.image_url?.url).toMatch(/\.jpg$/);
    expect(existsSync(image?.image_url?.url ?? "")).toBe(true);
    unlinkSync(image!.image_url!.url);
  });
});
