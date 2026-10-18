"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, ChevronDown, X } from "lucide-react";
import { Mascot as LacMascot } from "page-mascot";
import { Animation } from "./Animation";

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export function Icon({ code, className = "" }: { code: string; className?: string }) {
  const material = code.startsWith("m:");
  return <span className={"r-icon " + (material ? "r-material-icon " : "") + className} aria-hidden="true">{String.fromCodePoint(parseInt(material ? code.slice(2) : code, 16))}</span>;
}
export function EmptyState({ title, text, className = "" }: { title: string; text?: string; className?: string }) {
  return <div className={"r-empty " + className}><Animation name="empty_list" className="r-empty-animation" /><p>{title}</p>{text && <p>{text}</p>}</div>;
}
export function Mascot({ greeting, className = "" }: { greeting?: string; className?: string }) {
  return (
    <div className={"r-mascot " + className}>
      {greeting && <p className="r-bubble">{greeting}</p>}
      <div className="r-mascot-lac-wrap r-mascot-3d">
        <LacMascot
          directions="/mascots/lac-directions.webp"
          reactions="/mascots/lac-reactions.webp"
          size={120}
          label="Jake, FinBridge Mascot"
        />
      </div>
    </div>
  );
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" className={"r-switch " + (checked ? "is-on" : "")} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
export function PageHeader({ title, subtitle, onBack, close = false, children }: { title?: string; subtitle?: string; onBack: () => void; close?: boolean; children?: ReactNode }) {
  return <header className={"r-header " + (close ? "r-header-close" : "")}><button type="button" className="r-icon-button" onClick={onBack} aria-label={close ? "Đóng" : "Quay lại"}>{close ? <X size={20} /> : <ArrowLeft size={20} />}</button>{title && <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>}{children}</header>;
}
export function Modal({ title, children, onClose, sheet = false, wide = false, closeLabel = "Đóng hộp thoại" }: { title?: string; children: ReactNode; onClose: () => void; sheet?: boolean; wide?: boolean; closeLabel?: string }) {
  const mounted = useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
  // A transformed/hovered card creates a containing block for fixed children.
  // Keep dialogs at the app root, inheriting its theme but outside those cards.
  const host = mounted ? document.querySelector(".r-app") || document.body : null;
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab") return;
      const elements = panel.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    panel.current?.focus();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, [host]);
  const dialog = <div className={"r-overlay " + (sheet ? "r-sheet-overlay" : "")} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title || "Tùy chọn"} className={"r-dialog " + (sheet ? "r-sheet " : "") + (wide ? "r-wide-dialog" : "")}><button type="button" className="r-modal-close" aria-label={closeLabel} onClick={onClose}><X size={18} /></button>{sheet && <div className="r-handle" />}{title && <h2>{title}</h2>}{children}</div></div>;
  return host ? createPortal(dialog, host) : dialog;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="r-field"><span>{label}</span>{children}</label>;
}

export interface DropdownOption {
  value: string;
  label: string;
}

export function FinBridgeDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) || options[0];

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
    <div ref={containerRef} className="fb-dropdown-container">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`fb-dropdown-trigger ${open ? "is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="fb-dropdown-label">{current?.label || value}</span>
        <ChevronDown size={14} className={`fb-dropdown-chevron ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>
      {open && (
        <ul role="listbox" className="fb-dropdown-menu">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`fb-dropdown-item ${active ? "is-active" : ""}`}
                >
                  <span className="fb-dropdown-item-text">{option.label}</span>
                  {active && <Check size={14} className="fb-dropdown-check" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-label={ariaLabel}
        className="fb-dropdown-native-hidden"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

