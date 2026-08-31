import { z } from "zod/mini";
import type { TileMetadata } from "../storage/metadata/database";
import { parseTileKey } from "../tiles/tileKey";

const tileMetadataShape = z.object({
  key: z.string(),
  source: z.literal("std"),
  z: z.number(),
  x: z.number(),
  y: z.number(),
  size: z.number(),
  contentType: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastAccessedAt: z.number(),
  lastCheckedAt: z.number(),
  pinned: z.boolean(),
  etag: z.optional(z.string()),
  lastModified: z.optional(z.string()),
});

export function parseTileMetadata(value: unknown): TileMetadata | undefined {
  const result = tileMetadataShape.safeParse(value);
  if (!result.success) return undefined;
  const metadata = result.data as TileMetadata;
  try {
    const tile = parseTileKey(metadata.key);
    if (
      tile.source !== metadata.source ||
      tile.z !== metadata.z ||
      tile.x !== metadata.x ||
      tile.y !== metadata.y ||
      !Number.isInteger(metadata.size) ||
      metadata.size < 0
    )
      return undefined;
  } catch {
    return undefined;
  }
  return metadata;
}
