import styles from "./UnsupportedNotice.module.css";
export function UnsupportedNotice({ children }: { children: string }) {
  return (
    <div className={styles.notice} role="status">
      {children}
    </div>
  );
}
