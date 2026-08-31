import { collectTemporaryCache } from "../../tiles/tileGarbageCollector";
import { opfsTileStorage } from "../../storage/opfs/opfsTileStorage";
import {
  getPersistentStorageStatus,
  getStorageEstimate,
  type PersistentStorageStatus,
  type StorageEstimate,
  requestPersistentStorage,
} from "../../storage/persistentStorage";
import {
  tileMetadataRepository,
  type TileStatistics,
} from "../../storage/metadata/tileMetadataRepository";
import { tileKeyLock } from "../../tiles/tileCache";

export interface StorageStatistics extends TileStatistics {
  totalBytes: number;
  estimate: StorageEstimate;
  persistence: PersistentStorageStatus;
}

export function isTilePersistenceSupported(): boolean {
  return opfsTileStorage.isSupported();
}

export async function getStorageStatistics(): Promise<StorageStatistics> {
  const [stats, estimate, persistence] = await Promise.all([
    tileMetadataRepository.statistics(),
    getStorageEstimate(),
    getPersistentStorageStatus(),
  ]);
  return { ...stats, totalBytes: stats.pinnedBytes + stats.temporaryBytes, estimate, persistence };
}

export async function clearTemporaryCache(): Promise<number> {
  let removed = 0;
  for (const metadata of await tileMetadataRepository.gcCandidates()) {
    await tileKeyLock.run(metadata.key, async () => {
      const current = await tileMetadataRepository.get(metadata.key);
      if (!current || current.pinned) return;
      await opfsTileStorage.delete({
        source: current.source,
        z: current.z,
        x: current.x,
        y: current.y,
      });
      await tileMetadataRepository.delete(current.key);
      removed += 1;
    });
  }
  return removed;
}

export { getStorageEstimate, requestPersistentStorage, collectTemporaryCache };
