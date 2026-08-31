import { logger } from "../../lib/logger";

export const DATABASE_NAME = "offline-map";
export const DATABASE_VERSION = 1;

export interface TileMetadata {
  key: `${"std"}/${number}/${number}/${number}`;
  source: "std";
  z: number;
  x: number;
  y: number;
  size: number;
  contentType: string;
  createdAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  lastCheckedAt: number;
  pinned: boolean;
  etag?: string;
  lastModified?: string;
}
export type OfflineAreaStatus = "pending" | "downloading" | "completed" | "paused" | "error";
export interface OfflineArea {
  id: string;
  name: string;
  bounds: { west: number; south: number; east: number; north: number };
  minZoom: number;
  maxZoom: number;
  tileSource: "std";
  tileCount: number;
  downloadedTileCount: number;
  estimatedBytes?: number;
  createdAt: number;
  updatedAt: number;
  status: OfflineAreaStatus;
  errorMessage?: string;
}
export interface OfflineAreaTile {
  areaId: string;
  tileKey: TileMetadata["key"];
}
export interface DownloadJob {
  areaId: string;
  tileKey: TileMetadata["key"];
  priority: number;
  state: "pending" | "completed" | "failed";
  attemptCount: number;
  lastError?: string;
}
export interface SettingsRecord {
  key: "settings";
  cacheLimitBytes: number;
}

export type StoreName = "tiles" | "offlineAreas" | "offlineAreaTiles" | "downloadJobs" | "settings";
export type StoreValue =
  | TileMetadata
  | OfflineArea
  | OfflineAreaTile
  | DownloadJob
  | SettingsRecord;

let databasePromise: Promise<IDBDatabase> | undefined;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionResult(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unsupported"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const tiles = db.createObjectStore("tiles", { keyPath: "key" });
      tiles.createIndex("byLastAccessed", "lastAccessedAt");
      tiles.createIndex("bySource", "source");
      const areas = db.createObjectStore("offlineAreas", { keyPath: "id" });
      areas.createIndex("byCreatedAt", "createdAt");
      const areaTiles = db.createObjectStore("offlineAreaTiles", {
        keyPath: ["areaId", "tileKey"],
      });
      areaTiles.createIndex("byAreaId", "areaId");
      areaTiles.createIndex("byTileKey", "tileKey");
      const jobs = db.createObjectStore("downloadJobs", { keyPath: ["areaId", "tileKey"] });
      jobs.createIndex("byAreaState", ["areaId", "state"]);
      db.createObjectStore("settings", { keyPath: "key" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
  });
  databasePromise.catch((error: unknown) => logger.warn("IndexedDB unavailable", error));
  return databasePromise;
}

export async function withTransaction<T>(
  stores: StoreName | StoreName[],
  mode: IDBTransactionMode,
  callback: (transaction: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  const transaction = db.transaction(stores, mode);
  const value = await callback(transaction);
  await transactionResult(transaction);
  return value;
}

export { requestResult, transactionResult };
