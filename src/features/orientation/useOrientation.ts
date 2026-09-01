import { useCallback, useEffect, useRef } from "react";
import { useOrientationStore } from "../../stores/orientationStore";
import {
  orientationHeading,
  orientationSupported,
  requestOrientationPermission,
  type OrientationEventWithCompass,
} from "./deviceOrientation";

export function useOrientation(): { enable: () => Promise<void>; disable: () => void } {
  const set = useOrientationStore((state) => state.set);
  const reset = useOrientationStore((state) => state.reset);
  const handlerRef = useRef<((event: Event) => void) | undefined>(undefined);
  const enabledRef = useRef(false);
  const absoluteRef = useRef(false);
  const removeListeners = useCallback(() => {
    const handler = handlerRef.current;
    if (handler) {
      window.removeEventListener("deviceorientationabsolute", handler);
      window.removeEventListener("deviceorientation", handler);
    }
    handlerRef.current = undefined;
    absoluteRef.current = false;
  }, []);
  const enable = useCallback(async () => {
    if (enabledRef.current) return;
    enabledRef.current = true;
    if (!orientationSupported()) {
      enabledRef.current = false;
      set({ status: "unavailable" });
      return;
    }
    set({ status: "requesting" });
    let permission: "granted" | "denied" | "unsupported";
    try {
      permission = await requestOrientationPermission();
    } catch {
      permission = "denied";
    }
    if (!enabledRef.current) return;
    if (permission !== "granted") {
      enabledRef.current = false;
      set({ status: permission === "unsupported" ? "unavailable" : "denied" });
      return;
    }
    const handler = (event: Event) => {
      const orientation = event as OrientationEventWithCompass;
      const absolute = event.type === "deviceorientationabsolute" || orientation.absolute === true;
      if (absolute) absoluteRef.current = true;
      if (!absolute && absoluteRef.current) return;
      const heading = orientationHeading(orientation, absolute);
      if (heading !== undefined) set({ status: "available", heading, absolute });
    };
    window.addEventListener("deviceorientationabsolute", handler);
    window.addEventListener("deviceorientation", handler);
    handlerRef.current = handler;
  }, [set]);
  const disable = useCallback(() => {
    enabledRef.current = false;
    removeListeners();
    reset();
  }, [removeListeners, reset]);
  useEffect(
    () => () => {
      enabledRef.current = false;
      removeListeners();
    },
    [removeListeners],
  );
  return { enable, disable };
}
