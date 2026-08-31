import { describe, expect, it } from "vitest";
import { resolveHeading } from "./heading";

describe("heading selection", () => {
  it("prioritizes moving GPS heading", () => {
    expect(resolveHeading({ gpsHeading: 10, speed: 1, orientationHeading: 20 })).toEqual({
      heading: 10,
      source: "gps",
    });
  });
  it("uses orientation while stationary", () => {
    expect(resolveHeading({ gpsHeading: 10, speed: 0, orientationHeading: 20 })).toEqual({
      heading: 20,
      source: "orientation",
    });
  });
  it("keeps zero and rejects invalid values", () => {
    expect(resolveHeading({ orientationHeading: 0 })).toEqual({
      heading: 0,
      source: "orientation",
    });
    expect(resolveHeading({ orientationHeading: Number.NaN })).toBeUndefined();
    expect(resolveHeading({ orientationHeading: Number.POSITIVE_INFINITY })).toBeUndefined();
  });
});
