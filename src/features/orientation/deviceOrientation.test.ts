import { describe, expect, it } from "vitest";
import { orientationHeading } from "./deviceOrientation";

describe("device orientation", () => {
  it("uses the iOS compass heading when available", () => {
    expect(
      orientationHeading(
        { alpha: 10, webkitCompassHeading: 270 } as DeviceOrientationEvent & {
          webkitCompassHeading: number;
        },
        false,
      ),
    ).toBe(270);
  });
  it("converts an absolute alpha to a compass heading", () => {
    expect(orientationHeading({ alpha: 90 } as DeviceOrientationEvent, true)).toBe(270);
    expect(
      orientationHeading({ alpha: Number.NaN } as DeviceOrientationEvent, true),
    ).toBeUndefined();
  });
});
