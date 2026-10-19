"use client";

import { fixedExpenseStatusCopy, type FixedExpenseStatusProposal } from "@/lib/planning-actions";
import { formatTransactionMoney } from "@/lib/transaction-drafts";

export function FixedExpenseStatusCard({
  proposal,
  language,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: FixedExpenseStatusProposal;
  language: "vi" | "en" | "zh";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = fixedExpenseStatusCopy[language] || fixedExpenseStatusCopy.vi;
  const terminal = proposal.status === "confirmed" || proposal.status === "cancelled";
  const disabled = busy || proposal.status === "saving" || terminal || !!proposal.applied;
  const title = proposal.action === "pause" ? t.pauseTitle : t.resumeTitle;
  const note = proposal.action === "pause" ? t.pauseNote : t.resumeNote;

  return (
    <section className="r-workspace-action-card" aria-label={title} aria-busy={busy || proposal.status === "saving"}>
      <strong>{title}</strong>
      {terminal ? (
        <p role="status">{proposal.status === "confirmed" ? t.saved : t.cancelled}</p>
      ) : (
        <>
          <p>{note}</p>
          <div className="r-workspace-action-items">
            <div>
              <b>{proposal.expenseTitle}</b>
              <dl>
                <div>
                  <dt>{t.amount}</dt>
                  <dd><b>{formatTransactionMoney(proposal.amount, proposal.currency)}</b></dd>
                </div>
                <div>
                  <dt>{t.wallet}</dt>
                  <dd>{proposal.wallet}</dd>
                </div>
              </dl>
            </div>
          </div>
          {proposal.error && <small role="alert">{proposal.error}</small>}
          <div className="r-two-options">
            <button type="button" className="r-secondary" disabled={disabled} onClick={onCancel}>
              {t.cancel}
            </button>
            <button
              type="button"
              className="r-primary"
              disabled={disabled}
              onClick={onConfirm}
            >
              {proposal.status === "saving" ? t.saving : t.confirm}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
