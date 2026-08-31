import { QuotaExceededAppError, isQuotaError } from "../lib/errors";
import { getStorageEstimate } from "../storage/persistentStorage";
import { settingsRepository } from "../storage/metadata/settingsRepository";
import { tileMetadataRepository } from "../storage/metadata/tileMetadataRepository";
import { tileKeyLock } from "./tileCache";
import type { TileBinaryStorage } from "./TileRepository";

export const DEFAULT_CACHE_LIMIT_BYTES = 512 * 1024 * 1024;

export async function effectiveCacheLimit(
  configuredLimit = DEFAULT_CACHE_LIMIT_BYTES,
): Promise<number> {
  const { quota } = await getStorageEstimate();
  return Math.min(configuredLimit, quota === undefined ? configuredLimit : quota * 0.2);
}

export async function collectTemporaryCache(
  storage: TileBinaryStorage,
  requiredBytes = 0,
  configuredLimit?: number,
): Promise<number> {
  const limit = await effectiveCacheLimit(
    configuredLimit ?? (await settingsRepository.get()).cacheLimitBytes,
  );
  const stats = await tileMetadataRepository.statistics();
  let temporaryBytes = stats.temporaryBytes;
  let removed = 0;
  if (temporaryBytes + requiredBytes <= limit) return removed;
  for (const metadata of await tileMetadataRepository.gcCandidates()) {
    if (temporaryBytes + requiredBytes <= limit) break;
    await tileKeyLock.run(metadata.key, async () => {
      const current = await tileMetadataRepository.get(metadata.key);
      if (!current || current.pinned) return;
      await storage.delete({ source: current.source, z: current.z, x: current.x, y: current.y });
      await tileMetadataRepository.delete(current.key);
      temporaryBytes -= current.size;
      removed += 1;
    });
  }
  return removed;
}

export async function saveWithGarbageCollection(
  storage: TileBinaryStorage,
  data: ArrayBuffer,
  write: () => Promise<void>,
): Promise<void> {
  try {
    await write();
  } catch (error) {
    if (!isQuotaError(error) && !(error instanceof QuotaExceededAppError)) throw error;
    await collectTemporaryCache(storage, data.byteLength);
    await write();
  }
}
