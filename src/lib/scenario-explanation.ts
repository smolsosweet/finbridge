import type { FinancialScenario, ScenarioResult } from "./scenario-planner";
import { formatScenarioDate, formatScenarioMoney } from "./scenario-format";

export function asksForCalculationExplanation(message: string): boolean {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();
  return /^(?:(?:ban|ai|bot|vay|the|cho minh biet|cho toi biet)\s+)*(?:(?:da )?tinh(?: so tien (?:do|nay))? (?:nhu the nao|nhu nao|the nao|sao)|cach tinh(?: (?:so tien|du bao|nay|do|vua roi))*|giai thich (?:cach tinh|phep tinh|con so nay)|how (?:did you|do you) calculate(?: (?:that|this|it))?|show (?:me )?(?:the )?(?:calculation|math)|怎么算的|怎么计算的|解释计算)[?!.\s]*$/.test(text);
}

/** Explain the exact displayed calculation snapshot, not a newly invented
 * forecast. No data mutation or additional model call is needed. */
export function scenarioCalculationExplanation(result: ScenarioResult, scenario: FinancialScenario, wallets: Array<{ id: string; name: string }>, asOf: string, lang: "vi" | "en" | "zh"): string {
  const labels = {
    vi: { heading: "Finn tính từ các khoản sau", now: "Tiền trong ví ngày", pace: "Mức chi trung bình/ngày", future: "Chi sinh hoạt dự kiến thêm", days: "ngày từ ngày mai", other: "Phần chưa tách được trong kết quả cũ", end: "Tiền còn lại dự kiến", note: "Giữ nguyên nhịp chi đã ghi nhận và chưa tính thu nhập mới ngoài kịch bản.", missing: "Chưa đủ dữ liệu cho toàn bộ dự báo; đây mới là kết quả của những khoản tính được.", bills: "Hóa đơn chưa trả", expense: "Khoản chi giả định", income: "Khoản thu giả định", daily: "Chi theo mức mỗi ngày bạn chọn", reduced: "Chi sau điều chỉnh danh mục" },
    en: { heading: "Here is what Finn used", now: "Money in the wallet on", pace: "Average daily spending", future: "Further estimated living expenses", days: "days, starting tomorrow", other: "Unresolved part of an older result", end: "Projected money left", note: "Assumes recorded spending continues, with no new income outside the scenario.", missing: "Some data is missing; this includes only calculable items.", bills: "Unpaid bills", expense: "Hypothetical expense", income: "Hypothetical income", daily: "Spending at your chosen daily limit", reduced: "Spending after category adjustments" },
    zh: { heading: "Finn 使用了以下数据", now: "钱包余额日期", pace: "日均支出", future: "预计后续生活支出", days: "天，从明天开始", other: "旧结果中尚未拆分的部分", end: "预计剩余金额", note: "假设保持已记录支出，不增加情景以外的新收入。", missing: "部分数据不足，以下仅包含可计算项目。", bills: "未付账单", expense: "假设支出", income: "假设收入", daily: "按你设置的每日限额支出", reduced: "调整类别后的支出" },
  }[lang];
  const money = (value: number, currency: string) => formatScenarioMoney(value, currency, lang);
  return [labels.heading, ...result.wallets.map(wallet => {
    const estimate = result.estimatedSpending.find(item => item.walletId === wallet.walletId && item.currency === wallet.currency);
    const c = wallet.components;
    const terms: Array<{ label: string; amount: number; sign: 1 | -1 }> = [];
    const add = (label: string, amount: number, sign: 1 | -1 = -1) => { if (amount) terms.push({ label, amount, sign }); };
    add(labels.bills, c?.unpaidBills ?? result.plannedBills.filter(b => b.walletId === wallet.walletId).reduce((sum, b) => sum + b.amount, 0));
    add(labels.future, c?.paceSpending ?? estimate?.amount ?? 0);
    add(labels.expense, c?.hypotheticalExpense || 0);
    add(labels.income, c?.hypotheticalIncome || 0, 1);
    add(labels.daily, c?.dailyLimitSpending || 0);
    add(labels.reduced, c?.reducedCategorySpending || 0);
    const unresolved = Math.round((wallet.projectedBalance - wallet.balanceNow - terms.reduce((sum, item) => sum + item.sign * item.amount, 0)) * 10000) / 10000;
    if (unresolved) add(labels.other, Math.abs(unresolved), unresolved > 0 ? 1 : -1);
    const billDetails = result.plannedBills.filter(b => b.walletId === wallet.walletId).map(b => `${b.title} (${formatScenarioDate(b.date, lang)})`).join(", ");
    const purchases = scenario.changes.filter(change => change.walletId === wallet.walletId && change.direction === "expense" && change.amount && change.date && change.date >= asOf && (!scenario.horizonEnd || change.date <= scenario.horizonEnd)).map(change => change.title).join(", ");
    return [wallets.find(item => item.id === wallet.walletId)?.name || wallet.walletId,
      `• ${labels.now} ${formatScenarioDate(asOf, lang)}: **${money(wallet.balanceNow, wallet.currency)}**`,
      ...(estimate ? [`• ${labels.pace}: ≈ ${money(estimate.dailyAverage, wallet.currency)} (${estimate.days} ${labels.days})`] : []),
      ...terms.map(item => `• ${item.label}${item.label === labels.bills && billDetails ? ` · ${billDetails}` : item.label === labels.expense && purchases ? ` · ${purchases}` : ""}: **${money(item.amount, wallet.currency)}**`),
      `${labels.end}${scenario.horizonEnd ? ` (${formatScenarioDate(scenario.horizonEnd, lang)})` : ""}:\n${money(wallet.balanceNow, wallet.currency)}${terms.map(item => ` ${item.sign === 1 ? "+" : "−"} ${money(item.amount, wallet.currency)}`).join("")} = **${money(wallet.projectedBalance, wallet.currency)}**`,
    ].join("\n");
  }), result.unavailableEstimates.length ? labels.missing : result.estimatedSpending.length ? labels.note : ""].filter(Boolean).join("\n\n");
}
