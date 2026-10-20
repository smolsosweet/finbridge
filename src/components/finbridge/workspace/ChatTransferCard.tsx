"use client";

import { useState } from "react";
import { transferChatCopy, type TransferChatRequest, type TransferChatResult } from "@/lib/transfer-chat-model";
import type { ScenarioLanguage } from "@/lib/scenario-format";
import styles from "./ChatTransferCard.module.css";

export function ChatTransferCard({ result, language, busy, onChoice, onConfirm, onCancel, onOpen }: {
  result: TransferChatResult; language: ScenarioLanguage; busy: boolean;
  onChoice: (patch: Partial<TransferChatRequest>, label: string) => void;
  onConfirm: () => void; onCancel: () => void; onOpen: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const t = transferChatCopy[language];
  const writable = !!result.write && ["review", "failed", "saving"].includes(result.status);
  const rows = (items: TransferChatResult["rows"]) => <dl>{items.map((row, index) => <div key={index}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>;
  return <section className={styles.card} aria-label={result.title} aria-busy={busy || result.status === "saving"}>
    <header><strong>{result.title}</strong>{(result.sandbox || result.title !== t.reference) && <small>{result.sandbox ? t.sandbox : t.reference}</small>}</header>
    {result.text && <p>{result.text}</p>}
    {rows(result.rows.slice(0, 6))}
    {result.rows.length > 6 && <details><summary>{{ vi: "Xem chi tiết", en: "View details", zh: "查看详情" }[language]}</summary>{rows(result.rows.slice(6))}</details>}
    {result.sandbox && result.text !== t.sandboxNote && <small>{t.sandboxNote}</small>}
    {result.error && <p role="alert" className={styles.error}>{result.error}</p>}
    {result.choices.length > 0 && <div className={styles.choices}>{result.choices.map((choice, index) => <button type="button" key={index} disabled={busy || result.status === "saving" || result.uncertain} onClick={() => onChoice(choice.patch, choice.label)}>{choice.label}</button>)}</div>}
    {writable && <>
      {result.acknowledgement && <label className={styles.acknowledge}><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e => setAcknowledged(e.target.checked)} />{t.acknowledge}</label>}
      <div className={styles.actions}>
        <button type="button" disabled={busy || result.uncertain} onClick={onCancel}>{t.cancel}</button>
        <button type="button" className="r-primary" disabled={busy || result.status === "saving" || (!!result.acknowledgement && !acknowledged)} onClick={onConfirm}>{result.status === "saving" ? t.saving : result.status === "failed" ? t.retry : t.confirm}</button>
      </div>
    </>}
    <button type="button" className={styles.open} onClick={onOpen}>{t.open} →</button>
  </section>;
}
