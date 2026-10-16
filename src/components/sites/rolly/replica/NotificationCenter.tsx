"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Settings2, X } from "lucide-react";
import { useSafety } from "@/components/safety/SafetyProvider";
import { detectProactiveAlerts } from "@/lib/proactive-alerts";
import { buildNotificationFeed, combineNotificationFeeds, notificationDestination, notificationReadIds } from "@/lib/notification-center";
import { safetyLanguage, type SafetyEvent } from "@/lib/safety-model";
import { flushWorkspace, today, updateState, useAppState } from "./store";
import { FinancialOutlook } from "./FinancialOutlook";
import styles from "./NotificationCenter.module.css";

const copy = {
  vi: { title: "Thông báo", empty: "Bạn chưa có thông báo.", noUnread: "Bạn đã đọc hết thông báo.", all: "Tất cả", unread: "Chưa đọc", read: "Đã đọc", markAll: "Đánh dấu tất cả đã đọc", markRead: "Đánh dấu đã đọc", close: "Đóng thông báo", open: "Mở thông báo", financial: "Nhắc nhở tài chính", safety: "Cảnh báo theo ngưỡng đã đặt", settings: "Cài đặt cảnh báo", history: "Xem lịch sử cảnh báo", value: "Giá trị khi cảnh báo", threshold: "Ngưỡng đã chạm", recordedAt: "Ghi nhận lúc", period: "Kỳ theo dõi", snapshot: "Đây là số liệu tại thời điểm gửi cảnh báo.", go: "Xem mục liên quan", readNote: "Đã đọc không có nghĩa đã xử lý hoặc đã thanh toán.", error: "Chưa cập nhật được một số thông báo. Vui lòng thử lại.", loadError: "Chưa tải được cảnh báo theo ngưỡng. Số chưa đọc có thể chưa đầy đủ.", retry: "Thử lại", loading: "Đang tải cảnh báo…", filters: "Lọc thông báo" },
  en: { title: "Notifications", empty: "You have no notifications.", noUnread: "You're all caught up.", all: "All", unread: "Unread", read: "Read", markAll: "Mark all as read", markRead: "Mark as read", close: "Close notifications", open: "Open notifications", financial: "Financial reminders", safety: "Your threshold alerts", settings: "Alert settings", history: "View alert history", value: "Value when alerted", threshold: "Threshold reached", recordedAt: "Recorded at", period: "Monitoring period", snapshot: "These values were recorded when this alert was sent.", go: "View related item", readNote: "Read does not mean resolved or paid.", error: "Some notifications could not be updated. Please try again.", loadError: "Threshold alerts could not be loaded. The unread count may be incomplete.", retry: "Retry", loading: "Loading alerts…", filters: "Filter notifications" },
  zh: { title: "通知", empty: "暂无通知。", noUnread: "所有通知均已读。", all: "全部", unread: "未读", read: "已读", markAll: "全部标为已读", markRead: "标为已读", close: "关闭通知", open: "打开通知", financial: "财务提醒", safety: "您设置的阈值提醒", settings: "提醒设置", history: "查看提醒历史", value: "提醒时的数值", threshold: "触发阈值", recordedAt: "记录时间", period: "监测周期", snapshot: "以下为发出提醒时记录的数值。", go: "查看相关项目", readNote: "已读不代表已解决或已付款。", error: "部分通知未能更新，请重试。", loadError: "暂时无法加载阈值提醒，未读数量可能不完整。", retry: "重试", loading: "正在加载提醒…", filters: "筛选通知" },
};

