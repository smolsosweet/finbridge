"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Bell, Check, ShieldCheck, TrendingUp } from "lucide-react";
import { reserveAmounts } from "@/lib/financial-outlook";
import { notificationDestination, notificationReadIds } from "@/lib/notification-center";
import { detectProactiveAlerts, readDismissedAlertIds, type FinancialAlert } from "@/lib/proactive-alerts";
import { updateState, useAppState, today } from "./store";
import { Modal } from "./Ui";
import styles from "./FinancialOutlook.module.css";

const COPY = {
  vi: { title: "Cảnh báo tài chính", empty: "Chưa có cảnh báo cần xử lý.", reserve: "Chỉnh mức dự phòng", save: "Lưu mức dự phòng", priority: "Ưu tiên", high: "Cao", medium: "Vừa", low: "Thấp", problem: "Vấn đề", figures: "Số liệu và thời điểm", cause: "Nguyên nhân", action: "Hành động đề xuất", assumptions: "Giả định / giới hạn", actual: "Thực tế", forecast: "Dự báo", schedule: "Lịch dự kiến", handled: "Đã xử lý", read: "Đã đọc", unread: "Chưa đọc", markRead: "Đánh dấu đã đọc", note: "Cảnh báo được tính từ dữ liệu đã lưu. Dự báo chỉ gồm giả định nêu trong từng cảnh báo; không thực hiện thanh toán.", invalid: "Mức dự phòng phải là số không âm hợp lệ.", details: "Mở kế hoạch" },
  en: { title: "Financial alerts", empty: "No alerts need attention right now.", reserve: "Edit reserves", save: "Save reserves", priority: "Priority", high: "High", medium: "Medium", low: "Low", problem: "Issue", figures: "Figures and timing", cause: "Cause", action: "Suggested action", assumptions: "Assumptions / limits", actual: "Actual", forecast: "Forecast", schedule: "Scheduled", handled: "Handled", read: "Read", unread: "Unread", markRead: "Mark as read", note: "Alerts use saved data. Forecasts include only the assumptions shown in each alert; no payments are made.", invalid: "Reserves must be a valid non-negative amount.", details: "Open planning" },
  zh: { title: "财务提醒", empty: "目前没有需要处理的提醒。", reserve: "编辑备用金", save: "保存备用金", priority: "优先级", high: "高", medium: "中", low: "低", problem: "问题", figures: "数据与时间", cause: "原因", action: "建议操作", assumptions: "假设 / 限制", actual: "实际", forecast: "预测", schedule: "计划", handled: "已处理", read: "已读", unread: "未读", markRead: "标为已读", note: "提醒根据已保存的数据生成。预测仅包含每条提醒中列出的假设；不会执行付款。", invalid: "备用金必须是有效的非负金额。", details: "打开计划" },
};
type Language = keyof typeof COPY;
type AiNote = { explanation: string; suggestion: string };

