import { opfsTileStorage } from "../../storage/opfs/opfsTileStorage";
import { tileMetadataRepository } from "../../storage/metadata/tileMetadataRepository";
import { offlineAreaRepository } from "../../storage/metadata/offlineAreaRepository";
import { enumerateTilesForBounds, type GeoBounds } from "../../tiles/tileMath";
import { createTileKey } from "../../tiles/tileKey";
import type { OfflineArea } from "../../storage/metadata/database";
import type { TileKey } from "../../tiles/types";

export function defaultAreaName(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `オフライン地図 ${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function areaTileKeys(bounds: GeoBounds, minZoom: number, maxZoom: number): TileKey[] {
  return enumerateTilesForBounds(bounds, minZoom, maxZoom).map(createTileKey);
}

export async function createOfflineArea(input: {
  id: string;
  name: string;
  bounds: GeoBounds;
  minZoom: number;
  maxZoom: number;
  estimatedBytes?: number;
}): Promise<OfflineArea> {
  if (!opfsTileStorage.isSupported()) throw new Error("OPFS unsupported");
  const tileKeys = areaTileKeys(input.bounds, input.minZoom, input.maxZoom);
  const completeKeys = new Set<TileKey>();
  for (const key of tileKeys) {
    const metadata = await tileMetadataRepository.get(key);
    const tile = {
      source: "std" as const,
      z: metadata?.z ?? 0,
      x: metadata?.x ?? 0,
      y: metadata?.y ?? 0,
    };
    if (metadata && (await opfsTileStorage.exists(tile))) completeKeys.add(key);
  }
  const now = Date.now();
  const area: OfflineArea = {
    id: input.id,
    name: input.name.trim(),
    bounds: input.bounds,
    minZoom: input.minZoom,
    maxZoom: input.maxZoom,
    tileSource: "std",
    tileCount: tileKeys.length,
    downloadedTileCount: completeKeys.size,
    ...(input.estimatedBytes === undefined ? {} : { estimatedBytes: input.estimatedBytes }),
    createdAt: now,
    updatedAt: now,
    status: completeKeys.size === tileKeys.length ? "completed" : "pending",
  };
  await offlineAreaRepository.create(area, tileKeys, completeKeys);
  return area;
}

export async function existingCompleteKeys(tileKeys: TileKey[]): Promise<Set<TileKey>> {
  const complete = new Set<TileKey>();
  for (const key of tileKeys) {
    const metadata = await tileMetadataRepository.get(key);
    if (
      metadata &&
      (await opfsTileStorage.exists({
        source: metadata.source,
        z: metadata.z,
        x: metadata.x,
        y: metadata.y,
      }))
    )
      complete.add(key);
  }
  return complete;
}

export { offlineAreaRepository };
