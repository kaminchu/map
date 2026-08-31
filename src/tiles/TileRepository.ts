import type { TileKey, TileCoordinate, TileRequest, TileResult, DownloadOptions } from "./types";

export interface TileBinaryStorage {
  isSupported(): boolean;
  read(tile: TileCoordinate): Promise<ArrayBuffer | undefined>;
  write(tile: TileCoordinate, data: ArrayBuffer): Promise<void>;
  exists(tile: TileCoordinate): Promise<boolean>;
  delete(tile: TileCoordinate): Promise<void>;
}

export interface TileRepository {
  getTile(request: TileRequest): Promise<TileResult>;
  downloadTile(request: TileRequest, options: DownloadOptions): Promise<TileResult>;
  deleteTile(key: TileKey): Promise<void>;
  flushAccessTimes(): Promise<void>;
}
