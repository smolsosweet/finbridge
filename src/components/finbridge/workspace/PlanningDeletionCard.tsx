"use client";
import { planningDeletionCopy, type PlanningDeletion } from "@/lib/planning-deletion";
import { formatScenarioMoney } from "@/lib/scenario-format";

export function PlanningDeletionCard({ proposal, language, busy, onSelect, onConfirm, onCancel }: { proposal: PlanningDeletion; language: "vi" | "en" | "zh"; busy: boolean; onSelect: (id: string, selected: boolean) => void; onConfirm: () => void; onCancel: () => void }) {
  const t = planningDeletionCopy[language];
  const terminal = proposal.status === "confirmed" || proposal.status === "cancelled";
  const disabled = busy || proposal.status === "saving" || terminal || !!proposal.applied;
  const visible = terminal ? proposal.targets.filter(t => proposal.selectedIds.includes(t.id)) : proposal.targets;
  return <section className="r-ai-delete-confirm" aria-label={t[proposal.kind]}>
    <strong>{t[proposal.kind]}</strong>
    {terminal ? <p role="status">{proposal.status === "confirmed" ? t.saved : t.cancelled}</p> : <>
      <p>{proposal.selectedIds.length ? t.review : t.choose}</p>
      <p>{proposal.kind === "budget" ? t.effectBudget : t.effectFixed}</p>
    </>}
    {!!visible.length && <div className="r-ai-delete-list">{visible.map(target => <label key={target.id}>
      <input type="checkbox" checked={proposal.selectedIds.includes(target.id)} disabled={disabled} onChange={event => onSelect(target.id, event.target.checked)} />
      <span><b>{target.title}</b><small>{target.wallet} · {target.currency && formatScenarioMoney(target.amount, target.currency, language)}{proposal.kind === "budget" && target.linked ? ` · ${target.linked} ${t.linked}` : ""}</small></span>
    </label>)}</div>}
    {!terminal && <>
      <small>{proposal.selectedIds.length} {t.selected}{!proposal.selectedIds.length ? ` · ${t.selectRequired}` : ""}</small>
      {proposal.error && <p role="alert">{proposal.error}</p>}
      <div className="r-two-options"><button type="button" className="r-secondary" disabled={disabled} onClick={onCancel}>{t.cancel}</button><button type="button" className="r-danger" disabled={busy || proposal.status === "saving" || !proposal.selectedIds.length} onClick={onConfirm}>{proposal.status === "saving" ? t.saving : t.confirm}</button></div>
    </>}
  </section>;
}
