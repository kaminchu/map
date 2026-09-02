import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocationStore } from "../../stores/locationStore";
import { useMapStore } from "../../stores/mapStore";
import { useOrientationStore } from "../../stores/orientationStore";
import { useUiStore } from "../../stores/uiStore";
import { MapPage } from "./MapPage";

const locationTracking = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
const orientationTracking = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn() }));
const map = vi.hoisted(() => ({
  getBounds: vi.fn(() => ({
    getWest: () => 139,
    getSouth: () => 35,
    getEast: () => 140,
    getNorth: () => 36,
  })),
  getZoom: vi.fn(() => 7.6),
  getSource: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  once: vi.fn(),
  jumpTo: vi.fn(),
  setCenter: vi.fn(),
  remove: vi.fn(),
}));
const createMap = vi.hoisted(() => vi.fn());

vi.mock("../../map/createMap", () => ({ createMap }));
vi.mock("../../features/location/geolocation", () => ({
  useLocationTracking: () => locationTracking,
}));
vi.mock("../../features/orientation/useOrientation", () => ({
  useOrientation: () => orientationTracking,
}));
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
    useLocationStore.setState({
      status: "idle",
      tracking: false,
      longitude: undefined,
      latitude: undefined,
      accuracy: undefined,
      gpsHeading: undefined,
      speed: undefined,
      timestamp: undefined,
    });
    useOrientationStore.setState({ status: "idle", heading: undefined, absolute: false });
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

  it("allows clearing a zoom field and reports the validation error when saving", async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    await user.click(screen.getByRole("button", { name: "表示範囲を保存" }));
    await user.clear(screen.getByRole("spinbutton", { name: "最大ズーム" }));

    expect(screen.getByRole("spinbutton", { name: "最大ズーム" })).toHaveValue(null);
    expect(screen.getByText("推定容量:").parentElement).toHaveTextContent("計算できません");

    await user.click(screen.getByRole("button", { name: "保存を開始" }));

    expect(
      screen.getByText(
        "ズームは0〜18の整数で、最小ズームが最大ズーム以下になるよう入力してください。",
      ),
    ).toBeInTheDocument();
  });

  it("follows location updates until the current-location button is pressed again", async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    expect(locationTracking.start).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "現在地の追従を無効にする" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    act(() => {
      useLocationStore.setState({
        status: "available",
        tracking: true,
        longitude: 139.1,
        latitude: 35.1,
      });
    });
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [139.1, 35.1], zoom: 14 });

    act(() => {
      useLocationStore.setState({ longitude: 139.2, latitude: 35.2 });
    });
    expect(map.setCenter).toHaveBeenLastCalledWith([139.2, 35.2]);

    await user.click(screen.getByRole("button", { name: "現在地の追従を無効にする" }));
    expect(locationTracking.stop).toHaveBeenCalledOnce();
    const centerCalls = map.setCenter.mock.calls.length;
    act(() => {
      useLocationStore.setState({ longitude: 139.3, latitude: 35.3 });
    });
    expect(map.setCenter).toHaveBeenCalledTimes(centerCalls);

    map.getZoom.mockReturnValueOnce(16);
    await user.click(screen.getByRole("button", { name: "現在地の追従を有効にする" }));
    expect(map.jumpTo).toHaveBeenLastCalledWith({ center: [139.3, 35.3], zoom: 14 });
    act(() => {
      useLocationStore.setState({ longitude: 139.4, latitude: 35.4 });
    });
    expect(map.setCenter).toHaveBeenLastCalledWith([139.4, 35.4]);
  });

  it("turns off location mode when the user moves the map", () => {
    render(<MapPage />);
    const options = createMap.mock.calls[0]?.[0];
    if (!options) throw new Error("Map was not created");

    act(() => options.onUserMove());

    expect(screen.getByRole("button", { name: "現在地の追従を有効にする" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(locationTracking.stop).toHaveBeenCalledOnce();
  });

  it("toggles orientation mode and displays the heading while enabled", async () => {
    orientationTracking.enable.mockImplementation(async () => {
      useOrientationStore.setState({ status: "available", heading: 123, absolute: true });
    });
    orientationTracking.disable.mockImplementation(() => {
      useOrientationStore.getState().reset();
    });
    const user = userEvent.setup();
    render(<MapPage />);

    await user.click(screen.getByRole("button", { name: "方角を有効にする" }));
    expect(orientationTracking.enable).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "方角を無効にする" })).toHaveTextContent("123°");

    await user.click(screen.getByRole("button", { name: "方角を無効にする" }));
    expect(orientationTracking.disable).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "方角を有効にする" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
