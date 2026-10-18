import type { FinancialScenario, ScenarioResult } from "./scenario-planner";

export function asksForCalculationExplanation(message: string): boolean {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").trim();
  return /^(?:(?:ban|ai|bot|vay|the|cho minh biet|cho toi biet)\s+)*(?:(?:da )?tinh(?: so tien (?:do|nay))? (?:nhu the nao|nhu nao|the nao|sao)|cach tinh(?: (?:so tien|du bao|nay|do|vua roi))*|giai thich (?:cach tinh|phep tinh|con so nay)|how (?:did you|do you) calculate(?: (?:that|this|it))?|show (?:me )?(?:the )?(?:calculation|math)|怎么算的|怎么计算的|解释计算)[?!.\s]*$/.test(text);
}

/** Explain the exact displayed calculation snapshot, not a newly invented
 * forecast. No data mutation or additional model call is needed. */
export function scenarioCalculationExplanation(result: ScenarioResult, scenario: FinancialScenario, wallets: Array<{ id: string; name: string }>, asOf: string, lang: "vi" | "en" | "zh"): string {
  const labels = {
    vi: { heading: "Cách tính dự báo vừa rồi", now: "Số dư tại", pace: "Chi trung bình/ngày", future: "Chi dự kiến thêm", days: "ngày", other: "Điều chỉnh ròng khác trong kịch bản", end: "Số dư dự kiến", note: "Ước tính theo nhịp chi từ lịch sử đã ghi nhận; chưa cộng thu nhập mới ngoài kịch bản.", missing: "Chưa đủ lịch sử để dự báo một phần chi tiêu; số dư dự kiến chỉ gồm những khoản đã tính được." },
    en: { heading: "How the previous forecast was calculated", now: "Balance as of", pace: "Average daily spending", future: "Further estimated spending", days: "days", other: "Other net scenario adjustments", end: "Projected balance", note: "Estimated using recorded spending history; no new income outside the scenario is added.", missing: "Some spending cannot be forecast from the available history; the projection includes only calculable items." },
    zh: { heading: "刚才预测的计算方式", now: "余额日期", pace: "日均支出", future: "后续预计支出", days: "天", other: "情景中其他净调整", end: "预计余额", note: "根据已记录的历史支出估算；未增加情景以外的新收入。", missing: "部分支出历史不足，预测仅包含可计算的项目。" },
  }[lang];
  const money = (value: number, currency: string) => `${new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: currency === "VND" ? 0 : 2 }).format(value)} ${currency}`;
  return [labels.heading, ...result.wallets.map(wallet => {
    const estimate = result.estimatedSpending.find(item => item.walletId === wallet.walletId && item.currency === wallet.currency);
    const spending = estimate?.amount || 0;
    const adjustment = Math.round((wallet.projectedBalance - wallet.balanceNow + spending) * 100) / 100;
    return [wallets.find(item => item.id === wallet.walletId)?.name || wallet.walletId,
      `• ${labels.now} ${asOf}: **${money(wallet.balanceNow, wallet.currency)}**`,
      ...(estimate ? [`• ${labels.pace}: ≈ ${money(estimate.dailyAverage, wallet.currency)}`, `• ${labels.future} (${estimate.days} ${labels.days}): **${money(spending, wallet.currency)}**`] : []),
      ...(adjustment ? [`• ${labels.other}: ${adjustment > 0 ? "+" : ""}${money(adjustment, wallet.currency)}`] : []),
      `• ${labels.end}${scenario.horizonEnd ? ` ${scenario.horizonEnd}` : ""}: ${money(wallet.balanceNow, wallet.currency)} − ${money(spending, wallet.currency)}${adjustment ? ` ${adjustment > 0 ? "+" : "−"} ${money(Math.abs(adjustment), wallet.currency)}` : ""} = **${money(wallet.projectedBalance, wallet.currency)}**`,
    ].join("\n");
  }), result.unavailableEstimates.length ? labels.missing : result.estimatedSpending.length ? labels.note : ""].filter(Boolean).join("\n\n");
}
