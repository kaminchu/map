import { create } from "zustand";

export type OrientationStatus = "idle" | "requesting" | "available" | "denied" | "unavailable";
export interface OrientationState {
  status: OrientationStatus;
  heading?: number;
  absolute: boolean;
  set: (state: Partial<OrientationState>) => void;
  reset: () => void;
}

export const useOrientationStore = create<OrientationState>((set) => ({
  status: "idle",
  absolute: false,
  set: (state) => set(state),
  reset: () => set({ status: "idle", heading: undefined, absolute: false }),
}));
