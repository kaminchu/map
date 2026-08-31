import { Link, useLocation } from "wouter";
import styles from "./AppNavigation.module.css";

const items = [
  { href: "/", label: "地図", icon: "⌖" },
  { href: "/offline", label: "保存地図", icon: "▣" },
  { href: "/settings", label: "設定", icon: "⚙" },
];
export function AppNavigation() {
  const [location] = useLocation();
  return (
    <nav className={styles.nav} aria-label="メインナビゲーション">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`${styles.item} ${location === item.href || (item.href === "/offline" && location.startsWith("/offline")) ? styles.active : ""}`}
        >
          <span aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
