"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Animation } from "./Animation";

export function Icon({ code, className = "" }: { code: string; className?: string }) {
  const material = code.startsWith("m:");
  return <span className={"r-icon " + (material ? "r-material-icon " : "") + className} aria-hidden="true">{String.fromCodePoint(parseInt(material ? code.slice(2) : code, 16))}</span>;
}
export function EmptyState({ title, text, className = "" }: { title: string; text?: string; className?: string }) {
  return <div className={"r-empty " + className}><Animation name="empty_list" className="r-empty-animation" /><p>{title}</p>{text && <p>{text}</p>}</div>;
}
export function Mascot({ greeting, className = "" }: { greeting?: string; className?: string }) {
  return <div className={"r-mascot " + className}>{greeting && <p className="r-bubble">{greeting}</p>}<Animation className="r-robot" /></div>;
}
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" className={"r-switch " + (checked ? "is-on" : "")} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>;
}
export function PageHeader({ title, subtitle, onBack, close = false, children }: { title?: string; subtitle?: string; onBack: () => void; close?: boolean; children?: ReactNode }) {
  return <header className={"r-header " + (close ? "r-header-close" : "")}><button type="button" className="r-icon-button" onClick={onBack} aria-label={close ? "Đóng" : "Quay lại"}>{close ? <X size={20} /> : <ArrowLeft size={20} />}</button>{title && <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>}{children}</header>;
}
export function Modal({ title, children, onClose, sheet = false, wide = false }: { title?: string; children: ReactNode; onClose: () => void; sheet?: boolean; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
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
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = old; previous?.focus(); };
  }, [onClose]);
  return <div className={"r-overlay " + (sheet ? "r-sheet-overlay" : "")} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title || "Tùy chọn"} className={"r-dialog " + (sheet ? "r-sheet " : "") + (wide ? "r-wide-dialog" : "")}><button type="button" className="r-modal-close" aria-label="Đóng hộp thoại" onClick={onClose}><X size={18} /></button>{sheet && <div className="r-handle" />}{title && <h2>{title}</h2>}{children}</div></div>;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="r-field"><span>{label}</span>{children}</label>;
}
