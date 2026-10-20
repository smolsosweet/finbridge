import { z } from "zod";
import type { AppState, Wallet } from "../components/finbridge/workspace/store";

export const settingsActionProposalSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["theme", "language", "archive_wallet"]),
  theme: z.enum(["light", "dark"]).optional(),
  language: z.enum(["vi", "en", "zh"]).optional(),
  walletId: z.string().max(100).optional(),
  walletName: z.string().max(100).optional(),
  walletCurrency: z.string().max(8).optional(),
  walletBalance: z.number().finite().optional(),
  activeBudgetsCount: z.number().int().nonnegative().optional(),
  activeGoalsCount: z.number().int().nonnegative().optional(),
  activeFixedExpensesCount: z.number().int().nonnegative().optional(),
  isOnlyActiveWallet: z.boolean().optional(),
  status: z.enum(["pending", "saving", "confirmed", "cancelled", "failed"]),
  applied: z.boolean().optional(),
  error: z.string().max(500).optional(),
}).strict();

export type SettingsActionProposal = z.infer<typeof settingsActionProposalSchema>;

export const settingsActionCopy = {
  vi: {
    archiveTitle: "Lưu trữ ví",
    wallet: "Ví",
    balance: "Số dư hiện tại",
    effectNote: "Ví sẽ được ẩn khỏi danh sách lựa chọn khi ghi chép mới. Lịch sử giao dịch và số dư ví vẫn được bảo lưu an toàn.",
    dependencyWarning: (budgets: number, expenses: number, goals: number = 0) =>
      `Lưu ý: Có ${budgets} ngân sách${goals > 0 ? `, ${goals} mục tiêu` : ""} và ${expenses} khoản chi cố định đang hoạt động gắn với ví này.`,
    onlyWalletWarning: "Đây là ví đang hoạt động duy nhất. Nếu lưu trữ, bạn sẽ cần tạo hoặc kích hoạt ví khác để tiếp tục ghi chép.",
    confirmArchive: "Xác nhận lưu trữ ví",
    cancel: "Hủy",
    saving: "Đang xử lý…",
    savedArchive: "Đã lưu trữ ví thành công. Lịch sử giao dịch vẫn được giữ nguyên.",
    cancelled: "Đã hủy thao tác lưu trữ ví.",
    failed: "Chưa lưu trữ được ví. Vui lòng thử lại.",
    notFound: (name: string) => `Không tìm thấy ví “${name}” trong danh sách ví của bạn.`,
    alreadyArchived: (name: string) => `Ví “${name}” đã ở trạng thái lưu trữ trước đó.`,
    disambiguation: "Tìm thấy nhiều ví phù hợp. Bạn muốn lưu trữ ví nào?",
    themeDark: "Đã bật chế độ tối. Giao diện đã được chuyển sang nền tối.",
    themeLight: "Đã chuyển về giao diện sáng.",
    langEn: "Language switched to English. (Lưu ý: Một số nội dung tùy biến của bạn sẽ giữ nguyên ngôn ngữ gốc).",
    langZh: "语言已切换为中文。（注：部分用户自定义内容将保留原始语言）。",
    langVi: "Đã chuyển ngôn ngữ hiển thị sang Tiếng Việt.",
  },
  en: {
    archiveTitle: "Archive Wallet",
    wallet: "Wallet",
    balance: "Current balance",
    effectNote: "This wallet will be hidden from choices for new transactions. Recorded transaction history and balance remain intact.",
    dependencyWarning: (budgets: number, expenses: number, goals: number = 0) =>
      `Notice: ${budgets} budget(s)${goals > 0 ? `, ${goals} goal(s)` : ""} and ${expenses} recurring bill(s) are actively linked to this wallet.`,
    onlyWalletWarning: "This is the only active wallet. If archived, you must create or unarchive a wallet to record new transactions.",
    confirmArchive: "Confirm Archive",
    cancel: "Cancel",
    saving: "Processing…",
    savedArchive: "Wallet archived successfully. Transaction history is preserved.",
    cancelled: "Wallet archiving cancelled.",
    failed: "Failed to archive wallet. Please try again.",
    notFound: (name: string) => `Wallet “${name}” was not found in your workspace.`,
    alreadyArchived: (name: string) => `Wallet “${name}” is already archived.`,
    disambiguation: "Multiple wallets matched. Which wallet do you want to archive?",
    themeDark: "Dark mode enabled. The interface has switched to dark theme.",
    themeLight: "Switched to light theme.",
    langEn: "Language switched to English. (Note: User-customized text retains its original language).",
    langZh: "语言已切换为中文。（注：部分用户自定义内容将保留原始语言）。",
    langVi: "Display language switched to Vietnamese.",
  },
  zh: {
    archiveTitle: "归档钱包",
    wallet: "钱包",
    balance: "当前余额",
    effectNote: "该钱包将从新交易的选择列表中隐藏。已记录的交易历史和余额保持不变。",
    dependencyWarning: (budgets: number, expenses: number, goals: number = 0) =>
      `注意：有 ${budgets} 个预算${goals > 0 ? `、${goals} 个目标` : ""}和 ${expenses} 笔定期支出正关联至此钱包。`,
    onlyWalletWarning: "这是唯一处于活跃状态的钱包。若归档，你需创建或恢复其他钱包才能记录新交易。",
    confirmArchive: "确认归档钱包",
    cancel: "取消",
    saving: "正在处理…",
    savedArchive: "钱包归档成功。交易历史保持不变。",
    cancelled: "已取消钱包归档。",
    failed: "归档钱包失败，请重试。",
    notFound: (name: string) => `未在工作区找到钱包「${name}」。`,
    alreadyArchived: (name: string) => `钱包「${name}」此前已处于归档状态。`,
    disambiguation: "找到多个匹配的钱包。你想归档哪一个？",
    themeDark: "已开启暗色模式，界面已切换至深色主题。",
    themeLight: "已切换至浅色主题。",
    langEn: "Language switched to English. (Note: User-customized text retains its original language).",
    langZh: "语言已切换为中文。（注：部分用户自定义内容将保留原始语言）。",
    langVi: "显示语言已切换为越南语。",
  },
} as const;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[.!?]+$/g, "").trim();

