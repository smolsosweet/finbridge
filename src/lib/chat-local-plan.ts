import type { AppState, ChatMessage } from "../components/sites/rolly/replica/store";
import { financialOutlook } from "./financial-outlook";
export function modelHistory(messages: ChatMessage[]) {
  // Never send locally computed amounts to Gemini. Preserve only non-sensitive
  // entity/date metadata so follow-ups such as "that category" can be resolved.
  return messages.filter(m => !m.localOnly || m.financialContext || m.scenarios).slice(-8).map(({ role, text, localOnly, financialContext, scenarios }) => ({
    role,
    text: scenarios?.length ? `Previous hypothetical assumptions only (recalculate from current data): ${JSON.stringify(scenarios)}`.slice(0, 1000) : localOnly && financialContext
      ? `Previous financial result context (recalculate from current data; do not reuse prior amounts): action=${financialContext.action}; category=${financialContext.category || "unspecified"}; period=${financialContext.periodStart || "default"}..${financialContext.periodEnd || "default"}; percentage=${financialContext.percentage ?? "unspecified"}.`
      : text.slice(0, 600),
  }));
}
export function localPlanReply(state: AppState, asOf: string, walletIds?: string[]) {
  const lang = /中文|zh/.test(String(state.settings.language)) ? "zh" : /Việt|vi/.test(String(state.settings.language)) ? "vi" : "en";
  const t = {
    vi: { daily: "Tối đa mỗi ngày còn lại", projected: "Ước tính cuối kỳ nếu giữ nhịp chi", after: "Nếu khoản này chưa trả, số dư sau khi trả", reserve: "dự phòng", warning: "Thấp hơn dự phòng", empty: "Hãy tạo ngân sách hoặc khoản chi cố định để Finn lập kế hoạch từ dữ liệu của bạn.", missing: "Chưa đủ dữ liệu chuyển khoản khác tiền tệ để tính số dư", note: "Đây là phép tính từ giao dịch đã ghi, không dự đoán thu nhập tương lai, không tự thanh toán." },
    en: { daily: "Suggested ceiling per remaining day", projected: "End-of-period estimate at current pace", after: "If this bill is unpaid, balance after paying", reserve: "reserve", warning: "Below reserve", empty: "Add a budget or fixed expense so Finn can build a plan from your data.", missing: "Cross-currency transfer data is incomplete", note: "Calculated from recorded transactions; no future-income prediction or automatic payments." },
    zh: { daily: "剩余天数建议每日上限", projected: "按当前速度估算期末支出", after: "如果此账单未支付，付款后的余额", reserve: "备用金", warning: "低于备用金", empty: "请添加预算或固定支出，让 Finn 制定计划。", missing: "跨币种转账数据不完整", note: "根据已记录交易计算，不预测未来收入，不会自动付款。" },
  }[lang];
  const facts = financialOutlook(state, asOf), includes = (id: string) => !walletIds || walletIds.includes(id);
  const money = (n: number, c: string) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n) + " " + c;
  const lines = [
    ...facts.budgets.filter(b => includes(b.budget.wallet)).map(b => `${b.budget.title}: ${t.daily} ${money(b.dailyAllowance, b.budget.currency)}; ${t.projected} ${money(b.projected, b.budget.currency)}.`),
    ...facts.expenses.filter(e => includes(e.wallet.id)).map(e => `${e.expense.title} · ${e.due}: ${e.balance.complete ? `${t.after} ${money(e.after, e.wallet.currency)}; ${t.reserve} ${money(e.reserve, e.wallet.currency)}.${e.belowReserve ? " " + t.warning : ""}` : t.missing}`),
  ];
  return lines.length ? lines.join("\n\n") + "\n\n" + t.note : t.empty;
}
