import { useEffect, useRef, useState } from "react";
import type { Map } from "maplibre-gl";
import { useShallow } from "zustand/react/shallow";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { UnsupportedNotice } from "../../components/UnsupportedNotice/UnsupportedNotice";
import { useLocationTracking } from "../../features/location/geolocation";
import { resolveHeading } from "../../features/location/heading";
import { createOfflineArea, defaultAreaName } from "../../features/offline/offlineAreaService";
import { downloadManager } from "../../features/offline/downloadManager";
import {
  getStorageEstimate,
  isTilePersistenceSupported,
  requestPersistentStorage,
} from "../../features/storage/storageService";
import { countTilesForBounds, type GeoBounds } from "../../tiles/tileMath";
import { DEFAULT_ESTIMATED_TILE_BYTES } from "../../tiles/types";
import { useLocationStore } from "../../stores/locationStore";
import { useMapStore } from "../../stores/mapStore";
import { useNetworkStore } from "../../stores/networkStore";
import { useOrientationStore } from "../../stores/orientationStore";
import { useUiStore } from "../../stores/uiStore";
import { createMap } from "../../map/createMap";
import { updateLocationLayers } from "../../map/locationLayers";
import { STD_TILE_SOURCE } from "../../map/tileSources";
import { useOrientation } from "../../features/orientation/useOrientation";
import styles from "./MapPage.module.css";

function boundsFromMap(map: Map): GeoBounds {
  const bounds = map.getBounds();
  return {
    west: bounds.getWest(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    north: bounds.getNorth(),
  };
}

export function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | undefined>(undefined);
  const centeredRef = useRef(false);
  const camera = useMapStore(
    useShallow((state) => ({
      longitude: state.longitude,
      latitude: state.latitude,
      zoom: state.zoom,
      bearing: state.bearing,
      pitch: state.pitch,
    })),
  );
  const setCamera = useMapStore((state) => state.setCamera);
  const location = useLocationStore();
  const orientation = useOrientationStore();
  const online = useNetworkStore((state) => state.online);
  const setDialog = useUiStore((state) => state.setDialog);
  const { start } = useLocationTracking();
  const { enable } = useOrientation();
  const [snapshot, setSnapshot] = useState<{ bounds: GeoBounds; zoom: number }>();

  useEffect(() => {
    if (!containerRef.current) return;
    const map = createMap({
      container: containerRef.current,
      camera,
      onMoveEnd: (next) => setCamera(next),
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || location.longitude === undefined || location.latitude === undefined) return;
    const heading = resolveHeading({
      gpsHeading: location.gpsHeading,
      speed: location.speed,
      orientationHeading: orientation.heading,
    })?.heading;
    const update = () =>
      updateLocationLayers(map, {
        longitude: location.longitude,
        latitude: location.latitude,
        accuracy: location.accuracy,
        heading,
      });
    if (map.isStyleLoaded()) update();
    else map.once("load", update);
    if (location.status === "available" && !centeredRef.current) {
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: Math.max(map.getZoom(), 14),
      });
      centeredRef.current = true;
    }
  }, [
    location.longitude,
    location.latitude,
    location.accuracy,
    location.gpsHeading,
    location.speed,
    location.status,
    orientation.heading,
  ]);

  const locate = () => {
    const map = mapRef.current;
    if (
      location.status === "available" &&
      location.longitude !== undefined &&
      location.latitude !== undefined &&
      map
    ) {
      map.flyTo({
        center: [location.longitude, location.latitude],
        zoom: Math.max(map.getZoom(), 14),
      });
      centeredRef.current = true;
      return;
    }
    centeredRef.current = false;
    start();
  };
  const saveVisibleArea = () => {
    if (!mapRef.current) return;
    setSnapshot({ bounds: boundsFromMap(mapRef.current), zoom: mapRef.current.getZoom() });
    setDialog("create-area");
  };
  const openOrientation = () => {
    void enable();
  };

  return (
    <main className={styles.page}>
      <div ref={containerRef} className={styles.map} aria-label="国土地理院の地図" />
      <div className={styles.statuses}>
        {!online && <span className={styles.badge}>オフライン</span>}
        {!isTilePersistenceSupported() && (
          <UnsupportedNotice>
            保存地図はこのブラウザーでは利用できません。オンライン地図は表示できます。
          </UnsupportedNotice>
        )}
      </div>
      <div className={styles.zoomLevel} aria-live="polite">
        ズーム {camera.zoom.toFixed(1)}
      </div>
      <div className={styles.controls} aria-label="地図操作">
        <Button
          className={styles.controlButton}
          variant="secondary"
          aria-label="現在地を表示"
          onClick={locate}
        >
          ◎<span>現在地</span>
        </Button>
        <Button
          className={styles.controlButton}
          variant="secondary"
          aria-label="方角を有効にする"
          onClick={openOrientation}
        >
          ➤
          <span>
            {orientation.status === "available"
              ? `${Math.round(orientation.heading ?? 0)}°`
              : "方角"}
          </span>
        </Button>
        <Button
          className={styles.controlButton}
          variant="primary"
          aria-label="表示範囲を保存"
          onClick={saveVisibleArea}
          disabled={!isTilePersistenceSupported()}
        >
          ＋<span>範囲を保存</span>
        </Button>
      </div>
      {(location.status === "denied" || location.status === "unavailable") && (
        <div className={styles.inlineMessage}>
          {location.status === "denied"
            ? "現在地の利用が許可されていません。ブラウザー設定から許可してください。"
            : "現在地を取得できません。"}
        </div>
      )}
      {(orientation.status === "denied" || orientation.status === "unavailable") && (
        <div className={styles.inlineMessage}>
          {orientation.status === "denied"
            ? "方角の利用が許可されていません。ブラウザー設定から許可してください。"
            : "この端末では方角を利用できません。"}
        </div>
      )}
      <CreateAreaDialog
        snapshot={snapshot}
        onCreated={(areaId) => {
          setDialog(undefined);
          void downloadManager.start(areaId);
        }}
        onClose={() => setDialog(undefined)}
      />
    </main>
  );
}

