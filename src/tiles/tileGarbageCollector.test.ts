import { describe, expect, it } from "vitest";
import { tileMetadataRepository } from "../storage/metadata/tileMetadataRepository";
import { FakeOpfs } from "../test/fakeOpfs";
import { collectTemporaryCache } from "./tileGarbageCollector";

describe("temporary cache garbage collection", () => {
  it("deletes oldest temporary tiles and never deletes pinned tiles", async () => {
    const storage = new FakeOpfs();
    const oldKey = "std/1/0/0" as const;
    const newKey = "std/1/1/0" as const;
    const pinnedKey = "std/1/0/1" as const;
    await tileMetadataRepository.put({
      key: oldKey,
      source: "std",
      z: 1,
      x: 0,
      y: 0,
      size: 4,
      contentType: "image/png",
      createdAt: 1,
      updatedAt: 1,
      lastAccessedAt: 1,
      lastCheckedAt: 1,
      pinned: false,
    });
    await tileMetadataRepository.put({
      key: newKey,
      source: "std",
      z: 1,
      x: 1,
      y: 0,
      size: 4,
      contentType: "image/png",
      createdAt: 1,
      updatedAt: 1,
      lastAccessedAt: 2,
      lastCheckedAt: 1,
      pinned: false,
    });
    await tileMetadataRepository.put({
      key: pinnedKey,
      source: "std",
      z: 1,
      x: 0,
      y: 1,
      size: 20,
      contentType: "image/png",
      createdAt: 1,
      updatedAt: 1,
      lastAccessedAt: 0,
      lastCheckedAt: 1,
      pinned: true,
    });
    await storage.write({ source: "std", z: 1, x: 0, y: 0 }, new Uint8Array([1, 2, 3, 4]).buffer);
    await storage.write({ source: "std", z: 1, x: 1, y: 0 }, new Uint8Array([1, 2, 3, 4]).buffer);
    await storage.write({ source: "std", z: 1, x: 0, y: 1 }, new Uint8Array(20).buffer);
    expect(await collectTemporaryCache(storage, 1, 5)).toBe(1);
    expect(await storage.exists({ source: "std", z: 1, x: 0, y: 0 })).toBe(false);
    expect(await storage.exists({ source: "std", z: 1, x: 1, y: 0 })).toBe(true);
    expect(await storage.exists({ source: "std", z: 1, x: 0, y: 1 })).toBe(true);
    expect((await tileMetadataRepository.get(pinnedKey))?.pinned).toBe(true);
  });
});
