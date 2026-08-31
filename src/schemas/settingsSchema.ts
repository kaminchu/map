import { z } from "zod/mini";
import type { SettingsRecord } from "../storage/metadata/database";

const settingsShape = z.object({ key: z.literal("settings"), cacheLimitBytes: z.number() });

export function parseSettings(value: unknown): SettingsRecord | undefined {
  const result = settingsShape.safeParse(value);
  return result.success ? (result.data as SettingsRecord) : undefined;
}
