interface DraftWallet { id: string; currency: string; archived?: boolean; }
interface DraftState {
  wallets: DraftWallet[];
  categories: string[];
  categoryMeta: Record<string, { type: string; archived?: boolean } | undefined>;
  transactions: Array<{ id: string }>;
}

export type DraftType = "expense" | "income";
export interface TransactionDraft {
  id: string;
  title: string;
  amount: number | null;
  type: DraftType | null;
  category: string | null;
  date: string | null;
  wallet: string | null;
  currency: string | null;
  needsReview: string[];
}

export function createTimeoutTransactionDraft(message: string, batchId: string, today: string, state: DraftState): TransactionDraft | null {
  if (!isNewTransactionMessage(message) || !validDate(today)) return null;
  const normalized = normalizeVietnameseMessage(message);
  const amountMatch = normalized.match(/(?:^|\s)(\d[\d.,]*)(?:\s*)(k|nghin|ngan|trieu|tr|dong|vnd|₫|đ)(?=\s|$|[.,!?])/);
  if (!amountMatch) return null;
  const rawAmount = amountMatch[1].replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const numericAmount = Number(rawAmount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return null;
  const multiplier = /^(?:k|nghin|ngan)$/.test(amountMatch[2]) ? 1_000 : /^(?:trieu|tr)$/.test(amountMatch[2]) ? 1_000_000 : 1;
  const amount = Math.round(numericAmount * multiplier);
  if (amount > 1_000_000_000_000) return null;

  const type: DraftType | null = /\b(nhan luong|nhan tien|duoc tra|thu nhap|tien thu|ban duoc)\b/.test(normalized) ? "income"
    : /\b(chi|mua|an|uong|dong|nop|tra|kham|di xe|bat xe|do xang|thanh toan|ve xe|het)\b/.test(normalized) ? "expense" : null;

  let date: string | null = today;
  if (/\b(hom qua|yesterday)\b/.test(normalized)) {
    const previous = new Date(`${today}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    date = previous.toISOString().slice(0, 10);
  }
  const explicitDate = normalized.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/) || normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (explicitDate) {
    const [, first, second, third] = explicitDate;
    const isoFormat = first.length === 4;
    const candidate = isoFormat ? `${first}-${second.padStart(2, "0")}-${third.padStart(2, "0")}` : `${third}-${second.padStart(2, "0")}-${first.padStart(2, "0")}`;
    date = validDate(candidate) ? candidate : null;
  }
  const category = inferDraftCategory(message, type, state);
  const title = message.trim()
    .replace(/\b\d[\d.,]*\s*(?:k|nghìn|ngàn|triệu|tr|đồng|vnd|₫|đ)\b/gi, " ")
    .replace(/\b(?:hôm nay|hôm qua|yesterday|today|hết)\b/gi, " ")
    .replace(/\s+/g, " ").trim();
  const draft: TransactionDraft = {
    id: `${batchId}:fallback`, title: title || message.trim(), amount, type, category, date,
    wallet: null, currency: null,
    needsReview: ["wallet", ...(!type ? ["type"] : []), ...(!category ? ["category"] : []), ...(!date ? ["date"] : [])],
  };
  return draft;
}

export function normalizeVietnameseMessage(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d").trim();
}

export function isNewTransactionMessage(message: string): boolean {
  const value = normalizeVietnameseMessage(message);
  if (/^(danh muc|loai giao dich|ngay|so tien|vi|tien te)\b/.test(value)) return false;
  return /\b(an|uong|mua|dong|nop|nhan|tra|di xe|bat xe|do xang|gui|thanh toan|chuyen khoan|kham benh|ve xe)\b/.test(value) || /\d[\d.,]*\s*(k|nghin|ngan|trieu|dong|vnd|₫|đ)\b/.test(value);
}

export function inferDraftCategory(message: string, type: DraftType | null, state: DraftState): string | null {
  if (!type) return null;
  const text = normalizeVietnameseMessage(message);
  const aliases: Array<{ pattern: RegExp; category: RegExp }> = [
    { pattern: /\b(hoc phi|hoc tap|dong hoc|nop hoc)\b/, category: /hoc phi|giao duc|education|hoc tap/ },
    { pattern: /\b(an|uong|com|bua an|tra sua|ca phe)\b/, category: /thuc an|do uong|an uong|food|drink/ },
    { pattern: /\b(kham benh|benh vien|thuoc|bac si)\b/, category: /suc khoe|y te|medical|health/ },
    { pattern: /\b(xe bus|xe buyt|taxi|grab|xe om|ve xe)\b/, category: /di chuyen|di lai|transport|xe co/ },
    { pattern: /\b(luong|thu nhap|nhan luong)\b/, category: /luong|thu nhap|income|salary/ },
    { pattern: /\b(mua sam|mua|shop|shopping|quan ao)\b/, category: /mua sam|shopping|purchase/ },
  ];
  for (const alias of aliases) {
    if (!alias.pattern.test(text)) continue;
    const match = state.categories.find((category) => !state.categoryMeta[category]?.archived && (state.categoryMeta[category]?.type || "expense") === type && alias.category.test(normalizeVietnameseMessage(category)));
    if (match) return match;
  }
  return null;
}

export function matchDraftCategoryAnswer(message: string, draft: TransactionDraft, state: DraftState): string | null {
  const answer = normalizeVietnameseMessage(message).replace(/^danh muc(?: la|:)?\s*/, "").replace(/[.!?]+$/, "").trim();
  if (!answer || !draft.type) return null;
  return state.categories.find((category) => !state.categoryMeta[category]?.archived && (state.categoryMeta[category]?.type || "expense") === draft.type && normalizeVietnameseMessage(category) === answer) || null;
}

export function requestedDraftCategory(message: string): string | null {
  return message.trim().match(/^(?:danh mục|category)(?:\s+(?:là|mới|:))?\s+(.+?)[.!?]*$/i)?.[1]?.trim() || null;
}

const validDate = (value: string | null): boolean => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export function validateDraftForState(draft: TransactionDraft, state: DraftState): TransactionDraft {
  const next = { ...draft, needsReview: [] as string[] };
  const wallet = state.wallets.find((item) => item.id === next.wallet && !item.archived);
  if (!wallet) {
    next.wallet = null;
    next.currency = null;
    next.needsReview.push("wallet");
  } else {
    next.currency = wallet.currency;
  }
  if (next.amount === null || !Number.isFinite(next.amount) || next.amount <= 0 || next.amount > 1_000_000_000_000) {
    next.amount = null;
    next.needsReview.push("amount");
  }
  if (!next.type || !["expense", "income"].includes(next.type)) {
    next.type = null;
    next.needsReview.push("type");
  }
  if (!next.category || next.category.trim().toLocaleLowerCase("vi") === "chưa được phân loại" || !state.categories.includes(next.category) || state.categoryMeta[next.category]?.archived || !next.type || (state.categoryMeta[next.category]?.type || "expense") !== next.type) {
    next.category = null;
    next.needsReview.push("category");
  }
  if (!validDate(next.date)) {
    next.date = null;
    next.needsReview.push("date");
  }
  return { ...next, needsReview: [...new Set(next.needsReview)] };
}

export function editDraftById(drafts: TransactionDraft[], id: string, patch: Partial<Omit<TransactionDraft, "id" | "needsReview">>, state: DraftState): TransactionDraft[] {
  return drafts.map((draft) => draft.id === id ? validateDraftForState({ ...draft, ...patch }, state) : draft);
}

export function removeDraftById(drafts: TransactionDraft[], id: string): TransactionDraft[] {
  return drafts.filter((draft) => draft.id !== id);
}

export function readyDrafts(drafts: TransactionDraft[], state: DraftState): TransactionDraft[] {
  return drafts.map((draft) => validateDraftForState(draft, state)).filter((draft) =>
    Boolean(draft.title.trim()) && draft.amount !== null && draft.type !== null && draft.category !== null && draft.date !== null && draft.wallet !== null,
  );
}

export function validateAndCommitDrafts<T extends DraftState>(state: T, drafts: TransactionDraft[]): { state: T; committed: string[] } {
  const known = new Set(state.transactions.map((transaction) => transaction.id));
  const committed: string[] = [];
  const transactions: Array<{ id: string; title: string; amount: number; type: DraftType; category: string; date: string; wallet: string; note: string }> = [];
  for (const raw of drafts) {
    const draft = validateDraftForState(raw, state);
    if (known.has(draft.id) || !draft.title.trim() || draft.amount === null || !draft.type || !draft.category || !draft.date || !draft.wallet) continue;
    const wallet = state.wallets.find((item) => item.id === draft.wallet && !item.archived);
    if (!wallet || wallet.currency !== draft.currency) continue;
    known.add(draft.id);
    committed.push(draft.id);
    transactions.push({
      id: draft.id,
      title: draft.title.trim(),
      amount: draft.amount,
      type: draft.type,
      category: draft.category,
      date: draft.date,
      wallet: wallet.id,
      note: "",
    });
  }
  return { state: transactions.length ? { ...state, transactions: [...state.transactions, ...transactions] } : state, committed };
}
