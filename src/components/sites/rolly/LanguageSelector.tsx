"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import type { AuthLanguage } from "@/lib/auth-copy";
import styles from "./LanguageSelector.module.css";

const OPTIONS: Array<{ code: AuthLanguage; label: string }> = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "zh", label: "中文" },
];

export function LanguageSelector({
  value,
  onChange,
  className,
}: {
  value: AuthLanguage;
  onChange: (lang: AuthLanguage) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.code === value) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
      >
        <Globe size={16} className={styles.globe} aria-hidden="true" />
        <span className={styles.label}>{current.label}</span>
        <ChevronDown size={14} className={open ? styles.chevronOpen : styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" className={styles.menu}>
          {OPTIONS.map((item) => (
            <li key={item.code}>
              <button
                type="button"
                role="option"
                aria-selected={value === item.code}
                className={`${styles.item} ${value === item.code ? styles.itemActive : ""}`}
                onClick={() => {
                  onChange(item.code);
                  setOpen(false);
                }}
              >
                <span>{item.label}</span>
                {value === item.code && <Check size={15} className={styles.check} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
