const enabled = import.meta.env?.DEV ?? false;

export const logger = {
  debug(...values: unknown[]) {
    if (enabled) console.debug("[offline-map]", ...values);
  },
  info(...values: unknown[]) {
    if (enabled) console.info("[offline-map]", ...values);
  },
  warn(...values: unknown[]) {
    if (enabled) console.warn("[offline-map]", ...values);
  },
  error(...values: unknown[]) {
    if (enabled) console.error("[offline-map]", ...values);
  },
};
