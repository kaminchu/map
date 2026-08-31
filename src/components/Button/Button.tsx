import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}
export function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button className={`${styles.button} ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
