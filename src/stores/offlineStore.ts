import { create } from "zustand";
import type { OfflineArea, OfflineAreaStatus } from "../storage/metadata/database";

export interface AreaSummary extends OfflineArea {
  progress: number;
}
interface OfflineState {
  areas: AreaSummary[];
  activeAreaId?: string;
  loading: boolean;
  error?: string;
  setAreas: (areas: OfflineArea[]) => void;
  updateArea: (area: OfflineArea) => void;
  removeArea: (id: string) => void;
  setActiveArea: (id?: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error?: string) => void;
}

function summary(area: OfflineArea): AreaSummary {
  return {
    ...area,
    progress:
      area.tileCount === 0 ? 0 : Math.round((area.downloadedTileCount / area.tileCount) * 100),
  };
}

export const useOfflineStore = create<OfflineState>((set) => ({
  areas: [],
  loading: false,
  setAreas: (areas) => set({ areas: areas.map(summary) }),
  updateArea: (area) =>
    set((state) => ({
      areas: [summary(area), ...state.areas.filter((item) => item.id !== area.id)].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    })),
  removeArea: (id) => set((state) => ({ areas: state.areas.filter((area) => area.id !== id) })),
  setActiveArea: (activeAreaId) => set({ activeAreaId }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));

export function statusLabel(status: OfflineAreaStatus): string {
  return {
    pending: "待機中",
    downloading: "保存中",
    completed: "完了",
    paused: "一時停止",
    error: "エラー",
  }[status];
}
