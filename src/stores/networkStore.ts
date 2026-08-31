import { create } from "zustand";

export const useNetworkStore = create<{ online: boolean; setOnline: (online: boolean) => void }>(
  (set) => ({
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    setOnline: (online) => set({ online }),
  }),
);
