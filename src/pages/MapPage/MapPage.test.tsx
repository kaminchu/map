import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMapStore } from "../../stores/mapStore";
import { useUiStore } from "../../stores/uiStore";
import { MapPage } from "./MapPage";

const map = vi.hoisted(() => ({
  getBounds: vi.fn(() => ({
    getWest: () => 139,
    getSouth: () => 35,
    getEast: () => 140,
    getNorth: () => 36,
  })),
  getZoom: vi.fn(() => 7.6),
  remove: vi.fn(),
}));
const createMap = vi.hoisted(() => vi.fn());

vi.mock("../../map/createMap", () => ({ createMap }));
vi.mock("../../features/storage/storageService", () => ({
  getStorageEstimate: vi.fn(() => Promise.resolve({})),
  isTilePersistenceSupported: vi.fn(() => true),
  requestPersistentStorage: vi.fn(() => Promise.resolve()),
}));

describe("MapPage", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    useMapStore.setState({ longitude: 138, latitude: 37, zoom: 5, bearing: 0, pitch: 0 });
    useUiStore.setState({ dialog: undefined });
    createMap.mockReturnValue(map);
  });

  it("shows the current zoom level and updates it after map movement", () => {
    render(<MapPage />);

    expect(screen.getByText("ズーム 5.0")).toBeInTheDocument();

    const options = createMap.mock.calls[0]?.[0];
    if (!options) throw new Error("Map was not created");
    const onMoveEnd = options.onMoveEnd;
    act(() => {
      onMoveEnd({ longitude: 139, latitude: 35, zoom: 8.4, bearing: 0, pitch: 0 });
    });

    expect(screen.getByText("ズーム 8.4")).toBeInTheDocument();
  });

  it("defaults both save zoom fields to the current zoom and can select the full range", async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    await user.click(screen.getByRole("button", { name: "表示範囲を保存" }));

    expect(screen.getByText("保存可能なズームレベル: 0〜18")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "最小ズーム" })).toHaveValue(7);
    expect(screen.getByRole("spinbutton", { name: "最大ズーム" })).toHaveValue(7);

    await user.click(screen.getByRole("button", { name: "全ズームを選択" }));

    expect(screen.getByRole("spinbutton", { name: "最小ズーム" })).toHaveValue(0);
    expect(screen.getByRole("spinbutton", { name: "最大ズーム" })).toHaveValue(18);
  });
});
