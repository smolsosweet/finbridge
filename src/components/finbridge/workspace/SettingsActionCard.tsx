"use client";

import { Archive, AlertTriangle, Check, X } from "lucide-react";
import type { SettingsActionProposal } from "@/lib/settings-actions";
import { settingsActionCopy } from "@/lib/settings-actions";
import { resolveLanguage, type AppLanguage } from "@/lib/i18n";
import { money } from "./store";

export function SettingsActionCard({
  proposal,
  lang,
  onConfirm,
  onCancel,
}: {
  proposal: SettingsActionProposal;
  lang: AppLanguage;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const language = resolveLanguage(lang);
  const t = settingsActionCopy[language];
  const isPending = proposal.status === "pending" || proposal.status === "failed";
  const isSaving = proposal.status === "saving";
  const isConfirmed = proposal.status === "confirmed";
  const isCancelled = proposal.status === "cancelled";

  return (
    <div
      className={`r-ai-card r-planning-action-card ${
        isConfirmed ? "is-confirmed" : isCancelled ? "is-cancelled" : ""
      }`}
      role="region"
      aria-label={t.archiveTitle}
      style={{
        margin: "8px 0",
        padding: "14px 16px",
        borderRadius: "12px",
        border: "1px solid var(--r-border, #e5e7eb)",
        background: "var(--r-card, #ffffff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
        <Archive size={18} style={{ color: "var(--r-teal, #0d9488)" }} />
        <strong style={{ fontSize: "15px", color: "var(--r-text, #111827)" }}>
          {t.archiveTitle}
        </strong>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px", marginBottom: "12px" }}>
        <div>
          <span style={{ color: "var(--r-muted, #6b7280)", display: "block" }}>{t.wallet}</span>
          <b style={{ color: "var(--r-text, #111827)" }}>{proposal.walletName}</b>
        </div>
        <div>
          <span style={{ color: "var(--r-muted, #6b7280)", display: "block" }}>{t.balance}</span>
          <b style={{ color: "var(--r-text, #111827)" }}>
            {proposal.walletBalance !== undefined && proposal.walletCurrency
              ? money(proposal.walletBalance, proposal.walletCurrency)
              : "0"}
          </b>
        </div>
      </div>

      {proposal.isOnlyActiveWallet && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "8px 10px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#b45309",
            marginBottom: "10px",
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{t.onlyWalletWarning}</span>
        </div>
      )}

      {((proposal.activeBudgetsCount || 0) > 0 || (proposal.activeFixedExpensesCount || 0) > 0 || (proposal.activeGoalsCount || 0) > 0) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            padding: "8px 10px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#1d4ed8",
            marginBottom: "10px",
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{t.dependencyWarning(proposal.activeBudgetsCount || 0, proposal.activeFixedExpensesCount || 0, proposal.activeGoalsCount || 0)}</span>
        </div>
      )}

      <p style={{ margin: "4px 0 12px 0", fontSize: "12px", color: "var(--r-muted, #6b7280)" }}>
        {t.effectNote}
      </p>

      {isPending && (
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            type="button"
            className="r-primary"
            onClick={onConfirm}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "6px",
            }}
          >
            <Check size={14} />
            <span>{t.confirmArchive}</span>
          </button>
          <button
            type="button"
            className="r-secondary"
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "6px",
            }}
          >
            <X size={14} />
            <span>{t.cancel}</span>
          </button>
        </div>
      )}

      {isSaving && (
        <p style={{ fontSize: "13px", color: "var(--r-muted, #6b7280)", fontStyle: "italic", margin: "4px 0 0 0" }}>
          {t.saving}
        </p>
      )}

      {isConfirmed && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16a34a", fontSize: "13px", marginTop: "4px" }}>
          <Check size={16} />
          <span>{t.savedArchive}</span>
        </div>
      )}

      {isCancelled && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--r-muted, #6b7280)", fontSize: "13px", marginTop: "4px" }}>
          <X size={16} />
          <span>{t.cancelled}</span>
        </div>
      )}

      {proposal.error && (
        <p style={{ color: "#dc2626", fontSize: "12px", margin: "6px 0 0 0" }} role="alert">
          {proposal.error}
        </p>
      )}
    </div>
  );
}
