import type { FinancialScenario, ScenarioResult } from "./scenario-planner";
import { conversationalLead, type AnswerPresentation } from "./assistant-response";
import { formatScenarioDate, formatScenarioMoney } from "./scenario-format";

/** Conversational wording surrounds verified clauses; the model supplies no totals. */
export function scenarioAnswer(result: ScenarioResult, scenario: FinancialScenario, wallets: Array<{ id: string; name: string }>, asOf: string, language: "vi" | "en" | "zh", baseline?: ScenarioResult, presentation?: AnswerPresentation) {
  const t = {
    vi: { missing: "Finn chưa đủ dữ liệu để nói bạn có đủ tiền đến cuối tháng không. Các số bên dưới mới gồm những khoản tính được.", current: "Tiền hiện có", bills: "Các khoản còn phải trả", flexible: "Chi sinh hoạt dự kiến thêm", purchase: "Khoản bạn định chi", income: "Khoản thu giả định", daily: "Chi theo mức mỗi ngày bạn chọn", reduced: "Chi ở danh mục bạn điều chỉnh", baseline: "Nếu giữ nguyên kế hoạch", period: "Tính từ", help: "Bạn có thể ghi nhận thêm chi tiêu hoặc cho Finn biết mức chi dự kiến mỗi ngày để tính tiếp.", exact: "Con số này mới tính các khoản bạn nêu và hóa đơn đã biết, chưa gồm chi sinh hoạt khác.", note: "Ước tính nếu tiếp tục mức chi đã ghi nhận, chưa cộng thu nhập mới ngoài kịch bản. Khoản phát sinh có thể làm kết quả thay đổi.", day: "ngày tới, từ ngày mai", count: "khoản, gồm cả khoản quá hạn nếu có", budget: "Ngân sách", over: "có thể vượt khoảng", limitNote: "Đây là hạn mức chi tiêu, khác với số dư trong ví.", unnamedBudget: "đang theo dõi" },
    en: { missing: "Finn needs more data to tell whether your money will last. The figures below include only calculable items.", current: "Money available now", bills: "Bills still to pay", flexible: "Further estimated living expenses", purchase: "Your proposed expense", income: "Hypothetical income", daily: "Spending at your chosen daily limit", reduced: "Spending in adjusted categories", baseline: "If you keep the original plan", period: "Calculated from", help: "Record more spending or tell Finn your expected daily spending to complete the forecast.", exact: "This includes the changes you specified and known bills, but not other living expenses.", note: "Assumes recorded spending continues, with no new income outside the scenario. Unexpected costs can change the outcome.", day: "days ahead, starting tomorrow", count: "bills, including any overdue ones", budget: "Budget", over: "could exceed its limit by about", limitNote: "A spending limit is separate from the money in your wallet.", unnamedBudget: "being tracked" },
    zh: { missing: "Finn 还需要更多数据，才能判断资金是否足够到月底。以下仅包含可计算的项目。", current: "目前的钱", bills: "还需要支付的账单", flexible: "预计后续生活支出", purchase: "你打算支付的费用", income: "假设收入", daily: "按你设置的每日限额支出", reduced: "调整后类别的支出", baseline: "如果保持原计划", period: "计算期间", help: "你可以继续记录支出，或告诉 Finn 预计每日花费，以完成预测。", exact: "这里只计算你提出的变动和已知账单，尚未包括其他生活支出。", note: "假设维持已记录的支出，不增加情景以外的新收入。额外开销会改变结果。", day: "天，从明天开始", count: "笔账单，包括逾期项目", budget: "预算", over: "可能超支约", limitNote: "支出限额与钱包中的余额是两回事。", unnamedBudget: "正在跟踪" },
  }[language];
  const extra = {
    vi: { reserve: "Tiền giữ dự phòng", available: "Còn có thể dùng sau dự phòng", unknownReserve: "Bạn chưa đặt tiền dự phòng; số dư dự kiến trên chưa dành riêng khoản này.", unknownBalance: "Finn chưa xác minh được số dư ví. Bạn kiểm tra số dư ban đầu và các giao dịch trước khi dự báo nhé.", comparison: "So sánh phương án", original: "Giữ nguyên", changed: "Theo giả định", impact: "Chênh lệch", action: "Để tránh thiếu tiền, cần giảm chi hoặc bổ sung nguồn tiền thực tế ít nhất", reserveRisk: "Số dư dự kiến vẫn dương, nhưng chưa giữ đủ tiền dự phòng; còn thiếu", method: "Các khoản được tính" },
    en: { reserve: "Protected reserve", available: "Available after reserve", unknownReserve: "No reserve is set; the projected balance does not earmark one.", unknownBalance: "Finn cannot verify this wallet balance. Check its opening balance and recorded transactions before forecasting.", comparison: "Compare options", original: "Unchanged", changed: "With your assumptions", impact: "Difference", action: "To avoid a shortfall, reduce spending or add actual funds by at least", reserveRisk: "The projected balance is positive, but it does not preserve the full reserve; the gap is", method: "What is included" },
    zh: { reserve: "预留备用金", available: "扣除备用金后可用", unknownReserve: "尚未设置备用金，以上预计余额未专门预留此款项。", unknownBalance: "Finn 无法核实此钱包余额，请先检查初始余额及已记录交易。", comparison: "方案比较", original: "保持原计划", changed: "按你的假设", impact: "差额", action: "为避免资金不足，需要减少支出或补充实际资金至少", reserveRisk: "预计余额为正，但无法完整保留备用金，仍差", method: "计算包含的项目" },
  }[language];
  const complete = !result.unavailableEstimates.length && result.wallets.length > 0 && result.wallets.every(w => w.balanceComplete !== false);
  const end = formatScenarioDate(scenario.horizonEnd || asOf, language);
  const blocks: string[] = [];
  if (!complete) blocks.push(t.missing);
  for (const wallet of result.wallets) {
    const money = (n: number) => formatScenarioMoney(n, wallet.currency, language);
    const name = wallets.find(w => w.id === wallet.walletId)?.name || wallet.walletId;
    if (wallet.balanceComplete === false) { blocks.push(`**${name} · ${wallet.currency}**\n${extra.unknownBalance}`); continue; }
    const bills = result.plannedBills.filter(b => b.walletId === wallet.walletId);
    const scale = 10 ** (new Intl.NumberFormat("en", { style: "currency", currency: wallet.currency }).resolvedOptions().maximumFractionDigits ?? 2);
    const billTotal = wallet.components?.unpaidBills ?? bills.reduce((sum, b) => sum + Math.round(b.amount * scale), 0) / scale;
    const pace = result.estimatedSpending.find(e => e.walletId === wallet.walletId);
    const base = baseline?.wallets.find(w => w.walletId === wallet.walletId);
    const closing = money(Math.abs(wallet.projectedBalance));
    const conclusion = language === "vi"
      ? !complete ? `Sau những khoản tính được, ví **${name}** còn **${money(wallet.projectedBalance)}**; chưa phải dự báo đầy đủ.` : wallet.projectedBalance < 0 ? `Đến **${end}**, ví **${name}** có thể thiếu khoảng **${closing}**.` : wallet.projectedBalance === 0 ? `Đến **${end}**, ví **${name}** dự kiến vừa hết tiền, chưa có khoản đệm cho chi phí phát sinh.` : `Đến **${end}**, bạn dự kiến còn khoảng **${closing}** trong ví **${name}**.`
      : language === "en"
        ? !complete ? `After calculable items, **${name}** has **${money(wallet.projectedBalance)}** left; this is not a complete forecast.` : wallet.projectedBalance < 0 ? `By **${end}**, **${name}** could be short by about **${closing}**.` : wallet.projectedBalance === 0 ? `By **${end}**, **${name}** is projected to run out, without a buffer for unexpected costs.` : `By **${end}**, you are projected to have about **${closing}** left in **${name}**.`
        : !complete ? `扣除可计算项目后，**${name}** 剩余 **${money(wallet.projectedBalance)}**，这还不是完整预测。` : wallet.projectedBalance < 0 ? `到 **${end}**，**${name}** 可能短缺约 **${closing}**。` : wallet.projectedBalance === 0 ? `到 **${end}**，**${name}** 预计刚好用完，没有应对额外开销的缓冲。` : `到 **${end}**，你在 **${name}** 中预计还剩约 **${closing}**。`;
    blocks.push(complete && result.wallets.length === 1 ? conversationalLead(presentation?.lead, conclusion) : conclusion);
    const details = [`• ${t.current}: **${money(wallet.balanceNow)}**.`, ...(billTotal ? [`• ${t.bills}: **${money(billTotal)}**${bills.length ? ` (${bills.length} ${t.count})` : ""}.`] : []), ...(pace ? [`• ${t.flexible}: **${money(pace.amount)}** (${pace.days} ${t.day}).`] : [])];
    if (presentation?.detail === "detailed") for (const bill of bills) details.push(`  ${bill.title} (${formatScenarioDate(bill.date, language)}): ${money(bill.amount)}.`);
    for (const change of scenario.changes.filter(c => c.walletId === wallet.walletId && c.amount !== null)) details.push(`• ${change.direction === "expense" ? t.purchase : t.income} · ${change.title}: **${money(change.amount!)}**.`);
    if (wallet.components?.dailyLimitSpending) details.push(`• ${t.daily}: **${money(wallet.components.dailyLimitSpending)}**.`);
    if (wallet.components?.reducedCategorySpending) details.push(`• ${t.reduced}: **${money(wallet.components.reducedCategorySpending)}**.`);
    if (wallet.protectedReserve != null && wallet.availableAfterReserve != null) details.push(`• ${extra.reserve}: **${money(wallet.protectedReserve)}**.`, `• ${extra.available}: **${money(wallet.availableAfterReserve)}**.`);
    // Even a brief affordability answer must identify the purchase separately.
    blocks.push(`${presentation?.detail === "detailed" ? `**${extra.method}**\n` : ""}${details.join("\n")}`);
    if (base && base.balanceComplete !== false && !baseline!.unavailableEstimates.length && base.projectedBalance !== wallet.projectedBalance) blocks.push(presentation?.layout === "comparison"
      ? `**${extra.comparison}**\n\n| ${extra.original} | ${extra.changed} | ${extra.impact} |\n| ---: | ---: | ---: |\n| ${money(base.projectedBalance)} | ${money(wallet.projectedBalance)} | ${money(Math.round((wallet.projectedBalance - base.projectedBalance) * scale) / scale)} |`
      : `${t.baseline}: **${money(base.projectedBalance)}**.`);
    if (complete && wallet.projectedBalance > 0 && wallet.availableAfterReserve != null && wallet.availableAfterReserve < 0) blocks.push(`${extra.reserveRisk} **${money(-wallet.availableAfterReserve)}**.`);
    if (complete && wallet.projectedBalance < 0) blocks.push(`${extra.action} **${money(-wallet.projectedBalance)}**.`);
    if (wallet.protectedReserve == null && scenario.estimateSpending) blocks.push(extra.unknownReserve);
  }
  for (const budget of result.budgets.filter(b => b.projectedRemaining < 0)) blocks.push(`${t.budget} **${budget.title || t.unnamedBudget}** ${t.over} **${formatScenarioMoney(-budget.projectedRemaining, budget.currency, language)}**. ${t.limitNote}`);
  blocks.push(`${t.period} **${formatScenarioDate(asOf, language)}** → **${end}**.`, !complete ? result.wallets.some(w => w.balanceComplete === false) ? "" : t.help : result.includesPaceForecast ? t.note : t.exact);
  return blocks.filter(Boolean).join("\n\n");
}
