import { useEffect } from "react";
import { useNetworkStore } from "../stores/networkStore";

export function useNetworkEvents(): void {
  const setOnline = useNetworkStore((state) => state.setOnline);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [setOnline]);
}