export function NotificationCenter({ navigate, floating = false }: { navigate: (path: string) => void; floating?: boolean }) {
  const state = useAppState(), safety = useSafety();
  const lang = safetyLanguage(state.settings.language), t = copy[lang];
  const [open, setOpen] = useState(false), [unreadOnly, setUnreadOnly] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<"all" | "financial" | "safety">("all");
  const [reading, setReading] = useState(false), [readError, setReadError] = useState(false);
  const readLock = useRef(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), closeButton = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const [asOf, setAsOf] = useState(today);
  useEffect(() => {
    const refresh = () => setAsOf(today());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const alerts = useMemo(() => detectProactiveAlerts(state, asOf, [], true), [state, asOf]);
  const feed = useMemo(() => buildNotificationFeed(alerts, state.settings.readFinancialAlertIds, state.settings.dismissedFinancialAlerts), [alerts, state.settings.readFinancialAlertIds, state.settings.dismissedFinancialAlerts]);
  const combined = useMemo(() => combineNotificationFeeds(feed, safety?.doc.events), [feed, safety?.doc.events]);
  const financialCount = sourceFilter === "safety" ? 0 : unreadOnly ? feed.unreadCount : feed.items.length;
  const visibleSafety = sourceFilter === "financial" ? [] : combined.safety.filter(event => !unreadOnly || !event.read);
  const unreadCount = combined.unreadCount, totalCount = feed.items.length + combined.safety.length;
  const busy = reading || !!safety?.busy || !!safety?.loading;

  const markRead = useCallback((ids: string[]) => {
    updateState(current => {
      const currentIds = notificationReadIds(current.settings.readFinancialAlertIds);
      if (!ids.some(id => !currentIds.includes(id))) return current;
      return { ...current, settings: { ...current.settings, readFinancialAlertIds: JSON.stringify([...new Set([...currentIds, ...ids])].slice(-1000)) } };
    });
  }, []);

  async function markSafetyRead(ids: string[]) {
    if (!safety || !ids.length || readLock.current || safety.busy) return;
    readLock.current = true; setReading(true); setReadError(false);
    try { await safety.mutate({ action: "read", ids }); }
    catch { setReadError(true); }
    finally { readLock.current = false; setReading(false); }
  }

  async function markAll() {
    if (readLock.current || busy) return;
    readLock.current = true; setReading(true); setReadError(false);
    try {
      markRead(feed.items.filter(item => !item.read).map(item => item.id));
      await flushWorkspace();
      const ids = combined.safety.filter(event => !event.read).map(event => event.id);
      if (safety && ids.length) await safety.mutate({ action: "read", ids });
    } catch { setReadError(true); }
    finally { readLock.current = false; setReading(false); }
  }

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const outside = (event: PointerEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const close = () => { setOpen(false); trigger.current?.focus(); };
  const go = (path: string) => { close(); navigate(path); };
  const time = (value: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const money = (value: number | null, currency: string) => {
    if (value === null || !Number.isFinite(value) || !currency) return "—";
    try { return new Intl.NumberFormat(lang, { style: "currency", currency }).format(value); } catch { return "—"; }
  };
  const destination = (event: SafetyEvent) => {
    const rule = safety?.doc.rules.find(rule => rule.id === event.ruleId);
    return rule ? `safetyAlerts?view=rules&query=${encodeURIComponent(rule.name)}` : "safetyAlerts?view=history";
  };
  return <div className={`${styles.root}${floating ? ` ${styles.floating}` : ""}`} ref={root}>
    <button ref={trigger} type="button" className={styles.trigger} aria-label={`${t.open}${unreadCount ? `, ${unreadCount}` : ""}`} aria-expanded={open} aria-controls={open ? panelId : undefined} aria-haspopup="dialog" onClick={() => setOpen(value => !value)}>
      <Bell size={20}/>{unreadCount > 0 && <span className={styles.count}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section id={panelId} className={styles.popover} role="dialog" aria-label={t.title}>
      <header className={styles.header}>
        <h2>{t.title}</h2>
        <button type="button" aria-label={t.markAll} title={t.markAll} disabled={!unreadCount || busy} onClick={() => void markAll()}><CheckCheck size={16}/>{t.markAll}</button>
        <button ref={closeButton} type="button" className={styles.close} aria-label={t.close} onClick={close}><X size={20}/></button>
      </header>
      <div className={styles.filters} role="group" aria-label={t.filters}>
        <button type="button" aria-pressed={sourceFilter === "all"} onClick={() => setSourceFilter("all")}>{t.all}<span>{totalCount}</span></button>
        <button type="button" aria-pressed={sourceFilter === "financial"} onClick={() => setSourceFilter("financial")}>{lang === "vi" ? "Nhắc việc" : lang === "zh" ? "提醒" : "Reminders"}<span>{feed.items.length}</span></button>
        <button type="button" aria-pressed={sourceFilter === "safety"} onClick={() => setSourceFilter("safety")}>{lang === "vi" ? "Ngưỡng" : lang === "zh" ? "阈值" : "Thresholds"}<span>{combined.safety.length}</span></button>
        <button type="button" className={styles.unreadToggle} aria-pressed={unreadOnly} onClick={() => setUnreadOnly(value => !value)}>{t.unread}<span>{unreadCount}</span></button>
      </div>
      <div className={styles.body}>
        {safety?.loading && <p className={styles.empty} role="status">{t.loading}</p>}
        {safety?.error && !readError && <div className={styles.error} role="alert">{t.loadError}<button type="button" disabled={busy} onClick={() => void safety.refresh().catch(() => {})}>{t.retry}</button></div>}
        {readError && <p className={styles.error} role="alert">{t.error}</p>}
        {!financialCount && !visibleSafety.length && !safety?.loading && !safety?.error && <p className={styles.empty}>{unreadOnly ? t.noUnread : t.empty}</p>}
        {visibleSafety.length > 0 && <section className={styles.source} aria-label={t.safety}>
          <h3 className={styles.sectionTitle}>{t.safety}<span>{visibleSafety.length}</span></h3>
          {visibleSafety.slice(0, 8).map(event => <article key={event.id} className={`${styles.item}${!event.read ? ` ${styles.unread}` : ""}`}>
            <details onToggle={e => { if (e.currentTarget.open && !event.read && !unreadOnly) void markSafetyRead([event.id]); }}>
              <summary><b>{event.name}</b><span className={styles.status}>{event.read ? t.read : t.unread}</span><time dateTime={event.createdAt}>{time(event.createdAt)}</time><p>{t.value}: {money(event.evaluation.value, event.evaluation.currency)}</p></summary>
              <dl className={styles.metrics}><div><dt>{t.threshold}</dt><dd>{money(event.evaluation.limit, event.evaluation.currency)}</dd></div><div><dt>{t.recordedAt}</dt><dd>{time(event.createdAt)}</dd></div>{event.evaluation.start !== "reserve" && <div><dt>{t.period}</dt><dd>{event.evaluation.start} – {event.evaluation.end}</dd></div>}</dl>
              <p>{t.snapshot}</p>
              <div className={styles.actions}>{!event.read && <button type="button" className={styles.link} disabled={busy} onClick={() => void markSafetyRead([event.id])}>{t.markRead}</button>}<button type="button" className={styles.link} onClick={() => go(destination(event))}>{t.go}</button></div>
            </details>
          </article>)}
          {visibleSafety.length > 8 && <button type="button" className={styles.link} onClick={() => go("safetyAlerts?view=history")}>{t.history} ({visibleSafety.length})</button>}
        </section>}
        {financialCount > 0 && <h3 className={styles.sectionTitle}>{t.financial}<span>{financialCount}</span></h3>}
        {sourceFilter !== "safety" && <FinancialOutlook editable notifications unreadOnly={unreadOnly} asOfDate={asOf} navigate={go}/>}
      </div>
      <footer className={styles.footer}>
        <p>{t.readNote}</p>
        <div><button type="button" onClick={() => go("safetyAlerts")}><Settings2 size={16}/>{t.settings}</button>{combined.safety.length > 0 && <button type="button" onClick={() => go("safetyAlerts?view=history")}>{t.history}</button>}</div>
      </footer>
    </section>}
  </div>;
}
