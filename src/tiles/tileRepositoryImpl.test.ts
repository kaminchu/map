import { describe, expect, it, vi } from "vitest";
import type { TileMetadata } from "../storage/metadata/database";
import { FakeOpfs } from "../test/fakeOpfs";
import { createTileRepository, TILE_REVALIDATE_INTERVAL_MS } from "./tileRepositoryImpl";
import type { TileKey } from "./types";

function fakeMetadata() {
  const values = new Map<TileKey, TileMetadata>();
  return {
    values,
    get: async (key: TileKey) => values.get(key),
    put: async (value: TileMetadata) => {
      values.set(value.key, value);
    },
    delete: async (key: TileKey) => {
      values.delete(key);
    },
    touch: async () => undefined,
    hasAreaReference: async () => false,
  };
}
const tile = { source: "std" as const, z: 1, x: 0, y: 0 };
const data = new Uint8Array([1, 2, 3]).buffer;

describe("local first tile repository", () => {
  it("returns a local hit without fetching", async () => {
    const storage = new FakeOpfs();
    const metadata = fakeMetadata();
    await storage.write(tile, data);
    metadata.values.set("std/1/0/0", {
      key: "std/1/0/0",
      source: "std",
      z: 1,
      x: 0,
      y: 0,
      size: 3,
      contentType: "image/png",
      createdAt: 1,
      updatedAt: 1,
      lastAccessedAt: 1,
      lastCheckedAt: 1,
      pinned: false,
    });
    const fetchTile = vi.fn();
    const repository = createTileRepository({
      storage,
      metadata,
      isOnline: () => true,
      fetchTile,
      now: () => 10,
    });
    await expect(repository.getTile({ ...tile, priority: "visible" })).resolves.toMatchObject({
      source: "local",
      data,
    });
    expect(fetchTile).not.toHaveBeenCalled();
  });
  it("falls back online and persists the validated body", async () => {
    const storage = new FakeOpfs();
    const metadata = fakeMetadata();
    const fetchTile = vi.fn().mockResolvedValue({ status: 200, data, contentType: "image/png" });
    const repository = createTileRepository({
      storage,
      metadata,
      isOnline: () => true,
      fetchTile,
      now: () => 10,
    });
    await expect(repository.getTile({ ...tile, priority: "visible" })).resolves.toMatchObject({
      source: "network",
      data,
    });
    expect(fetchTile).toHaveBeenCalledTimes(1);
    expect(await storage.exists(tile)).toBe(true);
    expect(metadata.values.get("std/1/0/0")?.pinned).toBe(false);
  });
  it("does not fetch an offline miss", async () => {
    const fetchTile = vi.fn();
    const repository = createTileRepository({
      storage: new FakeOpfs(),
      metadata: fakeMetadata(),
      isOnline: () => false,
      fetchTile,
    });
    await expect(repository.getTile({ ...tile, priority: "visible" })).rejects.toMatchObject({
      reason: "offline-miss",
    });
    expect(fetchTile).not.toHaveBeenCalled();
  });
  it("deduplicates simultaneous requests and keeps one consumer alive", async () => {
    const storage = new FakeOpfs();
    const metadata = fakeMetadata();
    let resolve!: (value: { status: 200; data: ArrayBuffer; contentType: string }) => void;
    const fetchTile = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const repository = createTileRepository({ storage, metadata, isOnline: () => true, fetchTile });
    const controller = new AbortController();
    const first = repository.getTile({ ...tile, priority: "visible", signal: controller.signal });
    const second = repository.getTile({ ...tile, priority: "visible" });
    controller.abort();
    resolve({ status: 200, data, contentType: "image/png" });
    await expect(first).rejects.toHaveProperty("name", "AbortError");
    await expect(second).resolves.toMatchObject({ source: "network" });
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });
  it("starts stale local revalidation without delaying the hit", async () => {
    const storage = new FakeOpfs();
    const metadata = fakeMetadata();
    await storage.write(tile, data);
    metadata.values.set("std/1/0/0", {
      key: "std/1/0/0",
      source: "std",
      z: 1,
      x: 0,
      y: 0,
      size: 3,
      contentType: "image/png",
      createdAt: 1,
      updatedAt: 1,
      lastAccessedAt: 1,
      lastCheckedAt: 10 - TILE_REVALIDATE_INTERVAL_MS,
      pinned: false,
    });
    const fetchTile = vi.fn().mockResolvedValue({ status: 304 });
    const repository = createTileRepository({
      storage,
      metadata,
      isOnline: () => true,
      fetchTile,
      now: () => 10,
    });
    await repository.getTile({ ...tile, priority: "visible" });
    await vi.waitFor(() => expect(fetchTile).toHaveBeenCalledTimes(1));
  });
});
