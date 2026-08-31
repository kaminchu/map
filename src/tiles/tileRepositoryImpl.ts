import {
  StorageUnavailableError,
  TileUnavailableError,
  isAbortError,
  isQuotaError,
} from "../lib/errors";
import { logger } from "../lib/logger";
import { Semaphore } from "../lib/semaphore";
import { TILE_SOURCES } from "../map/tileSources";
import { opfsTileStorage } from "../storage/opfs/opfsTileStorage";
import {
  metadataForTile,
  tileMetadataRepository,
} from "../storage/metadata/tileMetadataRepository";
import type { TileMetadata } from "../storage/metadata/database";
import { fetchTile as defaultFetchTile } from "./tileFetcher";
import { createTileKey, parseTileKey } from "./tileKey";
import { tileKeyLock } from "./tileCache";
import { collectTemporaryCache, saveWithGarbageCollection } from "./tileGarbageCollector";
import type { TileBinaryStorage, TileRepository } from "./TileRepository";
import type { FetchedTile, TileCoordinate, TileKey, TileRequest, TileResult } from "./types";

export const TILE_REVALIDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const ACCESS_FLUSH_INTERVAL_MS = 5_000;
export const ACCESS_FLUSH_MAX_ENTRIES = 100;
export const VISIBLE_FETCH_CONCURRENCY = 12;
export const REVALIDATION_CONCURRENCY = 2;
export const DOWNLOAD_CONCURRENCY = 6;
export { DEFAULT_ESTIMATED_TILE_BYTES } from "./types";

interface MetadataRepository {
  get(key: TileKey): Promise<TileMetadata | undefined>;
  put(metadata: TileMetadata): Promise<void>;
  delete(key: TileKey): Promise<void>;
  touch(entries: Map<TileKey, number>): Promise<void>;
  hasAreaReference(key: TileKey): Promise<boolean>;
}

export interface TileRepositoryOptions {
  storage?: TileBinaryStorage;
  metadata?: MetadataRepository;
  now?: () => number;
  isOnline?: () => boolean;
  fetchTile?: (
    tile: TileCoordinate,
    options: {
      signal?: AbortSignal;
      etag?: string;
      lastModified?: string;
      allowNotModified?: boolean;
    },
  ) => Promise<FetchedTile>;
  collectCache?: (requiredBytes: number) => Promise<void>;
  onStorageUnavailable?: (error: unknown) => void;
}

interface InFlightNetwork {
  controller: AbortController;
  consumers: number;
  promise: Promise<FetchedTile>;
}

function waitForConsumer<T>(entry: InFlightNetwork, signal: AbortSignal | undefined): Promise<T> {
  entry.consumers += 1;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      entry.consumers -= 1;
      if (entry.consumers === 0) entry.controller.abort();
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
    entry.promise.then(
      (value) => {
        if (!settled) {
          cleanup();
          resolve(value as T);
        }
      },
      (error: unknown) => {
        if (!settled) {
          cleanup();
          reject(error);
        }
      },
    );
  });
}