function CreateAreaDialog({
  snapshot,
  onCreated,
  onClose,
}: {
  snapshot?: { bounds: GeoBounds; zoom: number };
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const open = useUiStore((state) => state.dialog === "create-area");
  const [name, setName] = useState(defaultAreaName());
  const [minZoom, setMinZoom] = useState(5);
  const [maxZoom, setMaxZoom] = useState(7);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number }>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open || !snapshot) return;
    const currentZoom = Math.min(
      STD_TILE_SOURCE.maxZoom,
      Math.max(STD_TILE_SOURCE.minZoom, Math.floor(snapshot.zoom)),
    );
    setName(defaultAreaName());
    setMinZoom(currentZoom);
    setMaxZoom(currentZoom);
    setError("");
    void getStorageEstimate()
      .then(setEstimate)
      .catch(() => setEstimate(undefined));
  }, [open, snapshot]);
  const tileCount = snapshot ? countTilesForBounds(snapshot.bounds, minZoom, maxZoom) : 0;
  const bytes = tileCount * DEFAULT_ESTIMATED_TILE_BYTES;
  const available =
    estimate?.quota === undefined ? undefined : Math.max(0, estimate.quota - (estimate.usage ?? 0));
  const invalid =
    name.trim().length < 1 ||
    name.trim().length > 50 ||
    !Number.isInteger(minZoom) ||
    !Number.isInteger(maxZoom) ||
    minZoom < STD_TILE_SOURCE.minZoom ||
    maxZoom > STD_TILE_SOURCE.maxZoom ||
    minZoom > maxZoom ||
    tileCount === 0 ||
    (available !== undefined && bytes > available);
  const submit = async () => {
    if (!snapshot || invalid) return;
    setSaving(true);
    setError("");
    try {
      await requestPersistentStorage();
      const area = await createOfflineArea({
        id: crypto.randomUUID(),
        name,
        bounds: snapshot.bounds,
        minZoom,
        maxZoom,
        estimatedBytes: bytes,
      });
      onCreated(area.id);
    } catch {
      setError("保存地図の作成に失敗しました。範囲を小さくして再度お試しください。");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      open={open}
      title="表示範囲を保存"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>キャンセル</Button>
          <Button variant="primary" disabled={invalid || saving} onClick={() => void submit()}>
            {saving ? "作成中…" : "保存を開始"}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <label>
          名前
          <input value={name} maxLength={50} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className={styles.readonly}>
          <strong>表示範囲</strong>
          <span>
            {snapshot
              ? `${snapshot.bounds.west.toFixed(4)}, ${snapshot.bounds.south.toFixed(4)} ～ ${snapshot.bounds.east.toFixed(4)}, ${snapshot.bounds.north.toFixed(4)}`
              : "未取得"}
          </span>
        </div>
        <div className={styles.zoomFields}>
          <label>
            最小ズーム
            <input
              type="number"
              min={STD_TILE_SOURCE.minZoom}
              max={STD_TILE_SOURCE.maxZoom}
              step={1}
              value={minZoom}
              onChange={(event) => setMinZoom(Number(event.target.value))}
            />
          </label>
          <label>
            最大ズーム
            <input
              type="number"
              min={STD_TILE_SOURCE.minZoom}
              max={STD_TILE_SOURCE.maxZoom}
              step={1}
              value={maxZoom}
              onChange={(event) => setMaxZoom(Number(event.target.value))}
            />
          </label>
        </div>
        <div className={styles.zoomRange}>
          <span>
            保存可能なズームレベル: {STD_TILE_SOURCE.minZoom}〜{STD_TILE_SOURCE.maxZoom}
          </span>
          <Button
            type="button"
            variant="ghost"
            className={styles.allZoomButton}
            aria-label="全ズームを選択"
            onClick={() => {
              setMinZoom(STD_TILE_SOURCE.minZoom);
              setMaxZoom(STD_TILE_SOURCE.maxZoom);
            }}
          >
            全ズーム
          </Button>
        </div>
        <p>
          対象タイル: <strong>{tileCount.toLocaleString()} 枚</strong>
        </p>
        <p>
          推定容量: <strong>{formatBytes(bytes)}</strong>
        </p>
        <p className={styles.muted}>
          ブラウザー使用量:{" "}
          {estimate?.usage === undefined ? "取得できません" : formatBytes(estimate.usage)} ／
          空き容量: {available === undefined ? "取得できません" : formatBytes(available)}
        </p>
        {available !== undefined && bytes > available && (
          <p className={styles.warning}>推定容量が空き容量を超えています。</p>
        )}
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </Dialog>
  );
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
