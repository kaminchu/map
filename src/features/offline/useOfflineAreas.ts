import { useEffect } from "react";
import { downloadManager } from "./downloadManager";
import { offlineAreaRepository } from "../../storage/metadata/offlineAreaRepository";
import { useOfflineStore } from "../../stores/offlineStore";

export function useOfflineAreas(): void {
  const setAreas = useOfflineStore((state) => state.setAreas);
  const setLoading = useOfflineStore((state) => state.setLoading);
  const setError = useOfflineStore((state) => state.setError);
  const updateArea = useOfflineStore((state) => state.updateArea);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const unsubscribe = downloadManager.subscribe((area) => {
      if (mounted) updateArea(area);
    });
    void offlineAreaRepository
      .list()
      .then((areas) => {
        if (mounted) setAreas(areas);
      })
      .catch(() => {
        if (mounted) setError("保存地図を読み込めませんでした。");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setAreas, setError, setLoading, updateArea]);
}
