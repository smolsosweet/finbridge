"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Moon, Sun } from "lucide-react";
import { NotificationCenter } from "./NotificationCenter";

export interface FinBridgeHeaderProps {
  lang?: "vi" | "en" | "zh";
  theme?: string;
  currentLanguage?: string;
  onOpenCalendar?: () => void;
  navigate?: (path: string) => void;
  onToggleTheme?: () => void;
  onSelectLanguage?: (lang: string) => void;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  primaryAction?: ReactNode;
  children?: ReactNode;
}

export function FinBridgeHeader({
  lang = "vi",
  theme = "light",
  currentLanguage,
  onOpenCalendar,
  navigate,
  onToggleTheme,
  onSelectLanguage,
  eyebrow,
  title,
  subtitle,
  primaryAction,
  children,
}: FinBridgeHeaderProps) {
  const isDark = theme === "dark";
  const calLabel = lang === "vi" ? "Lịch thu chi" : lang === "zh" ? "收支日历" : "Calendar";
  const themeLabel = lang === "vi" ? "Chọn chủ đề" : lang === "zh" ? "选择主题" : "Choose theme";
  const langLabel = lang === "vi" ? "Ngôn ngữ hiển thị" : lang === "zh" ? "显示语言" : "Display language";
  const selectedLang =
    currentLanguage || (lang === "vi" ? "Tiếng Việt" : lang === "zh" ? "中文" : "English");

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const languageOptions = [
    { value: "Tiếng Việt", label: "Tiếng Việt" },
    { value: "English", label: "English" },
    { value: "中文", label: "中文" },
  ];

  return (
    <header className="fb-home-header">
      <div className={`fb-brand${title ? " fb-header-page-context" : ""}`}>
        <span className="fb-brand-mark" aria-hidden="true">
          <img
            src="/mascots/finbridge-penguin-logo.webp"
            alt="FinBridge"
            width={32}
            height={32}
            className="fb-brand-logo-img"
          />
        </span>
        {title ? (
          <span className="fb-header-page-copy">
            {eyebrow && <small className="fb-header-eyebrow">{eyebrow}</small>}
            <strong>{title}</strong>
            {subtitle && <small className="fb-header-subtitle">{subtitle}</small>}
          </span>
        ) : (
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
        )}
      </div>

      <div className="fb-header-actions">
        {primaryAction}
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

        {navigate && <NotificationCenter navigate={navigate} />}

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
          <div className="fb-header-lang-wrapper" ref={langRef}>
            <button
              type="button"
              className={`fb-header-lang-trigger ${langOpen ? "is-open" : ""}`}
              onClick={() => setLangOpen(!langOpen)}
              aria-haspopup="listbox"
              aria-expanded={langOpen}
            >
              <span>{selectedLang}</span>
              <ChevronDown size={14} className={`fb-header-lang-chevron ${langOpen ? "is-open" : ""}`} />
            </button>

            {/* Accessible select for tests and form integrations */}
            <select
              aria-label={langLabel}
              className="fb-header-lang-select"
              value={selectedLang}
              onChange={(e) => onSelectLanguage(e.target.value)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                opacity: 0.001,
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              <option value="Tiếng Việt">Tiếng Việt</option>
              <option value="English">English</option>
              <option value="中文">中文</option>
            </select>

            {langOpen && (
              <ul className="fb-header-lang-menu" role="listbox">
                {languageOptions.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === selectedLang}
                    className={`fb-header-lang-item ${opt.value === selectedLang ? "is-selected" : ""}`}
                    onClick={() => {
                      onSelectLanguage(opt.value);
                      setLangOpen(false);
                    }}
                  >
                    <span>{opt.label}</span>
                    {opt.value === selectedLang && <Check size={14} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
