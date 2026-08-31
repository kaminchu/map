import { useEffect } from "react";
import { useUiStore } from "../../stores/uiStore";
import styles from "./Toast.module.css";

export function Toasts() {
  const toasts = useUiStore((state) => state.toasts);
  const dismiss = useUiStore((state) => state.dismissToast);
  return (
    <div className={styles.container} aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  );
}
function ToastItem({
  id,
  kind,
  message,
  onDismiss,
}: {
  id: string;
  kind: string;
  message: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4_000);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);
  return (
    <div className={`${styles.toast} ${styles[kind]}`} role="status">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="通知を閉じる">
        ×
      </button>
    </div>
  );
}
