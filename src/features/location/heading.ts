export type HeadingSource = "gps" | "orientation";
export interface HeadingInput {
  gpsHeading?: number | null;
  speed?: number | null;
  orientationHeading?: number;
}
export type HeadingResult = { heading: number; source: HeadingSource } | undefined;

export function resolveHeading(input: HeadingInput): HeadingResult {
  if (
    typeof input.gpsHeading === "number" &&
    Number.isFinite(input.gpsHeading) &&
    typeof input.speed === "number" &&
    input.speed >= 1
  )
    return { heading: ((input.gpsHeading % 360) + 360) % 360, source: "gps" };
  if (typeof input.orientationHeading === "number" && Number.isFinite(input.orientationHeading))
    return { heading: ((input.orientationHeading % 360) + 360) % 360, source: "orientation" };
  return undefined;
}
