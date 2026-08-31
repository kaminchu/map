import { useEffect } from "react";
import { useNetworkEvents } from "../hooks/useNetworkEvents";
import { AppNavigation } from "../components/AppNavigation/AppNavigation";
import { Toasts } from "../components/Toast/Toast";
import { AppRoutes } from "./routes";
import { offlineAreaRepository } from "../storage/metadata/offlineAreaRepository";
import { settingsRepository } from "../storage/metadata/settingsRepository";
import { useOfflineStore } from "../stores/offlineStore";
import { useSettingsStore } from "../stores/settingsStore";

export function App() {
  useNetworkEvents();
  const setAreas = useOfflineStore((state) => state.setAreas);
  const setCacheLimit = useSettingsStore((state) => state.setCacheLimit);
  const setLoaded = useSettingsStore((state) => state.setLoaded);
  useEffect(() => {
    void offlineAreaRepository
      .pauseDownloadingAreas()
      .then(() => offlineAreaRepository.list())
      .then(setAreas)
      .catch(() => undefined);
    void settingsRepository
      .get()
      .then((settings) => {
        setCacheLimit(settings.cacheLimitBytes);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [setAreas, setCacheLimit, setLoaded]);
  return (
    <>
      <AppRoutes />
      <AppNavigation />
      <Toasts />
    </>
  );
}
