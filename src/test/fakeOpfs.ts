import type { TileBinaryStorage } from "../tiles/TileRepository";
import { createTileKey } from "../tiles/tileKey";
import type { TileCoordinate } from "../tiles/types";

export class FakeOpfs implements TileBinaryStorage {
  readonly files = new Map<string, ArrayBuffer>();
  supported = true;
  isSupported(): boolean {
    return this.supported;
  }
  async read(tile: TileCoordinate): Promise<ArrayBuffer | undefined> {
    return this.files.get(createTileKey(tile));
  }
  async write(tile: TileCoordinate, data: ArrayBuffer): Promise<void> {
    this.files.set(createTileKey(tile), data.slice(0));
  }
  async exists(tile: TileCoordinate): Promise<boolean> {
    return this.files.has(createTileKey(tile));
  }
  async delete(tile: TileCoordinate): Promise<void> {
    this.files.delete(createTileKey(tile));
  }
}
