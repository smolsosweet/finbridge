import type { FinancialScenario, ScenarioResult } from "./scenario-planner";

/** Presentation scope: an unforecastable category budget is not a missing wallet pace. */
export function scenarioWalletMissing(result: ScenarioResult, scenario: FinancialScenario, asOf: string, walletId: string) {
  const wallet = result.wallets.find(w => w.walletId === walletId);
  const missing: Array<{ kind: "balance" | "pace" | "reduction"; category?: string }> = [];
  if (!wallet || wallet.balanceComplete === false) missing.push({ kind: "balance" });
  const future = !!scenario.horizonEnd && scenario.horizonEnd > asOf;
  const tomorrow = new Date(`${asOf}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const hasDailyLimit = scenario.dailySpendingLimits?.some(l => l.walletId === walletId && l.currency === wallet?.currency && l.amount != null && Number.isFinite(l.amount) && l.amount >= 0 && !!l.startDate && !!l.endDate && l.startDate <= tomorrow.toISOString().slice(0, 10) && l.endDate >= scenario.horizonEnd!);
  if (scenario.estimateSpending && future && !hasDailyLimit && !result.estimatedSpending.some(e => e.walletId === walletId)) missing.push({ kind: "pace" });
  for (const reduction of scenario.spendingReductions || []) if (reduction.walletId === walletId && !result.savings.some(s => s.walletId === walletId && s.category === reduction.category && s.startDate === reduction.startDate && s.endDate === reduction.endDate && s.percent === reduction.percent)) missing.push({ kind: "reduction", category: reduction.category || undefined });
  return missing;
}

export function scenarioMissingCopy(missing: ReturnType<typeof scenarioWalletMissing>, language: "vi" | "en" | "zh") {
  return missing.map(issue => issue.kind === "balance" ? {
    vi: "Chưa xác minh được số dư: hãy kiểm tra số dư ban đầu và giao dịch của ví.", en: "The wallet balance cannot be verified; check its opening balance and recorded transactions.", zh: "无法核实钱包余额，请检查初始余额和已记录交易。",
  }[language] : issue.kind === "pace" ? {
    vi: "Chưa ước tính được chi sinh hoạt tiếp theo: lịch sử chi tiêu của ví chưa đủ để xác định nhịp chi. Bạn có thể nhập mức chi dự kiến mỗi ngày hoặc bổ sung giao dịch còn thiếu.",
    en: "Further living costs are not estimated: this wallet has insufficient usable spending history to establish a pace. You can provide an expected daily amount or add missing transactions.",
    zh: "尚无法估算后续生活支出：此钱包的可用支出记录不足以确定消费速度。你可以提供预计每日花费，或补充遗漏的交易。",
  }[language] : {
    vi: `Chưa tính được mức giảm ở danh mục “${issue.category}”: cần chi tiêu trong ít nhất 2/3 tháng hoàn tất gần nhất; mức giảm chưa được tính vào kết quả.`,
    en: `The reduction for “${issue.category}” needs spending in at least 2 of the last 3 complete months; it is not included in the result.`,
    zh: `类别“${issue.category}”的减支估算需要最近3个完整月份中至少2个月的记录；结果尚未计入该调整。`,
  }[language]);
}
