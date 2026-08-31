export type TileSourceId = "std";
export type TileKey = `${TileSourceId}/${number}/${number}/${number}`;
export const DEFAULT_ESTIMATED_TILE_BYTES = 20 * 1024;

export interface TileCoordinate {
  source: TileSourceId;
  z: number;
  x: number;
  y: number;
}

export interface TileRequest extends TileCoordinate {
  signal?: AbortSignal;
  priority: "visible" | "revalidation" | "offline" | "maintenance";
}

export interface TileResult {
  data: ArrayBuffer;
  contentType: string;
  source: "local" | "network";
}

export interface DownloadOptions {
  offlineAreaId: string;
  forceRevalidate?: boolean;
  signal?: AbortSignal;
}

export interface FetchedTile {
  status: 200 | 304;
  data?: ArrayBuffer;
  contentType?: string;
  etag?: string;
  lastModified?: string;
}
