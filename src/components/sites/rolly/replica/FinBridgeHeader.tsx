"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Moon, Sun } from "lucide-react";
import { useSafety } from "@/components/safety/SafetyProvider";
import { SAFETY_COPY } from "@/components/safety/safety-copy";

export interface FinBridgeHeaderProps {
  lang?: "vi" | "en" | "zh";
  theme?: string;
  currentLanguage?: string;
  onOpenCalendar?: () => void;
  onToggleTheme?: () => void;
  onSelectLanguage?: (lang: string) => void;
  children?: ReactNode;
}

export function FinBridgeHeader({
  lang = "vi",
  theme = "light",
  currentLanguage,
  onOpenCalendar,
  onToggleTheme,
  onSelectLanguage,
  children,
}: FinBridgeHeaderProps) {
  const safety = useSafety();
  const unread = safety?.doc.events.filter(e => !e.read).length || 0;
  const isDark = theme === "dark";
  const calLabel = lang === "vi" ? "Lịch thu chi" : lang === "zh" ? "收支日历" : "Calendar";
  const themeLabel = lang === "vi" ? "Chọn chủ đề" : lang === "zh" ? "选择主题" : "Choose theme";
  const langLabel = lang === "vi" ? "Ngôn ngữ hiển thị" : lang === "zh" ? "显示语言" : "Display language";
  const selectedLang =
    currentLanguage || (lang === "vi" ? "Tiếng Việt" : lang === "zh" ? "中文" : "English");

  return (
    <header className="fb-home-header">
      <div className="fb-brand">
        <span className="fb-brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span className="fb-brand-title">
          <span className="fb-brand-name">
            <span className="fb-brand-fin">Fin</span>
            <span className="fb-brand-bridge">Bridge</span>
          </span>
          <small>
            {lang === "vi"
              ? "Không gian tài chính của bạn"
              : lang === "zh"
              ? "您的财务空间"
              : "Your financial workspace"}
          </small>
        </span>
      </div>

      <div className="fb-header-actions">
        {safety && <Link className="fb-alert-bell" href="/app/safetyAlerts?view=history" aria-label={`${SAFETY_COPY[lang].history}${unread ? ` (${unread})` : ""}`} title={SAFETY_COPY[lang].history}><Bell size={20} />{unread > 0 && <span>{unread}</span>}</Link>}
        {onOpenCalendar && (
          <button
            type="button"
            className="fb-header-calendar-btn"
            onClick={onOpenCalendar}
            aria-label={calLabel}
            title={calLabel}
          >
            <CalendarDays size={18} />
            <span className="fb-header-btn-text">{calLabel}</span>
          </button>
        )}

        {onToggleTheme && (
          <button
            type="button"
            className="fb-settings-theme"
            onClick={onToggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
          >
            {isDark ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        )}

        {children}

        {!children && onSelectLanguage && (
          <select
            aria-label={langLabel}
            className="fb-header-lang-select"
            value={selectedLang}
            onChange={(e) => onSelectLanguage(e.target.value)}
          >
            <option value="Tiếng Việt">Tiếng Việt</option>
            <option value="English">English</option>
            <option value="中文">中文</option>
          </select>
        )}
      </div>
    </header>
  );
}
