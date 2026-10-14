"use client";
import { useEffect, useState } from "react";
import { Bell, ShieldCheck, TrendingUp } from "lucide-react";
import { financialOutlook, reserveAmounts } from "@/lib/financial-outlook";
import { updateState, useAppState, today } from "./store";
import styles from "./FinancialOutlook.module.css";
const COPY = {
  vi: { title: "Nhắc hạn & dự phòng", empty: "Chưa có cảnh báo đến hạn hoặc vượt nhịp ngân sách.", reserve: "Chỉnh mức dự phòng", save: "Lưu mức dự phòng", after: "Nếu khoản này chưa trả, sau khi trả sẽ còn", floor: "mức dự phòng", warning: "Thấp hơn mức dự phòng đã đặt.", unknown: "Chưa tính được: chuyển khoản khác tiền tệ thiếu số tiền đích.", due: "Đến hạn", daily: "Gợi ý tối đa mỗi ngày còn lại", pace: "Chi nhanh hơn tiến độ ngân sách", projection: "Ước tính cuối kỳ nếu giữ nhịp chi hiện tại", days: "ngày còn lại", note: "Dựa trên giao dịch đã ghi, chưa tính thu nhập tương lai. Nhắc khi mở ứng dụng; chưa gửi push/email. Không tự thanh toán.", invalid: "Mức dự phòng phải là số không âm hợp lệ." },
  en: { title: "Due dates & reserves", empty: "No due-date or budget-pace alerts right now.", reserve: "Edit reserves", save: "Save reserves", after: "If this bill is unpaid, the balance after paying would be", floor: "reserve", warning: "Below your reserve threshold.", unknown: "Cannot calculate: a cross-currency transfer has no destination amount.", due: "Due", daily: "Suggested daily ceiling for remaining days", pace: "Spending ahead of budget pace", projection: "End-of-period estimate at the current pace", days: "days left", note: "Based on recorded transactions, excluding future income. Reminders appear when the app is open; no push/email yet. No automatic payments.", invalid: "Reserves must be valid non-negative amounts." },
  zh: { title: "到期提醒与备用金", empty: "目前没有到期或预算进度提醒。", reserve: "编辑备用金", save: "保存备用金", after: "如果此账单未支付，支付后的余额预计为", floor: "备用金", warning: "低于你设置的备用金。", unknown: "无法计算：跨币种转账缺少收款金额。", due: "到期", daily: "剩余天数的建议每日上限", pace: "支出快于预算进度", projection: "按当前速度估算期末支出", days: "剩余天数", note: "基于已记录交易，不包括未来收入。提醒仅在应用打开时显示，尚未发送推送或邮件，不会自动付款。", invalid: "备用金必须是有效的非负金额。" },
};
export function FinancialOutlook({ editable = false }: { editable?: boolean }) {
  const state = useAppState();
  const lang = /中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en", t = COPY[lang];
  const [asOf, setAsOf] = useState(today);
  useEffect(() => {
    const refresh = () => setAsOf(today());
    const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const facts = financialOutlook(state, asOf), reserves = reserveAmounts(state);
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Record<string, string>>({}), [error, setError] = useState("");
  const format = (n: number, c: string) => new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 }).format(n) + " " + c;
  const expenses = facts.expenses.filter(e => e.remind || e.belowReserve), budgets = facts.budgets.filter(b => b.aheadOfPace);
  if (!editable && !expenses.length && !budgets.length) return null;
  return <section className={styles.panel} aria-label={t.title}>
    <header><h2><ShieldCheck size={20} />{t.title}</h2>{editable && <button type="button" onClick={() => { setEditing(e => !e); setDraft(Object.fromEntries(state.wallets.filter(w => !w.archived).map(w => [w.id, String(reserves[w.id] || 0)]))); setError(""); }}>{t.reserve}</button>}</header>
    {!expenses.length && !budgets.length && <p>{t.empty}</p>}
    {expenses.map(({ expense, wallet, due, after, reserve, belowReserve, balance }) => <article key={expense.id} className={belowReserve ? styles.warning : styles.reminder}><h3><Bell size={16} />{expense.title} · {wallet.name}</h3><p>{t.due} {due} · {format(expense.amount, wallet.currency)}</p><p>{balance.complete ? `${t.after} ${format(after, wallet.currency)} · ${t.floor}: ${format(reserve, wallet.currency)}` : t.unknown}</p>{belowReserve && <b>{t.warning}</b>}</article>)}
    {budgets.map(({ budget, dailyAllowance, projected, remainingDays }) => <article key={budget.id} className={styles.warning}><h3><TrendingUp size={16} />{budget.title} · {t.pace}</h3><p>{t.daily}: <b>{format(dailyAllowance, budget.currency)}</b> · {remainingDays} {t.days}</p><p>{t.projection}: {format(projected, budget.currency)}</p></article>)}
    {editing && <form onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(Object.entries(draft).map(([id, n]) => [id, Number(n)])); if (Object.values(values).some(n => !Number.isFinite(n) || n < 0 || n > 1e12)) { setError(t.invalid); return; } updateState(s => ({ ...s, settings: { ...s.settings, reserveByWallet: JSON.stringify(values) } })); setEditing(false); }} className={styles.form}>{state.wallets.filter(w => !w.archived).map(w => <label key={w.id}>{w.name} · {w.currency}<input type="number" min={0} max={1e12} step="0.01" required value={draft[w.id] ?? "0"} onChange={e => setDraft(d => ({ ...d, [w.id]: e.target.value }))} /></label>)}{error && <p role="alert">{error}</p>}<button type="submit">{t.save}</button></form>}
    <small>{t.note}</small>
  </section>;
}
