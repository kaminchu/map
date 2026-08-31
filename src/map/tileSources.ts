import type { TileCoordinate, TileSourceId } from "../tiles/types";

export interface MapTileSource {
  id: TileSourceId;
  name: string;
  minZoom: number;
  maxZoom: number;
  extension: "png";
  contentTypes: readonly string[];
  getRemoteUrl(tile: TileCoordinate): string;
  attribution: string;
}

export const STD_TILE_SOURCE: MapTileSource = {
  id: "std",
  name: "国土地理院 標準地図",
  minZoom: 0,
  maxZoom: 18,
  extension: "png",
  contentTypes: ["image/png"],
  getRemoteUrl(tile) {
    validateTileCoordinate(tile, this);
    return `https://cyberjapandata.gsi.go.jp/xyz/std/${tile.z}/${tile.x}/${tile.y}.png`;
  },
  attribution:
    '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noreferrer">国土地理院</a>',
};

export const TILE_SOURCES: Record<TileSourceId, MapTileSource> = { std: STD_TILE_SOURCE };

export function validateTileCoordinate(
  tile: TileCoordinate,
  source = TILE_SOURCES[tile.source],
): void {
  if (
    !source ||
    tile.source !== source.id ||
    !Number.isInteger(tile.z) ||
    tile.z < source.minZoom ||
    tile.z > source.maxZoom
  ) {
    throw new RangeError("Invalid tile zoom or source");
  }
  const limit = 2 ** tile.z;
  if (
    !Number.isInteger(tile.x) ||
    !Number.isInteger(tile.y) ||
    tile.x < 0 ||
    tile.x >= limit ||
    tile.y < 0 ||
    tile.y >= limit
  ) {
    throw new RangeError("Invalid tile coordinate");
  }
}
