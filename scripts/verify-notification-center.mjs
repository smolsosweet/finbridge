import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildNotificationFeed, combineNotificationFeeds, notificationDestination } from "../src/lib/notification-center.ts";
import { detectProactiveAlerts } from "../src/lib/proactive-alerts.ts";

const state = () => ({
  wallets: [{ id: "usd", name: "Main", currency: "USD", initial: 100, type: "cash" }],
  transactions: [{ id: "overspend", title: "Food", amount: 125, type: "expense", category: "Food", date: "2026-10-10", wallet: "usd", note: "" }],
  goals: [{ id: "food", kind: "budget", title: "Food", amount: 100, saved: 0, currency: "USD", date: "2026-10-01", cycle: "monthly", category: "Food", wallet: "usd", direction: "", person: "" }],
  fixedExpenses: [{ id: "rent", title: "Rent", amount: 50, category: "Housing", dueDate: "2026-10-17", recurrence: "once", active: true, reminderDays: 3, walletId: "usd", budgetId: "" }],
  recurring: [], rules: [], categories: ["Food"], categoryMeta: { Food: { type: "expense", icon: "🍽️", children: [] } }, settings: { language: "English" },
});

test("deduplicates identical alert IDs and counts unread separately from handled", () => {
  const alerts = detectProactiveAlerts(state(), "2026-10-15", [], true);
  const duplicated = [...alerts, ...alerts];
  const budget = alerts.find((alert) => alert.kind === "budget-exceeded");
  assert.ok(budget);
  const feed = buildNotificationFeed(duplicated, JSON.stringify([budget.id]), JSON.stringify([budget.id]));
  assert.equal(feed.items.length, alerts.length);
  assert.equal(feed.unreadCount, alerts.length - 1);
  assert.equal(feed.items.find((item) => item.id === budget.id)?.read, true);
  assert.equal(feed.items.find((item) => item.id === budget.id)?.handled, true);
});

test("reading a notification does not mark it handled, and handled notifications can remain unread", () => {
  const alerts = detectProactiveAlerts(state(), "2026-10-15", [], true);
  const due = alerts.find((alert) => alert.kind === "fixed-due");
  assert.ok(due);
  const unreadHandled = buildNotificationFeed(alerts, "[]", JSON.stringify([due.id])).items.find((item) => item.id === due.id);
  assert.deepEqual({ read: unreadHandled?.read, handled: unreadHandled?.handled }, { read: false, handled: true });
  const readActive = buildNotificationFeed(alerts, JSON.stringify([due.id]), "[]").items.find((item) => item.id === due.id);
  assert.deepEqual({ read: readActive?.read, handled: readActive?.handled }, { read: true, handled: false });
});

test("notification links target the matching budget or fixed expense in Planning", () => {
  const alert = detectProactiveAlerts(state(), "2026-10-15", [], true);
  const budget = alert.find((item) => item.kind === "budget-exceeded");
  const due = alert.find((item) => item.kind === "fixed-due");
  assert.ok(budget && due);
  assert.equal(notificationDestination(budget), `?tab=tools#budget-${budget.targetId}`);
  assert.equal(notificationDestination(due), `?tab=tools&plan=fixed#fixed-${due.targetId}`);
  const walletAlert = alert.find((item) => item.targetType === "wallet");
  assert.ok(walletAlert);
  assert.equal(notificationDestination(walletAlert), `walletSettings?wallet=${walletAlert.targetId}`);
});

test("empty notification source returns a zero unread count", () => {
  assert.deepEqual(buildNotificationFeed([], "[]", "[]"), { items: [], unreadCount: 0 });
});

test("one badge combines both sources without losing items whose IDs happen to match", () => {
  const financial = buildNotificationFeed(detectProactiveAlerts(state(), "2026-10-15", [], true), "[]", "[]");
  const first = { id: financial.items[0].id, read: false, createdAt: "2026-10-15T12:00:00Z" };
  const seen = { id: "seen", read: true, createdAt: "2026-10-16T12:00:00Z" };
  const second = { id: "second", read: false, createdAt: "2026-10-16T10:00:00Z" };
  const feed = combineNotificationFeeds(financial, [first, seen, second, first]);
  assert.equal(feed.unreadCount, financial.unreadCount + 2);
  assert.deepEqual(feed.safety.map(event => event.id), ["second", first.id, "seen"]);
  assert.equal(feed.financial.items.length, financial.items.length);
});

test("read threshold history never counts as new or changes a financial reminder's handled state", () => {
  const alerts = detectProactiveAlerts(state(), "2026-10-15", [], true);
  const financial = buildNotificationFeed(alerts, JSON.stringify(alerts.map(alert => alert.id)), "[]");
  const combined = combineNotificationFeeds(financial, [{ id: "old", read: true, createdAt: "2026-10-15T12:00:00Z" }]);
  assert.equal(combined.unreadCount, 0);
  assert.ok(combined.financial.items.every(item => item.read && !item.handled));
});

test("small-screen notification panel has a viewport-bounded responsive layout", async () => {
  const css = await readFile(new URL("../src/components/sites/rolly/replica/NotificationCenter.module.css", import.meta.url), "utf8");
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /width:\s*calc\(100vw\s*-\s*24px\)/);
  assert.match(css, /max-height:\s*min\(72vh/);
});