export function isSettingsThemeMessage(message: string): "dark" | "light" | null {
  const text = normalize(message);
  if (/\b(?:bat|chuyen sang|doi sang|dung|turn on|switch to|enable)\s+(?:che do toi|giao dien toi|man hinh toi|dark mode|dark theme)\b|开启暗色|深色模式|暗黑模式|夜间模式|\bche do toi\b|\bdark mode\b/.test(text)) {
    return "dark";
  }
  if (/\b(?:chuyen ve|ve|bat|chuyen sang|doi sang|tat che do toi|turn on|switch to)\s+(?:giao dien sang|che do sang|man hinh sang|light mode|light theme)\b|开启亮色|浅色模式|日间模式|\bche do sang\b|\blight mode\b|\btat che do toi\b/.test(text)) {
    return "light";
  }
  return null;
}

export function isSettingsLanguageMessage(message: string): "vi" | "en" | "zh" | null {
  const text = normalize(message);
  if (/\b(?:doi|chuyen|switch|change|set)\s*(?:sang|qua|to|ngon ngu|language)?\s*(?:tieng anh|english|en)\b|\bswitch to english\b|切换到英文|切换到英语/.test(text)) {
    return "en";
  }
  if (/\b(?:doi|chuyen|switch|change|set)\s*(?:sang|qua|to|ngon ngu|language)?\s*(?:tieng trung|tieng hoa|chinese|zh|zhongwen)\b|\bswitch to chinese\b|切换到中文|切换到汉语/.test(text)) {
    return "zh";
  }
  if (/\b(?:doi|chuyen|switch|change|set)\s*(?:sang|qua|to|ngon ngu|language)?\s*(?:tieng viet|vietnamese|vi)\b|\bswitch to vietnamese\b|切换到越南语|切换到越文/.test(text)) {
    return "vi";
  }
  return null;
}

export function isSettingsWalletArchiveMessage(message: string, state?: Pick<AppState, "wallets">): boolean {
  const text = normalize(message);
  const archiveKeywords = /\b(?:luu tru|dong vi|an vi|archive|hide)\s+(?:vi\s+)?|\b(?:archive|hide)\s+(?:the\s+)?wallet\b|归档|隐藏钱包/;
  if (!archiveKeywords.test(text)) return false;

  if (/\b(?:vi|wallet)\b|钱包/.test(text)) return true;
  if (state?.wallets?.some(w => normalize(w.name).length >= 3 && text.includes(normalize(w.name)))) {
    return true;
  }
  return false;
}

