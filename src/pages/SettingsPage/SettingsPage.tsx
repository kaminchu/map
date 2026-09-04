import { useState, type ReactNode } from "react";
import { Button } from "../../components/Button/Button";
import { Dialog } from "../../components/Dialog/Dialog";
import { UnsupportedNotice } from "../../components/UnsupportedNotice/UnsupportedNotice";
import {
  clearTemporaryCache,
  isTilePersistenceSupported,
} from "../../features/storage/storageService";
import { useStorageStatistics } from "../../features/storage/useStorageStatistics";
import { useUiStore } from "../../stores/uiStore";
import styles from "./SettingsPage.module.css";

export function SettingsPage() {
  const { data, error, mutate } = useStorageStatistics();
  const [confirm, setConfirm] = useState(false);
  const [showProtectionHelp, setShowProtectionHelp] = useState(false);
  const addToast = useUiStore((state) => state.addToast);
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
          <Stat
            label={
              <span className={styles.labelWithHelp}>
                ストレージ保護
                <button
                  type="button"
                  className={styles.helpButton}
                  aria-label="ストレージ保護について"
                  onClick={() => setShowProtectionHelp(true)}
                >
                  ?
                </button>
              </span>
            }
            value={
              !data
                ? "読み込み中…"
                : data.persistence === "granted"
                  ? "有効"
                  : data.persistence === "unsupported"
                    ? "非対応"
                    : "未保証"
            }
          />
        </div>
        <div className={styles.buttons}>
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
        open={showProtectionHelp}
        title="ストレージ保護について"
        onClose={() => setShowProtectionHelp(false)}
      >
        <dl className={styles.protectionHelp}>
          <dt>有効</dt>
          <dd>
            ブラウザーによる自動削除から保護されています。ユーザーがブラウザーの設定などから削除した場合は失われます。
          </dd>
          <dt>未保証</dt>
          <dd>
            データは保存されていますが、端末の空き容量が不足した場合などにブラウザーが自動削除する可能性があります。
          </dd>
          <dt>非対応</dt>
          <dd>このブラウザーではストレージ保護の状態を確認できません。</dd>
        </dl>
      </Dialog>
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
function Stat({ label, value }: { label: ReactNode; value: string }) {
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
