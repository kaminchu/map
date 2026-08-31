import { create } from "zustand";
import { DEFAULT_CACHE_LIMIT_BYTES } from "../tiles/tileGarbageCollector";

interface SettingsState {
  cacheLimitBytes: number;
  loaded: boolean;
  setCacheLimit: (value: number) => void;
  setLoaded: (loaded: boolean) => void;
}
export const useSettingsStore = create<SettingsState>((set) => ({
  cacheLimitBytes: DEFAULT_CACHE_LIMIT_BYTES,
  loaded: false,
  setCacheLimit: (cacheLimitBytes) => set({ cacheLimitBytes }),
  setLoaded: (loaded) => set({ loaded }),
}));
