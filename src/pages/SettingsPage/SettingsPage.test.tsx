import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../features/storage/useStorageStatistics", () => ({
  useStorageStatistics: () => ({ data: undefined, error: undefined, mutate: vi.fn() }),
}));

vi.mock("../../features/storage/storageService", () => ({
  clearTemporaryCache: vi.fn(),
  isTilePersistenceSupported: vi.fn(() => true),
  requestPersistentStorage: vi.fn(),
}));

describe("SettingsPage", () => {
  afterEach(cleanup);

  it("shows the app version, build time, and commit hash", () => {
    render(<SettingsPage />);

    expect(screen.getByText("バージョン情報")).toBeInTheDocument();
    expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument();
    expect(screen.getByText(__BUILD_TIME__)).toBeInTheDocument();
    expect(screen.getByText(__COMMIT_HASH__)).toBeInTheDocument();
  });
});
