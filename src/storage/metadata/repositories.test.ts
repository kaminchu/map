import { describe, expect, it } from "vitest";
import { offlineAreaRepository } from "./offlineAreaRepository";
import { tileMetadataRepository } from "./tileMetadataRepository";
import type { OfflineArea, TileMetadata } from "./database";

const key = "std/1/0/0" as const;
const metadata: TileMetadata = {
  key,
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
};
function area(id: string): OfflineArea {
  return {
    id,
    name: id,
    bounds: { west: 0, south: 0, east: 1, north: 1 },
    minZoom: 1,
    maxZoom: 1,
    tileSource: "std",
    tileCount: 1,
    downloadedTileCount: 1,
    createdAt: 1,
    updatedAt: 1,
    status: "completed",
  };
}

describe("IndexedDB repositories", () => {
  it("keeps a shared tile pinned until its last area reference is removed", async () => {
    await tileMetadataRepository.put(metadata);
    await offlineAreaRepository.create(area("area-a"), [key], new Set([key]));
    await offlineAreaRepository.create(area("area-b"), [key], new Set([key]));
    expect((await offlineAreaRepository.list()).length).toBe(2);
    expect((await tileMetadataRepository.get(key))?.pinned).toBe(true);
    await offlineAreaRepository.delete("area-a");
    expect((await tileMetadataRepository.get(key))?.pinned).toBe(true);
    await offlineAreaRepository.delete("area-b");
    expect((await tileMetadataRepository.get(key))?.pinned).toBe(false);
  });
});
