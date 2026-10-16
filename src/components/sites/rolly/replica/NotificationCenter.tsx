"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Circle, CircleCheck } from "lucide-react";
import { detectProactiveAlerts, type FinancialAlert } from "@/lib/proactive-alerts";
import { buildNotificationFeed, notificationDestination, notificationReadIds } from "@/lib/notification-center";
import { today, updateState, useAppState } from "./store";
import styles from "./NotificationCenter.module.css";

const copy = {
  vi: { title: "Thông báo", empty: "Bạn chưa có thông báo.", unread: "Chưa đọc", read: "Đã đọc", handled: "Đã xử lý", markAll: "Đánh dấu tất cả đã đọc", markRead: "Đánh dấu đã đọc", close: "Đóng thông báo", open: "Mở thông báo", go: "Xem chi tiết", high: "Cao", medium: "Vừa", low: "Thấp" },
  en: { title: "Notifications", empty: "You have no notifications.", unread: "Unread", read: "Read", handled: "Handled", markAll: "Mark all as read", markRead: "Mark as read", close: "Close notifications", open: "Open notifications", go: "View details", high: "High", medium: "Medium", low: "Low" },
  zh: { title: "通知", empty: "暂无通知。", unread: "未读", read: "已读", handled: "已处理", markAll: "全部标为已读", markRead: "标为已读", close: "关闭通知", open: "打开通知", go: "查看详情", high: "高", medium: "中", low: "低" },
};
type Language = keyof typeof copy;

export function NotificationCenter({ navigate, floating = false }: { navigate: (path: string) => void; floating?: boolean }) {
  const state = useAppState();
  const lang: Language = /中文|zh/i.test(String(state.settings.language)) ? "zh" : /Tiếng Việt|vi/i.test(String(state.settings.language)) ? "vi" : "en";
  const t = copy[lang];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const asOf = today();
  const alerts = useMemo(() => detectProactiveAlerts(state, asOf, [], true), [state, asOf]);
  const feed = useMemo(() => buildNotificationFeed(alerts, state.settings.readFinancialAlertIds, state.settings.dismissedFinancialAlerts), [alerts, state.settings.readFinancialAlertIds, state.settings.dismissedFinancialAlerts]);
  const readIds = useMemo(() => notificationReadIds(state.settings.readFinancialAlertIds), [state.settings.readFinancialAlertIds]);
  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const unreadCount = feed.unreadCount;

  const markRead = useCallback((ids: string[]) => {
    if (!ids.some((id) => !readSet.has(id))) return;
    updateState((current) => {
      const currentIds = notificationReadIds(current.settings.readFinancialAlertIds);
      if (!ids.some((id) => !currentIds.includes(id))) return current;
      const next = [...new Set([...currentIds, ...ids])].slice(-1000);
      return { ...current, settings: { ...current.settings, readFinancialAlertIds: JSON.stringify(next) } };
    });
  }, [readSet]);

  useEffect(() => {
    const outside = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", outside); document.removeEventListener("keydown", escape); };
  }, []);

  const priorityText = (alert: FinancialAlert) => alert.priority === "high" ? t.high : alert.priority === "medium" ? t.medium : t.low;
  return <div className={`${styles.root}${floating ? ` ${styles.floating}` : ""}`} ref={root}>
    <button type="button" className={styles.trigger} aria-label={`${t.open}${unreadCount ? `, ${unreadCount}` : ""}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((value) => !value)}>
      <Bell size={20} />{unreadCount > 0 && <span className={styles.count}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className={styles.popover} role="dialog" aria-label={t.title}>
      <header className={styles.header}><h2>{t.title}</h2><button type="button" onClick={() => markRead(alerts.map((alert) => alert.id))} disabled={!unreadCount}><CheckCheck size={15} />{t.markAll}</button></header>
      {!feed.items.length ? <p className={styles.empty}>{t.empty}</p> : <ul className={styles.list}>{feed.items.map((alert) => {
        const isRead = alert.read, isHandled = alert.handled;
        return <li key={alert.id} className={`${styles.item} ${isRead ? "" : styles.unread}`}>
          <div className={styles.itemTop}><span className={`${styles.priority} ${styles[alert.priority]}`}>{priorityText(alert)}</span><span className={styles.status}>{isHandled && <><CircleCheck size={13} />{t.handled}</>}{isRead ? <><CircleCheck size={13} />{t.read}</> : <><Circle size={13} />{t.unread}</>}</span></div>
          <b>{alert.problem}</b><p>{alert.figures}</p><time>{alert.when}</time>
          {!isRead && <button type="button" className={styles.link} onClick={() => markRead([alert.id])}>{t.markRead}</button>}
          <button type="button" className={styles.link} onClick={() => { markRead([alert.id]); setOpen(false); navigate(notificationDestination(alert)); }}>{t.go}</button>
        </li>;
      })}</ul>}
    </section>}
  </div>;
}
