import { create } from "zustand";

export interface CameraState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}
interface MapState extends CameraState {
  setCamera: (camera: Partial<CameraState>) => void;
}

export const useMapStore = create<MapState>((set) => ({
  longitude: 138,
  latitude: 37,
  zoom: 5,
  bearing: 0,
  pitch: 0,
  setCamera: (camera) => set(camera),
}));
