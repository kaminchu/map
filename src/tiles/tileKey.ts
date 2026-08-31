import { z } from "zod/mini";
import { TILE_SOURCES, validateTileCoordinate } from "../map/tileSources";
import type { TileCoordinate, TileKey } from "./types";

const tileKeySchema = z.templateLiteral([
  z.literal("std"),
  z.literal("/"),
  z.number(),
  z.literal("/"),
  z.number(),
  z.literal("/"),
  z.number(),
]);

export function createTileKey(coordinate: TileCoordinate): TileKey {
  validateTileCoordinate(coordinate);
  return `${coordinate.source}/${coordinate.z}/${coordinate.x}/${coordinate.y}`;
}

export function parseTileKey(value: unknown): TileCoordinate {
  const parsed = tileKeySchema.safeParse(value);
  if (!parsed.success || typeof value !== "string") throw new Error("Invalid tile key");
  const parts = value.split("/");
  const source = parts[0];
  const z = Number(parts[1]);
  const x = Number(parts[2]);
  const y = Number(parts[3]);
  if (source !== "std" || !Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y))
    throw new Error("Invalid tile key");
  const coordinate: TileCoordinate = { source, z, x, y };
  validateTileCoordinate(coordinate, TILE_SOURCES.std);
  return coordinate;
}

export function tilePath(coordinate: TileCoordinate): string[] {
  validateTileCoordinate(coordinate);
  return [
    "tiles",
    coordinate.source,
    String(coordinate.z),
    String(coordinate.x),
    `${coordinate.y}.png`,
  ];
}
