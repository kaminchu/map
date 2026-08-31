import { parseDownloadJob, parseOfflineArea } from "../../schemas/offlineAreaSchema";
import { parseTileMetadata } from "../../schemas/tileMetadataSchema";
import {
  openDatabase,
  requestResult,
  withTransaction,
  type DownloadJob,
  type OfflineArea,
  type OfflineAreaTile,
  type OfflineAreaStatus,
} from "./database";
import type { TileKey } from "../../tiles/types";

export interface AreaProgress {
  area: OfflineArea;
  jobs: DownloadJob[];
}

async function readAll<T>(store: IDBObjectStore): Promise<T[]> {
  return requestResult(store.getAll());
}

export const offlineAreaRepository = {
  async list(): Promise<OfflineArea[]> {
    const db = await openDatabase();
    const tx = db.transaction("offlineAreas", "readonly");
    const values = await requestResult(
      tx.objectStore("offlineAreas").index("byCreatedAt").getAll(),
    );
    return values
      .flatMap((value) => {
        const area = parseOfflineArea(value);
        return area ? [area] : [];
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
  async get(id: string): Promise<OfflineArea | undefined> {
    const db = await openDatabase();
    const tx = db.transaction("offlineAreas", "readonly");
    return parseOfflineArea(await requestResult(tx.objectStore("offlineAreas").get(id)));
  },
  async jobs(id: string): Promise<DownloadJob[]> {
    const db = await openDatabase();
    const tx = db.transaction("downloadJobs", "readonly");
    const values = await requestResult(tx.objectStore("downloadJobs").getAll());
    return values
      .flatMap((value) => {
        const job = parseDownloadJob(value);
        return job && job.areaId === id && job.state !== "completed" ? [job] : [];
      })
      .sort((a, b) => a.priority - b.priority || a.tileKey.localeCompare(b.tileKey));
  },
  async allJobs(id: string): Promise<DownloadJob[]> {
    const db = await openDatabase();
    const tx = db.transaction("downloadJobs", "readonly");
    const values = await requestResult(tx.objectStore("downloadJobs").getAll());
    return values
      .flatMap((value) => {
        const job = parseDownloadJob(value);
        return job && job.areaId === id ? [job] : [];
      })
      .sort((a, b) => a.priority - b.priority || a.tileKey.localeCompare(b.tileKey));
  },
  async create(area: OfflineArea, tileKeys: TileKey[], completeKeys: Set<TileKey>): Promise<void> {
    await withTransaction(
      ["offlineAreas", "offlineAreaTiles", "downloadJobs", "tiles"],
      "readwrite",
      (tx) => {
        tx.objectStore("offlineAreas").put(area);
        const refs = tx.objectStore("offlineAreaTiles");
        const jobs = tx.objectStore("downloadJobs");
        const tiles = tx.objectStore("tiles");
        tileKeys.forEach((tileKey, priority) => {
          refs.put({ areaId: area.id, tileKey } satisfies OfflineAreaTile);
          const isComplete = completeKeys.has(tileKey);
          jobs.put({
            areaId: area.id,
            tileKey,
            priority,
            state: isComplete ? "completed" : "pending",
            attemptCount: 0,
          } satisfies DownloadJob);
          if (isComplete) {
            const request = tiles.get(tileKey);
            request.onsuccess = () => {
              const metadata = parseTileMetadata(request.result);
              if (metadata) tiles.put({ ...metadata, pinned: true });
            };
          }
        });
      },
    );
  },
  async setStatus(
    id: string,
    status: OfflineAreaStatus,
    errorMessage?: string,
  ): Promise<OfflineArea | undefined> {
    return withTransaction(["offlineAreas"], "readwrite", async (tx) => {
      const store = tx.objectStore("offlineAreas");
      const area = parseOfflineArea(await requestResult(store.get(id)));
      if (!area) return undefined;
      const next: OfflineArea = {
        ...area,
        status,
        updatedAt: Date.now(),
        ...(errorMessage ? { errorMessage } : { errorMessage: undefined }),
      };
      store.put(next);
      return next;
    });
  },
  async markJob(
    id: string,
    tileKey: TileKey,
    state: DownloadJob["state"],
    lastError?: string,
  ): Promise<OfflineArea | undefined> {
    return withTransaction(["offlineAreas", "downloadJobs"], "readwrite", async (tx) => {
      const areas = tx.objectStore("offlineAreas");
      const jobs = tx.objectStore("downloadJobs");
      const area = parseOfflineArea(await requestResult(areas.get(id)));
      const job = parseDownloadJob(await requestResult(jobs.get([id, tileKey])));
      if (!area || !job) return area;
      jobs.put({ ...job, state, ...(lastError ? { lastError } : { lastError: undefined }) });
      const nextCount =
        state === "completed" && job.state !== "completed"
          ? area.downloadedTileCount + 1
          : state !== "completed" && job.state === "completed"
            ? Math.max(0, area.downloadedTileCount - 1)
            : area.downloadedTileCount;
      const nextArea: OfflineArea = {
        ...area,
        downloadedTileCount: nextCount,
        updatedAt: Date.now(),
      };
      areas.put(nextArea);
      return nextArea;
    });
  },
  async completeTile(id: string, tileKey: TileKey): Promise<OfflineArea | undefined> {
    return withTransaction(["offlineAreas", "downloadJobs", "tiles"], "readwrite", async (tx) => {
      const areas = tx.objectStore("offlineAreas");
      const jobs = tx.objectStore("downloadJobs");
      const tiles = tx.objectStore("tiles");
      const area = parseOfflineArea(await requestResult(areas.get(id)));
      const job = parseDownloadJob(await requestResult(jobs.get([id, tileKey])));
      if (!area || !job) return area;
      const metadata = parseTileMetadata(await requestResult(tiles.get(tileKey)));
      if (metadata) tiles.put({ ...metadata, pinned: true });
      if (job.state !== "completed") {
        jobs.put({ ...job, state: "completed", lastError: undefined });
        const nextArea = {
          ...area,
          downloadedTileCount: area.downloadedTileCount + 1,
          updatedAt: Date.now(),
        };
        areas.put(nextArea);
        return nextArea;
      }
      return area;
    });
  },
  async setAttemptCount(id: string, tileKey: TileKey, attemptCount: number): Promise<void> {
    await withTransaction("downloadJobs", "readwrite", async (tx) => {
      const store = tx.objectStore("downloadJobs");
      const job = parseDownloadJob(await requestResult(store.get([id, tileKey])));
      if (job) store.put({ ...job, attemptCount });
    });
  },
  async resetJobs(id: string): Promise<void> {
    await withTransaction(["offlineAreas", "downloadJobs"], "readwrite", async (tx) => {
      const areaStore = tx.objectStore("offlineAreas");
      const jobStore = tx.objectStore("downloadJobs");
      const area = parseOfflineArea(await requestResult(areaStore.get(id)));
      if (!area) return;
      const jobs = (await requestResult(jobStore.getAll())) as unknown[];
      for (const value of jobs) {
        const job = parseDownloadJob(value);
        if (job && job.areaId === id)
          jobStore.put({ ...job, state: "pending", attemptCount: 0, lastError: undefined });
      }
      areaStore.put({
        ...area,
        status: "pending",
        downloadedTileCount: 0,
        updatedAt: Date.now(),
        errorMessage: undefined,
      });
    });
  },
  async repairCompleted(id: string, completeKeys: Set<TileKey>): Promise<void> {
    await withTransaction(["downloadJobs", "offlineAreas", "tiles"], "readwrite", async (tx) => {
      const jobs = tx.objectStore("downloadJobs");
      const areaStore = tx.objectStore("offlineAreas");
      const tileStore = tx.objectStore("tiles");
      const area = parseOfflineArea(await requestResult(areaStore.get(id)));
      if (!area) return;
      for (const key of completeKeys) {
        const job = parseDownloadJob(await requestResult(jobs.get([id, key])));
        if (job && job.state !== "completed") jobs.put({ ...job, state: "completed" });
        const metadata = parseTileMetadata(await requestResult(tileStore.get(key)));
        if (metadata) tileStore.put({ ...metadata, pinned: true });
      }
      const jobsValues = (await requestResult(
        jobs.index("byAreaState").getAll(IDBKeyRange.bound([id, "completed"], [id, "completed"])),
      )) as unknown[];
      const count = jobsValues.filter((value) => parseDownloadJob(value)).length;
      areaStore.put({ ...area, downloadedTileCount: count, updatedAt: Date.now() });
    });
  },
  async pauseDownloadingAreas(): Promise<void> {
    await withTransaction("offlineAreas", "readwrite", async (tx) => {
      const store = tx.objectStore("offlineAreas");
      const areas = (await readAll<unknown>(store))
        .map((value) => parseOfflineArea(value))
        .filter((area): area is OfflineArea => Boolean(area && area.status === "downloading"));
      areas.forEach((area) => store.put({ ...area, status: "paused", updatedAt: Date.now() }));
    });
  },
  async delete(id: string): Promise<void> {
    await withTransaction(
      ["offlineAreas", "offlineAreaTiles", "downloadJobs", "tiles"],
      "readwrite",
      async (tx) => {
        const areas = tx.objectStore("offlineAreas");
        const refs = tx.objectStore("offlineAreaTiles");
        const jobs = tx.objectStore("downloadJobs");
        const tiles = tx.objectStore("tiles");
        const keys = (await requestResult(refs.index("byAreaId").getAllKeys(id))) as IDBValidKey[];
        for (const key of keys) {
          const pair = Array.isArray(key) ? key : [];
          const tileKey = pair[1];
          if (typeof tileKey !== "string") continue;
          const references = await requestResult(refs.index("byTileKey").getAll(tileKey));
          refs.delete(key);
          if (references.length <= 1) {
            const metadata = parseTileMetadata(await requestResult(tiles.get(tileKey)));
            if (metadata) tiles.put({ ...metadata, pinned: false });
          }
        }
        const jobValues = (await requestResult(jobs.getAll())) as unknown[];
        jobValues.forEach((value) => {
          const job = parseDownloadJob(value);
          if (job?.areaId === id) jobs.delete([id, job.tileKey]);
        });
        areas.delete(id);
      },
    );
  },
};
