import { isAbortError, isQuotaError, errorMessage, TileUnavailableError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { offlineAreaRepository } from "../../storage/metadata/offlineAreaRepository";
import type { OfflineArea } from "../../storage/metadata/database";
import { tileRepository } from "../../tiles/tileRepositoryImpl";
import { parseTileKey } from "../../tiles/tileKey";

export const MAX_DOWNLOAD_RETRIES = 2;
type Listener = (area: OfflineArea) => void;

export class DownloadManager {
  private readonly active = new Map<string, AbortController>();
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private notify(area: OfflineArea | undefined): void {
    if (area) this.listeners.forEach((listener) => listener(area));
  }

  async start(id: string, forceRevalidate = false): Promise<void> {
    if (this.active.has(id)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const area = await offlineAreaRepository.setStatus(
        id,
        "error",
        "オフラインのためダウンロードを開始できません。",
      );
      this.notify(area);
      return;
    }
    const controller = new AbortController();
    this.active.set(id, controller);
    let area = await offlineAreaRepository.setStatus(id, "downloading");
    this.notify(area);
    try {
      const jobs = await offlineAreaRepository.allJobs(id);
      let nextJob = 0;
      let stop = false;
      const runJob = async () => {
        while (!stop && !controller.signal.aborted) {
          const job = jobs[nextJob];
          nextJob += 1;
          if (!job) return;
          if (job.state === "completed" && !forceRevalidate) continue;
          let succeeded = false;
          let lastError: unknown;
          for (let attempt = 0; attempt <= MAX_DOWNLOAD_RETRIES; attempt += 1) {
            if (controller.signal.aborted || stop) break;
            try {
              await offlineAreaRepository.setAttemptCount(id, job.tileKey, attempt);
              const request = parseTileKey(job.tileKey);
              await tileRepository.downloadTile(
                { ...request, priority: "offline" },
                { offlineAreaId: id, forceRevalidate, signal: controller.signal },
              );
              area = (await offlineAreaRepository.completeTile(id, job.tileKey)) ?? area;
              this.notify(area);
              succeeded = true;
              break;
            } catch (error) {
              lastError = error;
              if (
                isAbortError(error) ||
                isQuotaError(error) ||
                (error instanceof TileUnavailableError && error.reason === "offline-miss")
              )
                break;
              if (attempt < MAX_DOWNLOAD_RETRIES)
                await new Promise<void>((resolve) =>
                  setTimeout(resolve, attempt === 0 ? 1_000 : 3_000),
                );
            }
          }
          if (!succeeded && !controller.signal.aborted) {
            const message = errorMessage(lastError);
            area =
              (await offlineAreaRepository.markJob(id, job.tileKey, "failed", message)) ?? area;
            area = (await offlineAreaRepository.setStatus(id, "error", message)) ?? area;
            this.notify(area);
            stop = true;
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, () => runJob()));
      if (controller.signal.aborted) {
        area = await offlineAreaRepository.setStatus(id, "paused");
        this.notify(area);
      } else if (!stop) {
        area = await offlineAreaRepository.setStatus(id, "completed");
        this.notify(area);
      }
    } catch (error) {
      logger.debug("Download manager failed", error);
      area = await offlineAreaRepository.setStatus(id, "error", errorMessage(error));
      this.notify(area);
    } finally {
      this.active.delete(id);
    }
  }

  async pause(id: string): Promise<void> {
    this.active.get(id)?.abort();
    if (!this.active.has(id)) this.notify(await offlineAreaRepository.setStatus(id, "paused"));
  }

  async resume(id: string): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.notify(
        await offlineAreaRepository.setStatus(
          id,
          "error",
          "オフラインのためダウンロードを開始できません。",
        ),
      );
      return;
    }
    const area = await offlineAreaRepository.get(id);
    if (!area) return;
    await this.start(id, false);
  }

  async update(id: string): Promise<void> {
    await offlineAreaRepository.resetJobs(id);
    await this.start(id, true);
  }
  async delete(id: string): Promise<void> {
    await this.pause(id);
    await offlineAreaRepository.delete(id);
  }
}

export const downloadManager = new DownloadManager();
