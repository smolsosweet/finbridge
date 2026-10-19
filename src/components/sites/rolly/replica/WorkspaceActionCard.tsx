import { useState } from "react";
import type { AppState } from "./store";
import { formatTransactionMoney } from "@/lib/transaction-drafts";
import { inspectWorkspaceProposal, workspaceActionCopy, type ActionField, type ActionLanguage, type WorkspaceProposal } from "@/lib/workspace-actions";

export function WorkspaceActionCard({ proposal, state, language, busy, onConfirm, onCancel, onAnswer, onCreateCategory }: {
  proposal: WorkspaceProposal; state: AppState; language: ActionLanguage; busy: boolean;
  onConfirm: () => void; onCancel: () => void;
  onAnswer: (choice: { operationId: string; field: ActionField; value: string | number }, label: string) => void;
  onCreateCategory?: (name: string, operationId: string) => string | null;
}) {
  const t = workspaceActionCopy[language];
  const inspection = inspectWorkspaceProposal(state, proposal, language);
  const terminal = ["confirmed", "cancelled"].includes(proposal.status);
  const ready = !inspection.question && !inspection.error;
  const readOnly = busy || terminal || proposal.status === "saving" || !!proposal.applied;

  const [creatingCategory, setCreatingCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const submitCustomCategory = () => {
    const trimmed = customCategoryName.trim();
    if (!trimmed) return;
    if (onCreateCategory && inspection.question) {
      const err = onCreateCategory(trimmed, inspection.question.operationId);
      if (err) {
        setCategoryError(err);
        return;
      }
    } else if (inspection.question) {
      onAnswer({ operationId: inspection.question.operationId, field: "category", value: trimmed }, trimmed);
    }
    setCreatingCategory(false);
    setCustomCategoryName("");
    setCategoryError("");
  };

  return <section className="r-workspace-action-card" aria-busy={busy || proposal.status === "saving"}>
    <strong>{t[proposal.status]}</strong>
    <div className="r-workspace-action-items">{proposal.actions.map(action => {
      const wallet = state.wallets.find(item => item.id === action.walletId);
      const pendingWallet = proposal.actions.find(item => item.kind === "wallet" && item.id === action.walletId);
      const currency = action.currency || wallet?.currency || pendingWallet?.currency;
      const display = (field: ActionField, value: unknown): string => {
        if (field === "walletId") return wallet ? `${wallet.name} · ${wallet.currency}` : pendingWallet?.name || String(value);
        if (field === "budgetId") return value ? state.goals.find(item => item.id === value)?.title || proposal.actions.find(item => item.id === value)?.name || String(value) : t.standalone;
        if (field === "category" && value === "") return t.all;
        if (field === "monthPosition") return value === "start" ? t.start : value === "end" ? t.end : t.onDate;
        if (field === "intervalMonths" || field === "reminderDays") return String(value);
        if (typeof value === "number") return currency ? formatTransactionMoney(value, currency) : String(value);
        if (["cash", "credit", "weekly", "monthly", "yearly", "once"].includes(String(value))) return t[value as "cash" | "credit" | "weekly" | "monthly" | "yearly" | "once"];
        return String(value);
      };
      const fields: ActionField[] = action.kind === "wallet" ? ["currency", "walletType", "initialBalance", ...(action.walletType === "credit" ? ["creditLimit" as const] : [])]
        : action.kind === "budget" ? ["walletId", "amount", "date", "cycle", "category"] : ["budgetId", "walletId", "amount", "category", "date", "recurrence", "intervalMonths", "monthPosition", "reminderDays"];
      return <div key={action.id}><b>{t[action.kind]}{action.name ? ` · ${action.name}` : ""}</b><dl>{fields.filter(field => action[field] !== null).map(field => <div key={field}><dt>{t[field]}</dt><dd>{display(field, action[field])}</dd></div>)}</dl></div>;
    })}</div>
    {!terminal && (proposal.error || inspection.error) && <small role="alert">{proposal.error || inspection.error}</small>}
    {!readOnly && inspection.question && (
      creatingCategory && inspection.question.field === "category" ? (
        <div className="r-ai-category-create" style={{ marginTop: 8 }}>
          <label htmlFor="new-workspace-category">{t.newCategoryName}</label>
          <div className="r-ai-category-create-controls">
            <input
              id="new-workspace-category"
              autoComplete="off"
              maxLength={100}
              value={customCategoryName}
              onChange={(e) => { setCustomCategoryName(e.target.value); setCategoryError(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCustomCategory();
                } else if (e.key === "Escape") {
                  setCreatingCategory(false);
                  setCustomCategoryName("");
                  setCategoryError("");
                }
              }}
              placeholder={t.enterCategoryName}
              disabled={readOnly}
              autoFocus
            />
            <button
              type="button"
              className="r-primary"
              disabled={!customCategoryName.trim() || readOnly}
              onClick={submitCustomCategory}
            >
              {t.createAndSelect}
            </button>
            <button
              type="button"
              className="r-secondary"
              disabled={readOnly}
              onClick={() => { setCreatingCategory(false); setCustomCategoryName(""); setCategoryError(""); }}
            >
              {t.cancel}
            </button>
          </div>
          {categoryError && <small role="alert">{categoryError}</small>}
        </div>
      ) : (
        <div className="r-ai-category-options" role="group" aria-label={inspection.question.text}>
          {inspection.question.choices.map(choice => (
            <button
              type="button"
              key={String(choice.value)}
              onClick={() => onAnswer({ operationId: inspection.question!.operationId, field: inspection.question!.field, value: choice.value }, choice.label)}
            >
              {choice.label}
            </button>
          ))}
          {inspection.question.field === "category" && (
            <button
              type="button"
              style={{ borderStyle: "dashed", borderColor: "var(--r-teal, #12b8c4)", color: "var(--r-teal, #12b8c4)", fontWeight: 500 }}
              disabled={readOnly}
              onClick={() => { setCreatingCategory(true); setCustomCategoryName(""); setCategoryError(""); }}
            >
              {t.addCategory}
            </button>
          )}
        </div>
      )
    )}
    {!terminal && <div className="r-two-options">
      <button type="button" className="r-secondary" disabled={readOnly} onClick={onCancel}>{t.cancel}</button>
      <button type="button" className="r-primary" disabled={busy || !["review", "failed"].includes(proposal.status) || (!ready && !proposal.applied)} onClick={onConfirm}>{proposal.status === "failed" ? t.retry : t.confirm}</button>
    </div>}
    {!terminal && !proposal.applied && <small>{t.edit}</small>}
  </section>;
}
