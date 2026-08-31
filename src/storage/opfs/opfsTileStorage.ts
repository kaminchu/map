import { StorageUnavailableError } from "../../lib/errors";
import { tilePath } from "../../tiles/tileKey";
import type { TileBinaryStorage } from "../../tiles/TileRepository";
import type { TileCoordinate } from "../../tiles/types";

interface OpfsDirectory {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectory>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFile>;
  removeEntry(name: string): Promise<void>;
}
interface OpfsFile {
  getFile(): Promise<File>;
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<{ write(data: ArrayBuffer): Promise<void>; close(): Promise<void> }>;
}

function rootDirectory(): Promise<OpfsDirectory> {
  const storage = navigator.storage as StorageManager & {
    getDirectory?: () => Promise<OpfsDirectory>;
  };
  if (!storage.getDirectory) return Promise.reject(new StorageUnavailableError());
  return storage.getDirectory();
}

async function fileHandle(tile: TileCoordinate, create: boolean): Promise<OpfsFile> {
  const path = tilePath(tile);
  let directory = await rootDirectory();
  for (const segment of path.slice(0, -1))
    directory = await directory.getDirectoryHandle(segment, { create });
  return directory.getFileHandle(path.at(-1) ?? "", { create });
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === "NotFoundError";
}

export const opfsTileStorage: TileBinaryStorage = {
  isSupported: () =>
    typeof navigator !== "undefined" && typeof navigator.storage?.getDirectory === "function",
  async read(tile) {
    if (!this.isSupported()) throw new StorageUnavailableError();
    try {
      const file = await (await fileHandle(tile, false)).getFile();
      return file.arrayBuffer();
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  },
  async write(tile, data) {
    if (!this.isSupported()) throw new StorageUnavailableError();
    const writable = await (
      await fileHandle(tile, true)
    ).createWritable({ keepExistingData: false });
    await writable.write(data);
    await writable.close();
  },
  async exists(tile) {
    if (!this.isSupported()) return false;
    try {
      await fileHandle(tile, false);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  },
  async delete(tile) {
    if (!this.isSupported()) return;
    try {
      const path = tilePath(tile);
      let directory = await rootDirectory();
      for (const segment of path.slice(0, -1))
        directory = await directory.getDirectoryHandle(segment);
      await directory.removeEntry(path.at(-1) ?? "");
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  },
};
