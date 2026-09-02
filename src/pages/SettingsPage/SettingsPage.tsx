import { useState } from "react";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { UnsupportedNotice } from "../../components/UnsupportedNotice/UnsupportedNotice";
import {
  clearTemporaryCache,
  isTilePersistenceSupported,
  requestPersistentStorage,
} from "../../features/storage/storageService";
import { useStorageStatistics } from "../../features/storage/useStorageStatistics";
import { useUiStore } from "../../stores/uiStore";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { data, error, mutate } = useStorageStatistics();
  const [confirm, setConfirm] = useState(false);
  const addToast = useUiStore((state) => state.addToast);
  const protect = async () => {
    const status = await requestPersistentStorage();
    addToast({
      kind: status === "granted" ? "success" : "info",
      message:
        status === "granted" ? "ストレージ保護を有効にしました。" : "ストレージ保護は未保証です。",
    });
    void mutate();
  };
  const clear = async () => {
    try {
      const count = await clearTemporaryCache();
      addToast({ kind: "success", message: `${count}件の一時キャッシュを削除しました。` });
    } catch {
      addToast({ kind: "error", message: "一時キャッシュを削除できませんでした。" });
    } finally {
      setConfirm(false);
      void mutate();
    }
  };
  return (
    <main className={styles.page}>
      <header>
        <p className={styles.eyebrow}>オフライン地図</p>
        <h1>設定</h1>
      </header>
      {error && (
        <UnsupportedNotice>
          ストレージ情報を取得できません。ブラウザーの保存機能を確認してください。
        </UnsupportedNotice>
      )}
      <section className={styles.section}>
        <h2>ストレージ</h2>
        {!isTilePersistenceSupported() && (
          <UnsupportedNotice>
            一時キャッシュの保存・削除はこのブラウザーでは利用できません。
          </UnsupportedNotice>
        )}
        <div className={styles.stats}>
          <Stat label="保存地図" value={data ? formatBytes(data.pinnedBytes) : "読み込み中…"} />
          <Stat
            label="一時キャッシュ"
            value={data ? formatBytes(data.temporaryBytes) : "読み込み中…"}
          />
          <Stat label="合計" value={data ? formatBytes(data.totalBytes) : "読み込み中…"} />
          <Stat
            label="ブラウザー使用量 / quota"
            value={
              data?.estimate.usage === undefined || data.estimate.quota === undefined
                ? "取得できません"
                : `${formatBytes(data.estimate.usage)} / ${formatBytes(data.estimate.quota)}`
            }
          />
        </div>
        <p className={styles.protection}>
          ストレージ保護:{" "}
          {data?.persistence === "granted"
            ? "有効"
            : data?.persistence === "unsupported"
              ? "非対応"
              : "未保証"}
        </p>
        <div className={styles.buttons}>
          <Button onClick={() => void protect()}>ストレージを保護</Button>
          <Button
            variant="danger"
            onClick={() => setConfirm(true)}
            disabled={!data || data.temporaryCount === 0 || !isTilePersistenceSupported()}
          >
            一時キャッシュを削除
          </Button>
        </div>
      </section>
      <section className={styles.section}>
        <h2>バージョン情報</h2>
        <div className={styles.stats}>
          <Stat label="バージョン" value={__APP_VERSION__} />
          <Stat label="ビルド日時" value={__BUILD_TIME__} />
          <Stat label="コミットハッシュ" value={__COMMIT_HASH__} />
        </div>
      </section>
      <Dialog
        open={confirm}
        title="一時キャッシュを削除"
        onClose={() => setConfirm(false)}
        actions={
          <>
            <Button onClick={() => setConfirm(false)}>キャンセル</Button>
            <Button variant="danger" onClick={() => void clear()}>
              削除する
            </Button>
          </>
        }
      >
        <p>通常キャッシュだけを削除します。保存地図は変わりません。</p>
      </Dialog>
    </main>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
