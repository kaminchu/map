import { parseTileMetadata } from "../../schemas/tileMetadataSchema";
import { parseTileKey } from "../../tiles/tileKey";
import type { TileKey } from "../../tiles/types";
import { openDatabase, requestResult, withTransaction, type TileMetadata } from "./database";

export interface TileStatistics {
  pinnedCount: number;
  pinnedBytes: number;
  temporaryCount: number;
  temporaryBytes: number;
}

export const tileMetadataRepository = {
  async get(key: TileKey): Promise<TileMetadata | undefined> {
    return withTransaction("tiles", "readwrite", async (tx) => {
      const value = await requestResult(tx.objectStore("tiles").get(key));
      const metadata = parseTileMetadata(value);
      if (!metadata && value !== undefined)
        await requestResult(tx.objectStore("tiles").delete(key));
      return metadata;
    });
  },
  async put(metadata: TileMetadata): Promise<void> {
    await withTransaction("tiles", "readwrite", (tx) => {
      tx.objectStore("tiles").put(metadata);
    });
  },
  async delete(key: TileKey): Promise<void> {
    await withTransaction("tiles", "readwrite", (tx) => {
      tx.objectStore("tiles").delete(key);
    });
  },
  async touch(entries: Map<TileKey, number>): Promise<void> {
    if (entries.size === 0) return;
    await withTransaction("tiles", "readwrite", async (tx) => {
      const store = tx.objectStore("tiles");
      for (const [key, timestamp] of entries) {
        const current = parseTileMetadata(await requestResult(store.get(key)));
        if (current)
          store.put({ ...current, lastAccessedAt: Math.max(current.lastAccessedAt, timestamp) });
      }
    });
  },
  async gcCandidates(): Promise<TileMetadata[]> {
    const db = await openDatabase();
    const tx = db.transaction("tiles", "readonly");
    const index = tx.objectStore("tiles").index("byLastAccessed");
    const result: TileMetadata[] = [];
    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        const metadata = parseTileMetadata(cursor.value);
        if (metadata && !metadata.pinned) result.push(metadata);
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error("IndexedDB cursor failed"));
    });
    return result;
  },
  async statistics(): Promise<TileStatistics> {
    const candidates = await this.all();
    return candidates.reduce<TileStatistics>(
      (stats, metadata) => {
        if (metadata.pinned) {
          stats.pinnedCount += 1;
          stats.pinnedBytes += metadata.size;
        } else {
          stats.temporaryCount += 1;
          stats.temporaryBytes += metadata.size;
        }
        return stats;
      },
      { pinnedCount: 0, pinnedBytes: 0, temporaryCount: 0, temporaryBytes: 0 },
    );
  },
  async hasAreaReference(key: TileKey): Promise<boolean> {
    const db = await openDatabase();
    const tx = db.transaction("offlineAreaTiles", "readonly");
    const count = await requestResult(
      tx.objectStore("offlineAreaTiles").index("byTileKey").count(key),
    );
    return count > 0;
  },
  async all(): Promise<TileMetadata[]> {
    const db = await openDatabase();
    const tx = db.transaction("tiles", "readonly");
    const values = await requestResult(tx.objectStore("tiles").getAll());
    return values.flatMap((value) => {
      const parsed = parseTileMetadata(value);
      return parsed ? [parsed] : [];
    });
  },
};

export async function updatePinnedForReference(tx: IDBTransaction, key: TileKey): Promise<void> {
  const tileStore = tx.objectStore("tiles");
  const metadata = parseTileMetadata(await requestResult(tileStore.get(key)));
  if (metadata) tileStore.put({ ...metadata, pinned: true });
}

export function metadataForTile(
  key: TileKey,
  size: number,
  contentType: string,
  now: number,
  pinned = false,
): TileMetadata {
  const tile = parseTileKey(key);
  return {
    key,
    source: tile.source,
    z: tile.z,
    x: tile.x,
    y: tile.y,
    size,
    contentType,
    createdAt: now,
    updatedAt: now,
    lastAccessedAt: now,
    lastCheckedAt: now,
    pinned,
  };
}
