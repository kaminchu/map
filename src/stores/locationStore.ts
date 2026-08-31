import { create } from "zustand";

export type LocationStatus = "idle" | "requesting" | "available" | "denied" | "unavailable";
export interface LocationState {
  status: LocationStatus;
  tracking: boolean;
  longitude?: number;
  latitude?: number;
  accuracy?: number;
  gpsHeading?: number | null;
  speed?: number | null;
  timestamp?: number;
  set: (state: Partial<LocationState>) => void;
  reset: () => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  status: "idle",
  tracking: false,
  set: (state) => set(state),
  reset: () => set({ status: "idle", tracking: false }),
}));
