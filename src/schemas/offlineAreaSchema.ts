import { z } from "zod/mini";
import type { OfflineArea, OfflineAreaTile, DownloadJob } from "../storage/metadata/database";

const areaShape = z.object({
  id: z.string(),
  name: z.string(),
  bounds: z.object({ west: z.number(), south: z.number(), east: z.number(), north: z.number() }),
  minZoom: z.number(),
  maxZoom: z.number(),
  tileSource: z.literal("std"),
  tileCount: z.number(),
  downloadedTileCount: z.number(),
  estimatedBytes: z.optional(z.number()),
  createdAt: z.number(),
  updatedAt: z.number(),
  status: z.enum(["pending", "downloading", "completed", "paused", "error"]),
  errorMessage: z.optional(z.string()),
});
const areaTileShape = z.object({ areaId: z.string(), tileKey: z.string() });
const jobShape = z.object({
  areaId: z.string(),
  tileKey: z.string(),
  priority: z.number(),
  state: z.enum(["pending", "completed", "failed"]),
  attemptCount: z.number(),
  lastError: z.optional(z.string()),
});

export const parseOfflineArea = (value: unknown): OfflineArea | undefined => {
  const result = areaShape.safeParse(value);
  return result.success ? (result.data as OfflineArea) : undefined;
};
export const parseOfflineAreaTile = (value: unknown): OfflineAreaTile | undefined => {
  const result = areaTileShape.safeParse(value);
  return result.success ? (result.data as OfflineAreaTile) : undefined;
};
export const parseDownloadJob = (value: unknown): DownloadJob | undefined => {
  const result = jobShape.safeParse(value);
  return result.success ? (result.data as DownloadJob) : undefined;
};
