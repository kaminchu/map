import { useEffect, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { Progress } from "../../components/Progress/Progress";
import { downloadManager } from "../../features/offline/downloadManager";
import { offlineAreaRepository } from "../../storage/metadata/offlineAreaRepository";
import type { OfflineArea } from "../../storage/metadata/database";
import { statusLabel } from "../../stores/offlineStore";
import styles from "./OfflineDetailPage.module.css";

export function OfflineDetailPage() {
  const [, params] = useRoute<{ id: string }>("/offline/:id");
  const [, navigate] = useLocation();
  const [area, setArea] = useState<OfflineArea>();
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    setArea(undefined);
    setLoaded(false);
    if (params?.id)
      void offlineAreaRepository
        .get(params.id)
        .then(setArea)
        .finally(() => setLoaded(true));
    const unsubscribe = downloadManager.subscribe((next) => {
      if (next.id === params?.id) setArea(next);
    });
    return unsubscribe;
  }, [params?.id]);
  if (!params?.id) return <NotFoundDetail />;
  if (!area)
    return (
      <main className={styles.page}>
        <p>{loaded ? "保存地図が見つかりません。" : "保存地図を読み込んでいます…"}</p>
        <Link href="/offline">一覧へ戻る</Link>
      </main>
    );
  const remove = async () => {
    await downloadManager.delete(area.id);
    setConfirmDelete(false);
    navigate("/offline");
  };
  return (
    <main className={styles.page}>
      <Link href="/offline" className={styles.back}>
        ← 保存地図一覧
      </Link>
      <h1>{area.name}</h1>
      <dl>
        <div>
          <dt>状態</dt>
          <dd>{statusLabel(area.status)}</dd>
        </div>
        <div>
          <dt>範囲</dt>
          <dd>
            {area.bounds.west.toFixed(4)}, {area.bounds.south.toFixed(4)} ～{" "}
            {area.bounds.east.toFixed(4)}, {area.bounds.north.toFixed(4)}
          </dd>
        </div>
        <div>
          <dt>ズーム</dt>
          <dd>
            {area.minZoom} ～ {area.maxZoom}
          </dd>
        </div>
        <div>
          <dt>タイル</dt>
          <dd>
            {area.downloadedTileCount.toLocaleString()} / {area.tileCount.toLocaleString()} 枚
          </dd>
        </div>
        <div>
          <dt>作成</dt>
          <dd>{new Date(area.createdAt).toLocaleString("ja-JP")}</dd>
        </div>
      </dl>
      <Progress
        value={area.tileCount ? (area.downloadedTileCount / area.tileCount) * 100 : 0}
        label="保存地図の進捗"
      />
      <div className={styles.actions}>
        {area.status === "downloading" && (
          <Button onClick={() => void downloadManager.pause(area.id)}>一時停止</Button>
        )}
        {(area.status === "pending" || area.status === "paused" || area.status === "error") && (
          <Button onClick={() => void downloadManager.resume(area.id)}>再開</Button>
        )}
        {area.status === "completed" && (
          <Button onClick={() => void downloadManager.update(area.id)}>更新</Button>
        )}
        <Button variant="danger" onClick={() => setConfirmDelete(true)}>
          削除
        </Button>
      </div>
      {area.errorMessage && <p className={styles.error}>{area.errorMessage}</p>}
      <Dialog
        open={confirmDelete}
        title="保存地図を削除"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>キャンセル</Button>
            <Button variant="danger" onClick={() => void remove()}>
              削除する
            </Button>
          </>
        }
      >
        <p>「{area.name}」を一覧から削除します。共有タイルは通常キャッシュとして残ります。</p>
      </Dialog>
    </main>
  );
}
function NotFoundDetail() {
  return (
    <main className={styles.page}>
      <p>保存地図が見つかりません。</p>
      <Link href="/offline">一覧へ戻る</Link>
    </main>
  );
}
