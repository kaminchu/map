import { useEffect, useRef, type PropsWithChildren, type ReactNode } from "react";
import styles from "./Dialog.module.css";

export function Dialog({
  open,
  title,
  onClose,
  children,
  actions,
}: PropsWithChildren<{ open: boolean; title: string; onClose: () => void; actions?: ReactNode }>) {
  const ref = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocus.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      const focusFirst = () =>
        dialog.querySelector<HTMLElement>("button, input, select, textarea")?.focus();
      if (typeof window.requestAnimationFrame === "function")
        window.requestAnimationFrame(focusFirst);
      else focusFirst();
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      previousFocus.current?.focus();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <div className={styles.header}>
          <h2>{title}</h2>
          <button type="button" className={styles.close} aria-label="閉じる" onClick={onClose}>
            ×
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </form>
    </dialog>
  );
}
