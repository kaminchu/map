import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useOrientationStore } from "../../stores/orientationStore";
import { useOrientation } from "./useOrientation";

describe("useOrientation", () => {
  const originalDeviceOrientationEvent = Object.getOwnPropertyDescriptor(
    window,
    "DeviceOrientationEvent",
  );

  beforeEach(() => {
    Object.defineProperty(window, "DeviceOrientationEvent", {
      configurable: true,
      value: class DeviceOrientationEvent extends Event {},
    });
    useOrientationStore.setState({ status: "idle", heading: undefined, absolute: false });
  });

  afterEach(() => {
    cleanup();
    if (originalDeviceOrientationEvent) {
      Object.defineProperty(window, "DeviceOrientationEvent", originalDeviceOrientationEvent);
    } else {
      Reflect.deleteProperty(window, "DeviceOrientationEvent");
    }
  });

  it("stops reporting headings after orientation mode is disabled", async () => {
    const { result } = renderHook(() => useOrientation());

    await act(async () => result.current.enable());
    const firstEvent = new Event("deviceorientationabsolute");
    Object.assign(firstEvent, { absolute: true, alpha: 270 });
    act(() => window.dispatchEvent(firstEvent));
    expect(useOrientationStore.getState()).toMatchObject({ status: "available", heading: 90 });

    act(() => result.current.disable());
    expect(useOrientationStore.getState()).toMatchObject({ status: "idle", heading: undefined });

    const secondEvent = new Event("deviceorientationabsolute");
    Object.assign(secondEvent, { absolute: true, alpha: 180 });
    act(() => window.dispatchEvent(secondEvent));
    expect(useOrientationStore.getState()).toMatchObject({ status: "idle", heading: undefined });
  });
});
