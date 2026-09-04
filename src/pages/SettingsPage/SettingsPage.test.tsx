import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";

vi.mock("../../features/storage/useStorageStatistics", () => ({
  useStorageStatistics: () => ({ data: undefined, error: undefined, mutate: vi.fn() }),
}));

vi.mock("../../features/storage/storageService", () => ({
  clearTemporaryCache: vi.fn(),
  isTilePersistenceSupported: vi.fn(() => true),
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

  it("does not show a manual storage protection button", () => {
    render(<SettingsPage />);

    expect(screen.queryByRole("button", { name: "ストレージを保護" })).not.toBeInTheDocument();
  });

  it("shows storage protection in the statistics and explains each status", async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    expect(screen.getByText("ストレージ保護")).toBeInTheDocument();
    expect(screen.getAllByText("読み込み中…")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "ストレージ保護について" }));

    expect(screen.getByRole("heading", { name: "ストレージ保護について" })).toBeInTheDocument();
    expect(screen.getByText("有効")).toBeInTheDocument();
    expect(screen.getByText("未保証")).toBeInTheDocument();
    expect(screen.getByText("非対応")).toBeInTheDocument();
  });
});
