import { useEffect, useRef } from "react";
import { useLocationStore } from "../../stores/locationStore";

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 15_000,
};

export function geolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

export function positionErrorStatus(error: GeolocationPositionError): "denied" | "unavailable" {
  return error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
}

export function useLocationTracking(): { start: () => void; stop: () => void } {
  const set = useLocationStore((state) => state.set);
  const watchId = useRef<number | undefined>(undefined);
  const start = () => {
    if (!geolocationSupported() || watchId.current !== undefined) {
      if (!geolocationSupported()) set({ status: "unavailable", tracking: false });
      return;
    }
    set({ status: "requesting", tracking: true });
    try {
      watchId.current = navigator.geolocation.watchPosition(
        (position) =>
          set({
            status: "available",
            tracking: true,
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            accuracy: position.coords.accuracy,
            gpsHeading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          }),
        (error) => {
          watchId.current = undefined;
          set({ status: positionErrorStatus(error), tracking: false });
        },
        GEOLOCATION_OPTIONS,
      );
    } catch {
      watchId.current = undefined;
      set({ status: "unavailable", tracking: false });
    }
  };
  const stop = () => {
    if (watchId.current !== undefined) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = undefined;
    set({ tracking: false });
  };
  useEffect(() => stop, []);
  return { start, stop };
}