export function prepareWalletArchive(
  state: AppState,
  message: string,
  id: string
): { proposal?: SettingsActionProposal; clarification?: string; disambiguation?: Wallet[] } {
  const wallets = state.wallets || [];
  if (!wallets.length) {
    return { clarification: "Hiện chưa có ví nào trong hệ thống." };
  }

  const text = normalize(message);
  const cleaned = text.replace(/^(?:luu tru|dong vi|an vi|archive|hide)\s*/u, "").replace(/\b(?:vi\s+)/u, "").trim();

  // Try exact match on name
  const exact = wallets.filter(w => normalize(w.name) === cleaned || (cleaned.length >= 3 && normalize(w.name).includes(cleaned)));
  let targetWallet: Wallet | null = null;

  if (exact.length === 1) {
    targetWallet = exact[0];
  } else if (exact.length > 1) {
    return { clarification: "Tìm thấy nhiều ví phù hợp. Bạn muốn lưu trữ ví nào?", disambiguation: exact };
  } else {
    // Try substring match on any wallet
    const candidates = wallets.filter(w => normalize(w.name).length >= 3 && text.includes(normalize(w.name)));
    if (candidates.length === 1) {
      targetWallet = candidates[0];
    } else if (candidates.length > 1) {
      return { clarification: "Tìm thấy nhiều ví phù hợp. Bạn muốn lưu trữ ví nào?", disambiguation: candidates };
    }
  }

  if (!targetWallet) {
    return { clarification: `Không tìm thấy ví cần lưu trữ. Vui lòng nêu rõ tên ví (ví dụ: “Lưu trữ ví Vietinbank”).`, disambiguation: wallets.filter(w => !w.archived) };
  }

  if (targetWallet.archived) {
    return { clarification: `Ví “${targetWallet.name}” đã ở trạng thái lưu trữ trước đó.` };
  }

  // Calculate dependencies
  const activeWallets = wallets.filter(w => !w.archived);
  const isOnlyActiveWallet = activeWallets.length <= 1;

  const linkedBudgets = state.goals.filter(g => g.kind === "budget" && g.wallet === targetWallet!.id);
  const linkedGoals = state.goals.filter(g => g.kind !== "budget" && g.wallet === targetWallet!.id);
  const linkedFixed = (state.fixedExpenses || []).filter(e => e.active && (e.walletId === targetWallet!.id || linkedBudgets.some(b => b.id === e.budgetId)));

  // Calculate wallet current balance
  const txs = state.transactions.filter(t => t.wallet === targetWallet!.id || t.targetWallet === targetWallet!.id);
  const balance = targetWallet.initial + txs.reduce((sum, t) => {
    if (t.type === "income") return sum + t.amount;
    if (t.type === "expense") return sum - t.amount;
    if (t.type === "transfer") {
      if (t.wallet === targetWallet!.id) return sum - t.amount;
      if (t.targetWallet === targetWallet!.id) return sum + t.amount;
    }
    return sum;
  }, 0);

  return {
    proposal: {
      id,
      action: "archive_wallet",
      walletId: targetWallet.id,
      walletName: targetWallet.name === "." ? "Ví chính" : targetWallet.name,
      walletCurrency: targetWallet.currency,
      walletBalance: balance,
      activeBudgetsCount: linkedBudgets.length,
      activeGoalsCount: linkedGoals.length,
      activeFixedExpensesCount: linkedFixed.length,
      isOnlyActiveWallet,
      status: "pending",
    },
  };
}

export function applyWalletArchive(state: AppState, raw: SettingsActionProposal): AppState {
  const proposal = settingsActionProposalSchema.parse(raw);
  if (proposal.applied || (proposal.status !== "pending" && proposal.status !== "failed") || proposal.action !== "archive_wallet") {
    throw new Error("CONFIRMATION_REQUIRED");
  }
  const targetId = proposal.walletId;
  if (!targetId || !state.wallets.some(w => w.id === targetId)) {
    throw new Error("WALLET_NOT_FOUND");
  }
  return {
    ...state,
    wallets: state.wallets.map(w => w.id === targetId ? { ...w, archived: true } : w),
  };
}