export function FinancialOutlook({ editable = false, compact = false, notifications = false, unreadOnly = false, asOfDate, navigate }: { editable?: boolean; compact?: boolean; notifications?: boolean; unreadOnly?: boolean; asOfDate?: string; navigate?: (path: string) => void }) {
  const state = useAppState();
  const lang: Language = /中文|zh/i.test(String(state.settings.language)) ? "zh" : /Tiếng Việt|vi/i.test(String(state.settings.language)) ? "vi" : "en";
  const t = COPY[lang];
  const [asOf, setAsOf] = useState(today);
  const [aiNotes, setAiNotes] = useState<Record<string, AiNote>>({});
  const attemptedIds = useRef(new Set<string>());
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState<Record<string, string>>({}), [error, setError] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<FinancialAlert | null>(null);
  useEffect(() => {
    const refresh = () => setAsOf(today());
    const timer = window.setInterval(refresh, 60000); window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const dismissedRaw = String(state.settings.dismissedFinancialAlerts || "[]");
  const alerts = useMemo(() => detectProactiveAlerts(state, asOfDate || asOf, readDismissedAlertIds(dismissedRaw), notifications), [state, asOf, asOfDate, dismissedRaw, notifications]);
  const handledIds = new Set(readDismissedAlertIds(dismissedRaw));
  const readSet = useMemo(() => new Set(notificationReadIds(state.settings.readFinancialAlertIds)), [state.settings.readFinancialAlertIds]);
  useEffect(() => {
    if (compact) return;
    const pending = alerts.filter((alert) => !attemptedIds.current.has(`${lang}:${alert.id}`));
    if (!pending.length) return;
    pending.forEach((alert) => attemptedIds.current.add(`${lang}:${alert.id}`));
    const language = lang;
    const payload = pending.map(({ id, kind, problem, figures, when, cause, priority, suggestedAction, assumptions }) => ({ id, kind, problem, figures, when, cause, priority, suggestedAction, assumptions }));
    void fetch("/api/ai/proactive-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language, alerts: payload }) })
      .then(async (response) => response.ok ? response.json() as Promise<{ alerts?: unknown }> : null)
      .then((data) => {
        if (!data || !Array.isArray(data.alerts)) return;
        const allowed = new Set(pending.map((alert) => alert.id));
        const parsed: Record<string, AiNote> = {};
        for (const item of data.alerts) {
          if (!item || typeof item !== "object") continue;
          const note = item as { id?: unknown; explanation?: unknown; suggestion?: unknown };
          if (typeof note.id !== "string" || !allowed.has(note.id) || typeof note.explanation !== "string" || typeof note.suggestion !== "string"
            || /[\d$€£¥₫]/.test(`${note.explanation} ${note.suggestion}`)) continue;
          parsed[`${language}:${note.id}`] = { explanation: note.explanation, suggestion: note.suggestion };
        }
        if (Object.keys(parsed).length) setAiNotes((previous) => ({ ...previous, ...parsed }));
      }).catch(() => undefined);
  }, [alerts, dismissedRaw, lang, compact]);

  const reserves = reserveAmounts(state);
  const dismiss = (alert: FinancialAlert) => {
    updateState(current => ({ ...current, settings: {
      ...current.settings,
      dismissedFinancialAlerts: JSON.stringify([...new Set([...readDismissedAlertIds(current.settings.dismissedFinancialAlerts), alert.id])].slice(-300)),
      readFinancialAlertIds: JSON.stringify([...new Set([...notificationReadIds(current.settings.readFinancialAlertIds), alert.id])].slice(-1000)),
    } }));
  };
  const markRead = (id: string) => updateState((current) => {
    const ids = notificationReadIds(current.settings.readFinancialAlertIds);
    return ids.includes(id) ? current : { ...current, settings: { ...current.settings, readFinancialAlertIds: JSON.stringify([...ids, id].slice(-1000)) } };
  });
  const priorityLabel = (priority: FinancialAlert["priority"]) => priority === "high" ? t.high : priority === "medium" ? t.medium : t.low;
  const dashboardAlerts = alerts.filter((alert) => alert.priority === "high" || alert.priority === "medium").slice(0, 3);
  const visibleAlerts = (compact ? dashboardAlerts : alerts).filter(alert => !unreadOnly || !readSet.has(alert.id));
  if (!editable && !visibleAlerts.length) return null;
  return <><section className={`${styles.panel}${compact ? ` ${styles.compact}` : ""}${notifications ? ` ${styles.notifications}` : ""}`} aria-label={t.title}>
    <header>{!notifications && <h2><ShieldCheck size={20} />{t.title}</h2>}{editable && <button type="button" onClick={() => { setEditing((value) => !value); setDraft(Object.fromEntries(state.wallets.filter((wallet) => !wallet.archived).map((wallet) => [wallet.id, String(reserves[wallet.id] || 0)]))); setError(""); }}>{t.reserve}</button>}</header>
    {editing && <form onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries(Object.entries(draft).map(([id, amount]) => [id, Number(amount)])); if (Object.values(values).some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 1e12)) { setError(t.invalid); return; } updateState((current) => ({ ...current, settings: { ...current.settings, reserveByWallet: JSON.stringify(values) } })); setEditing(false); }} className={styles.form}>{state.wallets.filter((wallet) => !wallet.archived).map((wallet) => <label key={wallet.id}>{wallet.name} · {wallet.currency}<input type="number" min={0} max={1e12} step="0.01" required value={draft[wallet.id] ?? "0"} onChange={(event) => setDraft((value) => ({ ...value, [wallet.id]: event.target.value }))} /></label>)}{error && <p role="alert">{error}</p>}<button type="submit">{t.save}</button></form>}
    {!visibleAlerts.length && !notifications && <p>{t.empty}</p>}
    {visibleAlerts.map((alert) => {
      const Icon = alert.kind === "fixed-due" ? Bell : alert.kind === "budget-risk" ? TrendingUp : AlertTriangle;
      const ai = aiNotes[`${lang}:${alert.id}`];
      const isRead = readSet.has(alert.id);
      const origin = alert.projected ? t.forecast : alert.kind === "fixed-due" ? t.schedule : t.actual;
      if (compact) return <article key={alert.id} className={`${styles.alert} ${styles.compactAlert} ${styles[alert.priority]}`}>
        <span className={styles.compactIcon}><Icon size={17}/></span>
        <div className={styles.compactCopy}><h3>{alert.problem}</h3><p>{alert.figures}</p><small>{origin} · {alert.when}</small></div>
        <span className={styles.priority}>{priorityLabel(alert.priority)}</span>
        <button type="button" className={styles.compactDetails} onClick={() => { markRead(alert.id); setSelectedAlert(alert); }}>{lang === "vi" ? "Chi tiết" : lang === "zh" ? "详情" : "Details"}</button>
      </article>;
      const detail = <>
        <div><b>{t.figures}</b><p>{alert.figures}</p><p>{origin} · {alert.when}</p></div>
        <div><b>{t.cause}</b><p>{ai?.explanation || alert.cause}</p></div>
        <div><b>{t.action}</b><p>{ai?.suggestion || alert.suggestedAction}</p></div>
        <small>{t.assumptions}: {alert.assumptions}</small>
        <div className={styles.actions}>{!isRead && <button type="button" className={styles.dismiss} onClick={() => markRead(alert.id)}>{t.markRead}</button>}{navigate && <button type="button" className={styles.dismiss} onClick={() => { markRead(alert.id); navigate(notificationDestination(alert)); }}>{t.details}</button>}<button type="button" disabled={handledIds.has(alert.id)} className={styles.dismiss} onClick={() => dismiss(alert)}><Check size={15} />{t.handled}</button></div>
      </>;
      const heading = <><h3><Icon size={16} />{alert.problem}</h3><span className={styles.priority}>{t.priority}: {priorityLabel(alert.priority)}</span><span className={styles.readStatus}>{isRead ? t.read : t.unread}{handledIds.has(alert.id) ? ` · ${t.handled}` : ""}</span></>;
      if (notifications) return <article key={alert.id} className={`${styles.alert} ${styles[alert.priority]}${!isRead ? ` ${styles.unread}` : ""}`}>
        <details onToggle={event => { if (event.currentTarget.open && !isRead && !unreadOnly) markRead(alert.id); }}>
          <summary><div className={styles.summaryHeading}>{heading}</div><p>{alert.figures}</p><small>{origin} · {alert.when}</small></summary>
          <div className={styles.detail}>{detail}</div>
        </details>
      </article>;
      return <article key={alert.id} className={`${styles.alert} ${styles[alert.priority]}`}>
        <header>{heading}</header>{detail}
      </article>;
    })}
    {(!notifications || visibleAlerts.length > 0) && <small>{t.note}</small>}
  </section>{compact && selectedAlert && (() => {
    const Icon = selectedAlert.kind === "fixed-due" ? Bell : selectedAlert.kind === "budget-risk" ? TrendingUp : AlertTriangle;
    const origin = selectedAlert.projected ? t.forecast : selectedAlert.kind === "fixed-due" ? t.schedule : t.actual;
    return <Modal title={t.title} onClose={() => setSelectedAlert(null)}>
      <div className={styles.modalDetail}>
        <div className={styles.modalHeading}><Icon size={20}/><div><h3>{selectedAlert.problem}</h3><span className={styles.priority}>{t.priority}: {priorityLabel(selectedAlert.priority)}</span></div></div>
        <section><b>{t.figures}</b><p>{selectedAlert.figures}</p><small>{origin} · {selectedAlert.when}</small></section>
        <section><b>{t.cause}</b><p>{selectedAlert.cause}</p></section>
        <section><b>{t.action}</b><p>{selectedAlert.suggestedAction}</p></section>
        <small>{t.assumptions}: {selectedAlert.assumptions}</small>
        <div className={styles.actions}>{navigate && <button type="button" className={styles.dismiss} onClick={() => { const destination = notificationDestination(selectedAlert); setSelectedAlert(null); navigate(destination); }}>{t.details}</button>}<button type="button" className={styles.dismiss} onClick={() => setSelectedAlert(null)}>{lang === "vi" ? "Đóng" : lang === "zh" ? "关闭" : "Close"}</button></div>
      </div>
    </Modal>;
  })()}</>;
}
