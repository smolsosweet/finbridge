"use client";

import { planningEditCopy, type PlanningEditProposal } from "@/lib/planning-actions";
import { formatTransactionMoney } from "@/lib/transaction-drafts";

export function PlanningEditCard({
  proposal,
  language,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: PlanningEditProposal;
  language: "vi" | "en" | "zh";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = planningEditCopy[language] || planningEditCopy.vi;
  const terminal = proposal.status === "confirmed" || proposal.status === "cancelled";
  const disabled = busy || proposal.status === "saving" || terminal || !!proposal.applied;
  const title = proposal.kind === "budget" ? t.budgetTitle : t.expenseTitle;

  return (
    <section className="r-workspace-action-card" aria-label={title} aria-busy={busy || proposal.status === "saving"}>
      <strong>{title}</strong>
      {terminal ? (
        <p role="status">{proposal.status === "confirmed" ? t.saved : t.cancelled}</p>
      ) : (
        <>
          <p>{t.note}</p>
          <div className="r-workspace-action-items">
            <div>
              <b>{proposal.title}</b>
              <dl>
                <div>
                  <dt>{t.wallet}</dt>
                  <dd>{proposal.wallet}</dd>
                </div>
                {proposal.changes.amount && (
                  <>
                    <div>
                      <dt>{t.currentAmount}</dt>
                      <dd>{formatTransactionMoney(proposal.changes.amount.from, proposal.currency)}</dd>
                    </div>
                    <div>
                      <dt>{t.newAmount}</dt>
                      <dd><b>{formatTransactionMoney(proposal.changes.amount.to, proposal.currency)}</b></dd>
                    </div>
                  </>
                )}
                {proposal.changes.title && (
                  <div>
                    <dt>{t.target}</dt>
                    <dd><b>{proposal.changes.title.to}</b></dd>
                  </div>
                )}
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
