import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const requestPersistentStorage = vi.hoisted(() => vi.fn(() => Promise.resolve("granted")));

vi.mock("../hooks/useNetworkEvents", () => ({ useNetworkEvents: vi.fn() }));
vi.mock("../components/AppNavigation/AppNavigation", () => ({ AppNavigation: () => null }));
vi.mock("../components/Toast/Toast", () => ({ Toasts: () => null }));
vi.mock("./routes", () => ({ AppRoutes: () => null }));
vi.mock("../features/storage/storageService", () => ({ requestPersistentStorage }));
vi.mock("../storage/metadata/offlineAreaRepository", () => ({
  offlineAreaRepository: {
    pauseDownloadingAreas: vi.fn(() => Promise.resolve()),
    list: vi.fn(() => Promise.resolve([])),
  },
}));
vi.mock("../storage/metadata/settingsRepository", () => ({
  settingsRepository: {
    get: vi.fn(() => Promise.resolve({ cacheLimitBytes: 1024 })),
  },
}));

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("requests persistent storage automatically on startup", async () => {
    render(<App />);

    await waitFor(() => expect(requestPersistentStorage).toHaveBeenCalledOnce());
  });
});
