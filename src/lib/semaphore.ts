import { isAbortError } from "./errors";

interface Waiter {
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
}

export class Semaphore {
  private available: number;
  private readonly waiters: Waiter[] = [];

  constructor(private readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1)
      throw new Error("Semaphore capacity must be positive");
    this.available = capacity;
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }

    return new Promise((resolve, reject) => {
      let removeAbort: () => void = () => undefined;
      const waiter: Waiter = {
        resolve: () => {
          removeAbort();
          resolve(() => this.release());
        },
        reject: (error) => {
          removeAbort();
          reject(error);
        },
        signal,
      };
      const onAbort = () => {
        const index = this.waiters.indexOf(waiter);
        if (index >= 0) this.waiters.splice(index, 1);
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      };
      if (signal) {
        removeAbort = () => signal.removeEventListener("abort", onAbort);
        signal.addEventListener("abort", onAbort, { once: true });
      }
      this.waiters.push(waiter);
    });
  }

  private release(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      if (waiter.signal?.aborted) {
        waiter.reject(waiter.signal.reason ?? new DOMException("Aborted", "AbortError"));
        this.release();
      } else {
        waiter.resolve();
      }
      return;
    }
    this.available = Math.min(this.capacity, this.available + 1);
  }
}

export function isAbortLike(error: unknown): boolean {
  return isAbortError(error) || (error instanceof DOMException && error.name === "AbortError");
}
