"use client";

import { fixedExpensePaymentCopy, type FixedExpensePaymentProposal } from "@/lib/planning-actions";
import { formatTransactionMoney } from "@/lib/transaction-drafts";

export function FixedExpensePaymentCard({
  proposal,
  language,
  busy,
  onConfirm,
  onCancel,
}: {
  proposal: FixedExpensePaymentProposal;
  language: "vi" | "en" | "zh";
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = fixedExpensePaymentCopy[language] || fixedExpensePaymentCopy.vi;
  const terminal = proposal.status === "confirmed" || proposal.status === "cancelled";
  const disabled = busy || proposal.status === "saving" || terminal || !!proposal.applied;

  return (
    <section className="r-workspace-action-card" aria-label={t.title} aria-busy={busy || proposal.status === "saving"}>
      <strong>{t.title}</strong>
      {terminal ? (
        <p role="status">{proposal.status === "confirmed" ? t.saved : t.cancelled}</p>
      ) : (
        <>
          <p>{t.note}</p>
          {proposal.alreadyPaid && (
            <p style={{ color: "#b84040", fontWeight: 600 }}>{t.alreadyPaid}</p>
          )}
          <div className="r-workspace-action-items">
            <div>
              <b>{proposal.expenseTitle}</b>
              <dl>
                <div>
                  <dt>{t.amount}</dt>
                  <dd><b>{formatTransactionMoney(proposal.amount, proposal.currency)}</b></dd>
                </div>
                <div>
                  <dt>{t.dueDate}</dt>
                  <dd>{proposal.dueDate}</dd>
                </div>
                <div>
                  <dt>{t.wallet}</dt>
                  <dd>{proposal.walletName} · {proposal.currency}</dd>
                </div>
                <div>
                  <dt>{t.category}</dt>
                  <dd>{proposal.category}</dd>
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
