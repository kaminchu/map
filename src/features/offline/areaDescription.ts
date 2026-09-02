import type { Feature, Polygon, Position } from "geojson";
import { geojson } from "flatgeobuf";
import { ADMINISTRATIVE_BOUNDARIES_PATH } from "../../config/dataSources";
import type { GeoBounds } from "../../tiles/tileMath";

type MunicipalityProperties = {
  N03_001?: unknown;
  N03_003?: unknown;
  N03_004?: unknown;
  N03_005?: unknown;
};

type Coordinate = [number, number];

export function centerOfBounds(bounds: GeoBounds): [number, number] {
  const east = bounds.east < bounds.west ? bounds.east + 360 : bounds.east;
  const longitude = (((bounds.west + east) / 2 + 540) % 360) - 180;
  return [longitude, (bounds.south + bounds.north) / 2];
}

export async function municipalityAtCenter(bounds: GeoBounds): Promise<string | undefined> {
  const [longitude, latitude] = centerOfBounds(bounds);
  const url = `${import.meta.env.BASE_URL}${ADMINISTRATIVE_BOUNDARIES_PATH}`;
  const candidates = geojson.deserialize(url, {
    minX: longitude,
    minY: latitude,
    maxX: longitude,
    maxY: latitude,
  });

  for await (const feature of candidates) {
    if (!containsPoint(feature, [longitude, latitude])) continue;
    const properties = (feature.properties ?? {}) as MunicipalityProperties;
    const parts = [properties.N03_001, properties.N03_003, properties.N03_004, properties.N03_005]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .filter((value, index, values) => values.indexOf(value) === index);
    if (parts.length > 0) return parts.join("");
  }
  return undefined;
}

export function describeArea(bounds: GeoBounds, municipality?: string): string {
  const [longitude, latitude] = centerOfBounds(bounds);
  const height = distanceKm([longitude, bounds.south], [longitude, bounds.north]);
  const width = distanceKm([bounds.west, latitude], [bounds.east, latitude]);
  const location = municipality ? `${municipality}付近` : "名称不明の地域";
  return `${location}（縦 約${formatDistance(height)} × 横 約${formatDistance(width)}）`;
}

function distanceKm(
  [longitude1, latitude1]: Coordinate,
  [longitude2, latitude2]: Coordinate,
): number {
  const radians = Math.PI / 180;
  const deltaLatitude = (latitude2 - latitude1) * radians;
  let deltaLongitude = (longitude2 - longitude1) * radians;
  if (deltaLongitude > Math.PI) deltaLongitude -= 2 * Math.PI;
  if (deltaLongitude < -Math.PI) deltaLongitude += 2 * Math.PI;
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(latitude1 * radians) *
      Math.cos(latitude2 * radians) *
      Math.sin(deltaLongitude / 2) ** 2;
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(kilometers: number): string {
  if (kilometers < 1) return `${Math.round(kilometers * 1000)} m`;
  if (kilometers < 10) return `${kilometers.toFixed(1)} km`;
  return `${Math.round(kilometers)} km`;
}

function containsPoint(feature: Feature, point: Coordinate): boolean {
  if (feature.geometry?.type === "Polygon") return polygonContainsPoint(feature.geometry, point);
  if (feature.geometry?.type === "MultiPolygon")
    return feature.geometry.coordinates.some((coordinates) =>
      polygonContainsPoint({ type: "Polygon", coordinates }, point),
    );
  return false;
}

function polygonContainsPoint(polygon: Polygon, point: Coordinate): boolean {
  const [outer, ...holes] = polygon.coordinates;
  return (
    outer !== undefined &&
    ringContainsPoint(outer, point) &&
    !holes.some((ring) => ringContainsPoint(ring, point))
  );
}

function ringContainsPoint(ring: Position[], [x, y]: Coordinate): boolean {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [x1, y1] = ring[current] ?? [];
    const [x2, y2] = ring[previous] ?? [];
    if (x1 === undefined || y1 === undefined || x2 === undefined || y2 === undefined) continue;
    const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
    if (
      Math.abs(cross) < 1e-10 &&
      x >= Math.min(x1, x2) &&
      x <= Math.max(x1, x2) &&
      y >= Math.min(y1, y2) &&
      y <= Math.max(y1, y2)
    )
      return true;
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