export function createTileRepository(options: TileRepositoryOptions = {}): TileRepository {
  const storage = options.storage ?? opfsTileStorage;
  const metadata = options.metadata ?? tileMetadataRepository;
  const now = options.now ?? (() => Date.now());
  const isOnline = options.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine);
  const requestFetch =
    options.fetchTile ??
    ((tile, fetchOptions) => defaultFetchTile(TILE_SOURCES[tile.source], tile, fetchOptions));
  const collectCache =
    options.collectCache ??
    ((requiredBytes: number) =>
      collectTemporaryCache(storage, requiredBytes).then(() => undefined));
  const visibleSemaphore = new Semaphore(VISIBLE_FETCH_CONCURRENCY);
  const revalidationSemaphore = new Semaphore(REVALIDATION_CONCURRENCY);
  const downloadSemaphore = new Semaphore(DOWNLOAD_CONCURRENCY);
  const accessBuffer = new Map<TileKey, number>();
  const inFlight = new Map<TileKey, InFlightNetwork>();
  const revalidations = new Map<TileKey, Promise<void>>();
  const tileLocks = tileKeyLock;

  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const scheduleFlush = () => {
    if (accessBuffer.size >= ACCESS_FLUSH_MAX_ENTRIES) {
      void flushAccessTimes();
      return;
    }
    if (!flushTimer)
      flushTimer = setTimeout(() => {
        flushTimer = undefined;
        void flushAccessTimes();
      }, ACCESS_FLUSH_INTERVAL_MS);
  };
  const recordAccess = (key: TileKey) => {
    accessBuffer.set(key, now());
    scheduleFlush();
  };
  const flushAccessTimes = async () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (accessBuffer.size === 0) return;
    const entries = new Map(accessBuffer);
    accessBuffer.clear();
    try {
      await metadata.touch(entries);
    } catch (error) {
      logger.debug("Access time flush failed", error);
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      void flushAccessTimes();
    });
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushAccessTimes();
    });
  }

  const networkTile = async (
    tile: TileCoordinate,
    priority: TileRequest["priority"],
    signal?: AbortSignal,
    condition?: TileMetadata,
  ): Promise<FetchedTile> => {
    const key = createTileKey(tile);
    const current = inFlight.get(key);
    if (current) return waitForConsumer<FetchedTile>(current, signal);
    const controller = new AbortController();
    const semaphore =
      priority === "visible"
        ? visibleSemaphore
        : priority === "revalidation"
          ? revalidationSemaphore
          : downloadSemaphore;
    const promise = (async () => {
      const release = await semaphore.acquire(controller.signal);
      try {
        return await requestFetch(tile, {
          signal: controller.signal,
          etag: condition?.etag,
          lastModified: condition?.lastModified,
          allowNotModified: Boolean(condition),
        });
      } finally {
        release();
      }
    })();
    const entry: InFlightNetwork = { controller, consumers: 0, promise };
    inFlight.set(key, entry);
    promise
      .finally(() => {
        if (inFlight.get(key) === entry) inFlight.delete(key);
      })
      .catch(() => undefined);
    return waitForConsumer<FetchedTile>(entry, signal);
  };

  const saveNetworkTile = async (
    tile: TileCoordinate,
    fetched: FetchedTile,
    pinned: boolean,
    strictPersistence = false,
  ): Promise<TileResult> => {
    const key = createTileKey(tile);
    return tileLocks.run(key, async () => {
      if (fetched.status !== 200 || !fetched.data || !fetched.contentType)
        throw new Error("Expected tile body");
      const currentTime = now();
      try {
        if (storage.isSupported()) {
          const write = () => storage.write(tile, fetched.data as ArrayBuffer);
          await collectCache(fetched.data.byteLength).catch(() => undefined);
          await saveWithGarbageCollection(storage, fetched.data, write);
          const current = await metadata.get(key);
          const next = current
            ? {
                ...current,
                size: fetched.data.byteLength,
                contentType: fetched.contentType,
                updatedAt: currentTime,
                lastCheckedAt: currentTime,
                ...(fetched.etag ? { etag: fetched.etag } : { etag: undefined }),
                ...(fetched.lastModified
                  ? { lastModified: fetched.lastModified }
                  : { lastModified: undefined }),
                pinned: pinned || current.pinned,
              }
            : {
                ...metadataForTile(
                  key,
                  fetched.data.byteLength,
                  fetched.contentType,
                  currentTime,
                  pinned,
                ),
                ...(fetched.etag ? { etag: fetched.etag } : {}),
                ...(fetched.lastModified ? { lastModified: fetched.lastModified } : {}),
              };
          await metadata.put(next);
        }
      } catch (error) {
        if (strictPersistence) throw error;
        options.onStorageUnavailable?.(error);
        if (isQuotaError(error)) await collectCache(fetched.data.byteLength).catch(() => undefined);
        logger.warn("Tile persistence failed", tile, error);
      }
      return { data: fetched.data, contentType: fetched.contentType, source: "network" };
    });
  };

  const revalidate = async (tile: TileCoordinate, existing: TileMetadata): Promise<void> => {
    const key = createTileKey(tile);
    const running = revalidations.get(key);
    if (running) return running;
    const task = (async () => {
      try {
        const fetched = await networkTile(tile, "revalidation", undefined, existing);
        if (fetched.status === 304) {
          await metadata.put({ ...existing, lastCheckedAt: now() });
          return;
        }
        if (!fetched.data || !fetched.contentType || !storage.isSupported()) return;
        await storage.write(tile, fetched.data);
        await metadata.put({
          ...existing,
          size: fetched.data.byteLength,
          contentType: fetched.contentType,
          updatedAt: now(),
          lastCheckedAt: now(),
          ...(fetched.etag ? { etag: fetched.etag } : { etag: undefined }),
          ...(fetched.lastModified
            ? { lastModified: fetched.lastModified }
            : { lastModified: undefined }),
        });
      } catch (error) {
        if (!isAbortError(error)) logger.debug("Tile revalidation failed", tile, error);
      } finally {
        revalidations.delete(key);
      }
    })();
    revalidations.set(key, task);
    return task;
  };

  return {
    async getTile(request) {
      const tile: TileCoordinate = {
        source: request.source,
        z: request.z,
        x: request.x,
        y: request.y,
      };
      const key = createTileKey(tile);
      let binary: ArrayBuffer | undefined;
      if (storage.isSupported()) {
        binary = await storage.read(tile);
        if (binary) {
          void metadata
            .get(key)
            .then((localMetadata) => {
              if (!localMetadata)
                return metadata.put(
                  metadataForTile(key, binary?.byteLength ?? 0, "image/png", now()),
                );
              if (now() - localMetadata.lastCheckedAt >= TILE_REVALIDATE_INTERVAL_MS && isOnline())
                return revalidate(tile, localMetadata);
              return undefined;
            })
            .catch((error: unknown) => logger.debug("Local metadata repair failed", tile, error));
          recordAccess(key);
          return { data: binary, contentType: "image/png", source: "local" };
        }
        const localMetadata = await metadata.get(key);
        if (localMetadata) await metadata.delete(key);
      }
      if (!isOnline()) throw new TileUnavailableError("offline-miss");
      const fetched = await networkTile(tile, "visible", request.signal);
      return saveNetworkTile(tile, fetched, false);
    },
    async downloadTile(request, downloadOptions) {
      const tile: TileCoordinate = {
        source: request.source,
        z: request.z,
        x: request.x,
        y: request.y,
      };
      const key = createTileKey(tile);
      const force = downloadOptions.forceRevalidate ?? false;
      const existingBinary = storage.isSupported() ? await storage.read(tile) : undefined;
      const existingMetadata = await metadata.get(key);
      if (existingBinary && !force) {
        const localMetadata =
          existingMetadata ?? metadataForTile(key, existingBinary.byteLength, "image/png", now());
        if (!localMetadata.pinned) await metadata.put({ ...localMetadata, pinned: true });
        return { data: existingBinary, contentType: localMetadata.contentType, source: "local" };
      }
      if (!isOnline()) throw new TileUnavailableError("offline-miss");
      const fetched = await networkTile(
        tile,
        "offline",
        downloadOptions.signal,
        force ? existingMetadata : undefined,
      );
      if (fetched.status === 304 && existingBinary && existingMetadata) {
        await metadata.put({ ...existingMetadata, pinned: true, lastCheckedAt: now() });
        return { data: existingBinary, contentType: existingMetadata.contentType, source: "local" };
      }
      const result = await saveNetworkTile(tile, fetched, true, true);
      if (storage.isSupported() && (!(await storage.exists(tile)) || !(await metadata.get(key))))
        throw new StorageUnavailableError("Tile could not be persisted");
      return result;
    },
    async deleteTile(key) {
      await tileLocks.run(key, async () => {
        const tile = parseTileKey(key);
        await storage.delete(tile);
        await metadata.delete(key);
      });
    },
    flushAccessTimes,
  };
}

export const tileRepository = createTileRepository();
