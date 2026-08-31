import { TILE_SOURCES } from "../map/tileSources";
import { createTileKey } from "./tileKey";
import type { TileCoordinate, TileKey, TileSourceId } from "./types";

export const MAX_MERCATOR_LATITUDE = 85.05112878;

export interface GeoPoint {
  longitude: number;
  latitude: number;
}

export interface GeoBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function normalizeLongitude(longitude: number): number {
  if (!Number.isFinite(longitude)) throw new RangeError("Invalid longitude");
  const normalized = ((((longitude + 180) % 360) + 360) % 360) - 180;
  return normalized === -180 && longitude > 0 ? 180 : normalized;
}

export function clampLatitude(latitude: number): number {
  if (!Number.isFinite(latitude)) throw new RangeError("Invalid latitude");
  return Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude));
}

export function tileFromLngLat(
  point: GeoPoint,
  z: number,
  source: TileSourceId = "std",
): TileCoordinate {
  const definition = TILE_SOURCES[source];
  if (!definition || !Number.isInteger(z) || z < definition.minZoom || z > definition.maxZoom)
    throw new RangeError("Invalid zoom");
  const n = 2 ** z;
  const longitude = normalizeLongitude(point.longitude);
  const latitude = clampLatitude(point.latitude);
  const x = Math.max(0, Math.min(n - 1, Math.floor(((longitude + 180) / 360) * n)));
  const y = Math.max(
    0,
    Math.min(
      n - 1,
      Math.floor(((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) * n),
    ),
  );
  return { source, z, x, y };
}

function validateBounds(bounds: GeoBounds): void {
  if (![bounds.west, bounds.south, bounds.east, bounds.north].every(Number.isFinite))
    throw new RangeError("Invalid bounds");
  if (bounds.south > bounds.north) throw new RangeError("Invalid bounds latitude");
}

interface TileRange {
  minY: number;
  maxY: number;
  xIntervals: [number, number][];
}

function tileRange(bounds: GeoBounds, z: number, source: TileSourceId): TileRange {
  const definition = TILE_SOURCES[source];
  if (!definition || !Number.isInteger(z) || z < definition.minZoom || z > definition.maxZoom)
    throw new RangeError("Invalid zoom");
  const n = 2 ** z;
  const north = tileFromLngLat({ longitude: bounds.west, latitude: bounds.north }, z, source);
  const south = tileFromLngLat({ longitude: bounds.west, latitude: bounds.south }, z, source);
  const eastNorth = tileFromLngLat({ longitude: bounds.east, latitude: bounds.north }, z, source);
  const eastSouth = tileFromLngLat({ longitude: bounds.east, latitude: bounds.south }, z, source);
  const minY = Math.min(north.y, south.y, eastNorth.y, eastSouth.y);
  const maxY = Math.max(north.y, south.y, eastNorth.y, eastSouth.y);
  const west = normalizeLongitude(bounds.west);
  const east = normalizeLongitude(bounds.east);
  const xIntervals: [number, number][] =
    west <= east
      ? [
          [
            tileFromLngLat({ longitude: west, latitude: 0 }, z, source).x,
            tileFromLngLat({ longitude: east, latitude: 0 }, z, source).x,
          ],
        ]
      : [
          [tileFromLngLat({ longitude: west, latitude: 0 }, z, source).x, n - 1],
          [0, tileFromLngLat({ longitude: east, latitude: 0 }, z, source).x],
        ];
  return { minY, maxY, xIntervals };
}

function tileRanges(bounds: GeoBounds, z: number, source: TileSourceId): TileCoordinate[] {
  const { minY, maxY, xIntervals } = tileRange(bounds, z, source);
  const result: TileCoordinate[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (const interval of xIntervals) {
      const start = interval[0] ?? 0;
      const end = interval[1] ?? 0;
      for (let x = start; x <= end; x += 1) result.push({ source, z, x, y });
    }
  }
  return result;
}

export function enumerateTilesForBounds(
  bounds: GeoBounds,
  minZoom: number,
  maxZoom: number,
  source: TileSourceId = "std",
): TileCoordinate[] {
  validateBounds(bounds);
  const definition = TILE_SOURCES[source];
  if (
    !definition ||
    !Number.isInteger(minZoom) ||
    !Number.isInteger(maxZoom) ||
    minZoom < definition.minZoom ||
    maxZoom > definition.maxZoom ||
    minZoom > maxZoom
  )
    throw new RangeError("Invalid zoom range");
  const seen = new Set<TileKey>();
  const result: TileCoordinate[] = [];
  for (let z = minZoom; z <= maxZoom; z += 1) {
    for (const tile of tileRanges(bounds, z, source)) {
      const key = createTileKey(tile);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(tile);
      }
    }
  }
  return result;
}

export function countTilesForBounds(
  bounds: GeoBounds,
  minZoom: number,
  maxZoom: number,
  source: TileSourceId = "std",
): number {
  validateBounds(bounds);
  const definition = TILE_SOURCES[source];
  if (
    !definition ||
    !Number.isInteger(minZoom) ||
    !Number.isInteger(maxZoom) ||
    minZoom < definition.minZoom ||
    maxZoom > definition.maxZoom ||
    minZoom > maxZoom
  )
    throw new RangeError("Invalid zoom range");
  let count = 0;
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const range = tileRange(bounds, z, source);
    count +=
      (range.maxY - range.minY + 1) *
      range.xIntervals.reduce((total, [start, end]) => total + end - start + 1, 0);
  }
  return count;
}

export function accuracyCircle(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  points = 32,
): [number, number][] {
  const safeRadius = Math.max(0, radiusMeters);
  const earthRadius = 6_378_137;
  const latRadians = (latitude * Math.PI) / 180;
  const result: [number, number][] = [];
  for (let index = 0; index < points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const lat = latitude + ((safeRadius * Math.cos(angle)) / earthRadius) * (180 / Math.PI);
    const lon =
      longitude +
      ((safeRadius * Math.sin(angle)) / (earthRadius * Math.max(0.01, Math.cos(latRadians)))) *
        (180 / Math.PI);
    result.push([normalizeLongitude(lon), clampLatitude(lat)]);
  }
  result.push(result[0] ?? [longitude, latitude]);
  return result;
}
