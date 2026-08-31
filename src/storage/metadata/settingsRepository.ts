import { parseSettings } from "../../schemas/settingsSchema";
import { DEFAULT_CACHE_LIMIT_BYTES } from "../../tiles/tileGarbageCollector";
import { openDatabase, requestResult, withTransaction, type SettingsRecord } from "./database";

export const settingsRepository = {
  async get(): Promise<SettingsRecord> {
    const db = await openDatabase();
    const tx = db.transaction("settings", "readonly");
    const value = parseSettings(await requestResult(tx.objectStore("settings").get("settings")));
    return value ?? { key: "settings", cacheLimitBytes: DEFAULT_CACHE_LIMIT_BYTES };
  },
  async put(value: SettingsRecord): Promise<void> {
    await withTransaction("settings", "readwrite", (tx) => {
      tx.objectStore("settings").put(value);
    });
  },
};
