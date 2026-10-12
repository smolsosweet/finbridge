import type { ReactNode } from "react";

export function FinBridgeHeader({ lang = "vi", children }: { lang?: "vi" | "en" | "zh"; children?: ReactNode }) {
  return <header className="fb-home-header"><div className="fb-brand"><span className="fb-brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M5 24V13M27 24V13M5 17C11 5 21 5 27 17M5 20H27M11 20V24M16 20V24M21 20V24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></span><span>FinBridge<small>{lang === "vi" ? "Không gian tài chính của bạn" : lang === "zh" ? "您的财务空间" : "Your financial workspace"}</small></span></div>{children}</header>;
}
