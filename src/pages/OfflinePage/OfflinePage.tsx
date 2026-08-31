import { useState } from "react";
import { Link } from "wouter";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { Progress } from "../../components/Progress/Progress";
import { downloadManager } from "../../features/offline/downloadManager";
import { useOfflineAreas } from "../../features/offline/useOfflineAreas";
import { useOfflineStore, statusLabel } from "../../stores/offlineStore";
import { useUiStore } from "../../stores/uiStore";
import styles from "./OfflinePage.module.css";

export function OfflinePage() {
  useOfflineAreas();
  const areas = useOfflineStore((state) => state.areas);
  const loading = useOfflineStore((state) => state.loading);
  const error = useOfflineStore((state) => state.error);
  const removeArea = useOfflineStore((state) => state.removeArea);
  const addToast = useUiStore((state) => state.addToast);
  const [deleteId, setDeleteId] = useState<string>();
  const action = async (id: string, kind: "pause" | "resume" | "update") => {
    try {
      if (kind === "pause") await downloadManager.pause(id);
      else if (kind === "resume") await downloadManager.resume(id);
      else await downloadManager.update(id);
    } catch {
      addToast({ kind: "error", message: "保存地図の操作に失敗しました。" });
    }
  };
  const remove = async () => {
    if (!deleteId) return;
    try {
      await downloadManager.delete(deleteId);
      removeArea(deleteId);
    } catch {
      addToast({ kind: "error", message: "保存地図を削除できませんでした。" });
    } finally {
      setDeleteId(undefined);
    }
  };
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>オフライン地図</p>
          <h1>保存した地図</h1>
        </div>
        <Link href="/" className={styles.mapLink}>
          地図へ戻る
        </Link>
      </header>
      {loading && <p>読み込み中…</p>}
      {error && <p className={styles.error}>{error}</p>}
      {!loading && areas.length === 0 && (
        <section className={styles.empty}>
          <h2>保存地図はありません</h2>
          <p>地図画面で表示範囲を指定して保存できます。</p>
          <Link href="/" className={styles.primaryLink}>
            地図を開く
          </Link>
        </section>
      )}
      <div className={styles.cards}>
        {areas.map((area) => (
          <article className={styles.card} key={area.id}>
            <Link href={`/offline/${area.id}`} className={styles.cardTitle}>
              <h2>{area.name}</h2>
            </Link>
            <div className={styles.meta}>
              <span>{statusLabel(area.status)}</span>
              <span>
                {area.downloadedTileCount.toLocaleString()} / {area.tileCount.toLocaleString()} 枚
              </span>
            </div>
            <Progress value={area.progress} label={`${area.name} の進捗`} />
            {area.errorMessage && <p className={styles.error}>{area.errorMessage}</p>}
            <div className={styles.actions}>
              {area.status === "downloading" && (
                <Button onClick={() => void action(area.id, "pause")}>一時停止</Button>
              )}
              {(area.status === "pending" ||
                area.status === "paused" ||
                area.status === "error") && (
                <Button onClick={() => void action(area.id, "resume")}>再開</Button>
              )}
              {area.status === "completed" && (
                <Button onClick={() => void action(area.id, "update")}>更新</Button>
              )}
              <Link href={`/offline/${area.id}`} className={styles.detailLink}>
                詳細
              </Link>
              <Button variant="danger" onClick={() => setDeleteId(area.id)}>
                削除
              </Button>
            </div>
          </article>
        ))}
      </div>
      <Dialog
        open={deleteId !== undefined}
        title="保存地図を削除"
        onClose={() => setDeleteId(undefined)}
        actions={
          <>
            <Button onClick={() => setDeleteId(undefined)}>キャンセル</Button>
            <Button variant="danger" onClick={() => void remove()}>
              削除する
            </Button>
          </>
        }
      >
        <p>この保存地図を削除します。共有タイルは通常キャッシュとして残ります。</p>
      </Dialog>
    </main>
  );
}
