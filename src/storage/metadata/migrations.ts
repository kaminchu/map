import type { StoreName } from "./database";

export const METADATA_STORES: readonly StoreName[] = [
  "tiles",
  "offlineAreas",
  "offlineAreaTiles",
  "downloadJobs",
  "settings",
];

/** Schema changes belong in the IndexedDB `onupgradeneeded` handler. */
export const INITIAL_DATABASE_VERSION = 1;
