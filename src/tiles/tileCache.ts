import type { TileKey } from "./types";

export class TileKeyLock {
  private readonly locks = new Map<TileKey, Promise<void>>();

  async run<T>(key: TileKey, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.locks.set(key, tail);
    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.locks.get(key) === tail) this.locks.delete(key);
    }
  }
}

export const tileKeyLock = new TileKeyLock();
