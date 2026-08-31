import styles from "./Progress.module.css";

export function Progress({ value, label }: { value: number; label?: string }) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={styles.wrapper}>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label ?? "進捗"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safe}
      >
        <span style={{ width: `${safe}%` }} />
      </div>
      <span className={styles.value}>{Math.round(safe)}%</span>
    </div>
  );
}
