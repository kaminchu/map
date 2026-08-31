export type OrientationEventWithCompass = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

export function orientationSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

export function orientationHeading(
  event: OrientationEventWithCompass,
  absolute: boolean,
): number | undefined {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading))
    return event.webkitCompassHeading;
  if (!absolute || typeof event.alpha !== "number" || !Number.isFinite(event.alpha))
    return undefined;
  return (360 - event.alpha + 360) % 360;
}

export async function requestOrientationPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (!orientationSupported()) return "unsupported";
  const eventType = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<PermissionState>;
  };
  if (typeof eventType.requestPermission === "function")
    return (await eventType.requestPermission()) === "granted" ? "granted" : "denied";
  return "granted";
}
