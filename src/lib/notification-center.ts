import { readDismissedAlertIds, type FinancialAlert } from "./proactive-alerts";
import type { SafetyEvent } from "./safety-model";

export interface NotificationItem extends FinancialAlert { read: boolean; handled: boolean; }
export interface NotificationFeed { items: NotificationItem[]; unreadCount: number; }

function idsFromSetting(value: unknown) {
  try {
    const parsed: unknown = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string").slice(-1000) : [];
  } catch { return []; }
}

export function buildNotificationFeed(alerts: readonly FinancialAlert[], readSetting: unknown, handledSetting: unknown): NotificationFeed {
  const readIds = new Set(idsFromSetting(readSetting));
  const handledIds = new Set(readDismissedAlertIds(handledSetting));
  const unique = new Map<string, FinancialAlert>();
  for (const alert of alerts) if (!unique.has(alert.id)) unique.set(alert.id, alert);
  const items = [...unique.values()].map((alert) => ({ ...alert, read: readIds.has(alert.id), handled: handledIds.has(alert.id) }));
  return { items, unreadCount: items.filter((item) => !item.read).length };
}

export function notificationDestination(alert: Pick<FinancialAlert, "targetType" | "targetId">) {
  if (alert.targetType === "budget") return `?tab=tools#budget-${encodeURIComponent(alert.targetId)}`;
  if (alert.targetType === "fixed-expense") return `?tab=tools&plan=fixed#fixed-${encodeURIComponent(alert.targetId)}`;
  return `walletSettings?wallet=${encodeURIComponent(alert.targetId)}`;
}

export function notificationReadIds(value: unknown) { return idsFromSetting(value); }

/** Keep the two sources distinct; an equal ID in another source is not a duplicate. */
export function combineNotificationFeeds(financial: NotificationFeed, events: readonly SafetyEvent[] = []) {
  const unique = new Map<string, SafetyEvent>();
  for (const event of events) if (!unique.has(event.id)) unique.set(event.id, event);
  const safety = [...unique.values()].sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt));
  return { financial, safety, unreadCount: financial.unreadCount + safety.filter(event => !event.read).length };
}
