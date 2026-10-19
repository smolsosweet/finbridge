import type { AppState, ChatMessage } from "../components/finbridge/workspace/store";
import { calculateSpendingPlan } from "./financial-outlook";
export function modelHistory(messages: ChatMessage[]) {
  // Never send locally computed amounts to Gemini. Preserve only non-sensitive
  // entity/date metadata so follow-ups such as "that category" can be resolved.
  return messages.filter(m => !m.localOnly || m.financialContext || m.scenarios || m.spendingPlan || m.planningDeletion || m.financialEntities).slice(-12).map(({ role, text, localOnly, financialContext, scenarios, spendingPlan, planningDeletion, financialEntities }) => ({
    role,
    text: planningDeletion ? `Previous planning entity references (IDs only; never reuse amounts): ${JSON.stringify({ kind: planningDeletion.kind, status: planningDeletion.status, entities: planningDeletion.targets.filter(t => !planningDeletion.selectedIds.length || planningDeletion.selectedIds.includes(t.id)).map(t => ({ id: t.id, title: t.title })) })}`.slice(0, 1000) : spendingPlan ? `Previous spending plan assumptions only (recalculate from current data; month-end, unpaid bills including overdue, flexible spending pace, protected reserves): ${JSON.stringify(spendingPlan)}`.slice(0, 1000) : scenarios?.length ? `Previous hypothetical assumptions only (recalculate from current data): ${JSON.stringify(scenarios)}`.slice(0, 1000) : localOnly && financialContext
      ? `Previous financial result context (recalculate from current data; do not reuse prior amounts): action=${financialContext.action}; category=${financialContext.category || "unspecified"}; period=${financialContext.periodStart || "default"}..${financialContext.periodEnd || "default"}; percentage=${financialContext.percentage ?? "unspecified"}; walletId=${JSON.stringify(financialContext.walletId || null)}; scope=${financialContext.scope || "unspecified"}; bill=${JSON.stringify(financialContext.searchTerm || null)}. ${financialEntities?.length ? `Previous planning entity references: ${JSON.stringify(financialEntities)}` : ""}`.trim().slice(0, 1000)
      : text.slice(0, 600),
  }));
}
export function localPlanReply(state: AppState, asOf: string, walletIds?: string[]) {
  const lang = /中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en";
  const t = {
    vi: { now: "Số dư hiện tại", projected: "Số dư dự kiến", empty: "Chưa có ví phù hợp để lập kế hoạch.", missing: "Chưa xác định: thiếu lịch sử hoặc dữ liệu chưa nhất quán", note: "Trừ các khoản chưa trả đến cuối tháng và dự báo chi linh hoạt từ lịch sử. Không cộng thu nhập chưa ghi nhận; không thực hiện thanh toán." },
    en: { now: "Current balance", projected: "Projected balance", empty: "No matching wallet for a spending plan.", missing: "Unknown: insufficient history or inconsistent data", note: "Deducts unpaid bills through month-end and forecasts flexible spending from history. No unrecorded income or payments are added." },
    zh: { now: "当前余额", projected: "预计余额", empty: "没有匹配的钱包可制定计划。", missing: "尚未确定：历史不足或数据不一致", note: "扣除月底前未付账单，并根据历史估算灵活支出。不增加未记录收入，不会执行付款。" },
  }[lang];
  const facts = calculateSpendingPlan(state, asOf, walletIds ? { walletIds } : {});
  const money = (n: number, c: string) => {
    const fractionDigits = c === "VND" || c === "JPY" || c === "KRW" ? 0 : 2;
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: 2 }).format(n) + " " + c;
  };
  const lines = [
    ...facts.wallets.map(w => `${w.name} · ${w.currency}: ${t.now} ${w.balance === null ? t.missing : money(w.balance, w.currency)}; ${t.projected} (${facts.end}) ${w.projected === null ? t.missing : money(w.projected, w.currency)}.`),
  ];
  return lines.length ? lines.join("\n\n") + "\n\n" + t.note : t.empty;
}
