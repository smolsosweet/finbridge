interface DraftWallet { id: string; currency: string; archived?: boolean; }
interface DraftState {
  wallets: DraftWallet[];
  categories: string[];
  categoryMeta: Record<string, { type: string; icon?: string; children?: string[]; archived?: boolean } | undefined>;
  walletCategories?: Record<string, string[]>;
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
  /** A newly requested category stays draft-only until this transaction is confirmed. */
  newCategory?: { name: string; type: DraftType };
  needsReview: string[];
}

export interface ParsedTransactionAmount { amount: number; currency: string | null; }

/** A wallet choice is actionable only if an active compatible wallet exists. */
export function hasCompatibleDraftWallet(draft: Pick<TransactionDraft, "currency">, wallets: DraftWallet[]): boolean {
  return wallets.some(wallet => !wallet.archived && (!draft.currency || wallet.currency.toUpperCase() === draft.currency.toUpperCase()));
}

/** Parse only amounts with an explicit shorthand or currency marker. */
export function parseTransactionAmounts(message: string): ParsedTransactionAmount[] {
  const pattern = /(?:\$\s*(\d[\d.,]*)|\b(\d[\d.,]*)\s*(k|nghìn|ngàn|nghin|ngan|triệu|trieu|tr|million|m|usd|dollars?|dollar|đô\s*la|đô|cny|rmb|yuan|tệ|te|vnd|đồng|dong|₫|đ|\$))/giu;
  const amounts: ParsedTransactionAmount[] = [];
  for (const match of message.matchAll(pattern)) {
    const raw = match[1] || match[2];
    const unit = (match[3] || (match[1] ? "usd" : "")).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const trailingCurrency = message.slice((match.index || 0) + match[0].length).match(/^\s*(usd|dollars?|dollar|đô\s*la|đô|cny|rmb|yuan|tệ|te|vnd|đồng|dong|₫|đ)(?=\s|$|[.,!?])/iu)?.[1];
    const currencyUnit = (trailingCurrency || unit).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const normalized = raw.includes(".") && raw.includes(",")
      ? raw.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".")
      : /^[\d]{1,3}(?:[.,]\d{3})+$/.test(raw) ? raw.replace(/[.,]/g, "") : raw.replace(",", ".");
    const numeric = Number(normalized);
    const multiplier = /^(k|nghin|ngan)$/.test(unit) ? 1_000 : /^(trieu|tr|million|m)$/.test(unit) ? 1_000_000 : 1;
    const amount = Math.round(numeric * multiplier * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) continue;
    const currency = /^(usd|dollars?|dollar|do\s*la|do|\$)$/.test(currencyUnit) ? "USD"
      : /^(cny|rmb|yuan|te)$/.test(currencyUnit) ? "CNY"
        : /^(k|nghin|ngan|trieu|tr|vnd|dong|₫|đ)$/.test(currencyUnit) ? "VND" : null;
    amounts.push({ amount, currency });
  }
  return amounts;
}

export function reconcileTransactionDraftAmounts<T extends { amount: number | null; needsReview: string[] }>(message: string, drafts: T[]) {
  const parsedAmounts = parseTransactionAmounts(message);
  if (!parsedAmounts.length) return { drafts, parsedAmounts, mismatch: false };
  if (parsedAmounts.length !== drafts.length) {
    return { drafts: drafts.map((draft) => ({ ...draft, amount: null, needsReview: [...new Set([...draft.needsReview, "amount"])] })), parsedAmounts, mismatch: true };
  }
  return {
    drafts: drafts.map((draft, index) => ({ ...draft, amount: parsedAmounts[index].amount, needsReview: draft.needsReview.filter((field) => field !== "amount") })),
    parsedAmounts,
    mismatch: false,
  };
}

/** A correction is applied only when wording clearly refers to an existing draft. */
export function parseDraftAmountCorrection(message: string): ParsedTransactionAmount | null {
  const normalized = normalizeVietnameseMessage(message);
  if (!/\b(nham|sai|y toi|dinh noi|actually|i meant|correction|make that|change it to)\b/.test(normalized)) return null;
  const amounts = parseTransactionAmounts(message);
  return amounts.length === 1 ? amounts[0] : null;
}

/** Draft amounts always include an unambiguous ISO currency code. */
export function formatTransactionMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  const fractionDigits = new Intl.NumberFormat("vi-VN", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  const formatted = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);
  return `${formatted} ${code}`;
}

export function createTimeoutTransactionDraft(message: string, batchId: string, today: string, state: DraftState): TransactionDraft | null {
  if (!isNewTransactionMessage(message) || !validDate(today)) return null;
  const normalized = normalizeVietnameseMessage(message);
  const parsedAmounts = parseTransactionAmounts(message);
  if (parsedAmounts.length !== 1) return null;
  const amount = parsedAmounts[0].amount;

  const type: DraftType | null = /\b(nhan luong|nhan tien|duoc tra|thu nhap|tien thu|ban duoc|received|earned|salary)\b/.test(normalized) ? "income"
    : /\b(chi|mua|an|uong|hoc them|hoc phi|hoc tap|dong|nop|tra|kham|di xe|bat xe|do xang|thanh toan|ve xe|het|paid|spent|bought|tuition)\b/.test(normalized) ? "expense" : null;

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
    wallet: null, currency: parsedAmounts[0].currency,
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

export function resolveDraftCategory(message: string, type: DraftType | null, state: Pick<DraftState, "categories" | "categoryMeta">): { category: string | null; candidates: string[]; confidence: "confident" | "ambiguous" | "unknown"; recognized: boolean } {
  if (!type) return { category: null, candidates: [], confidence: "unknown", recognized: false };
  const text = normalizeVietnameseMessage(message);
  const aliases: Array<{ pattern: RegExp; category: RegExp }> = [
    { pattern: /\b(hoc phi|hoc them|hoc tap|dong hoc|nop hoc|lop hoc|khoa hoc|tuition|education|course|tutoring)\b|学费|补习/, category: /hoc phi|giao duc|education|hoc tap|tuition|学费|教育/ },
    { pattern: /\b(kham benh|benh vien|thuoc|bac si)\b/, category: /suc khoe|y te|medical|health/ },
    { pattern: /\b(xe bus|xe buyt|taxi|grab|xe om|ve xe)\b/, category: /di chuyen|di lai|transport|xe co/ },
    { pattern: /\b(an|uong|com|banh mi|nuoc|bua an|tra sua|ca phe|bread|coffee|food|drink|lunch|dinner|breakfast|water)\b|吃|喝/, category: /thuc an|do uong|an uong|foods?|drinks?|餐饮|饮食/ },
    { pattern: /\b(luong|thu nhap|nhan luong)\b/, category: /luong|thu nhap|income|salary/ },
    { pattern: /\b(mua sam|shop|shopping|quan ao|mua ao|mua giay|clothes|shoes)\b|购物|衣服/, category: /mua sam|shopping|purchase|购物/ },
  ];
  for (const alias of aliases) {
    if (!alias.pattern.test(text)) continue;
    if (alias.category.test("food") && /\bnuoc (?:hoa|rua|giat|lau|tay|xa)\b/.test(text)) continue;
    const matches = state.categories.filter((category) => !state.categoryMeta[category]?.archived && (state.categoryMeta[category]?.type || "expense") === type && alias.category.test(normalizeVietnameseMessage(category)));
    // A complete domain label is stronger evidence than a phrase that merely
    // contains it. Combined labels (Food & Drinks) cover the domain more fully
    // than a single broad alias. Equal evidence still requires user selection.
    const ranked = matches.map((category) => {
      const name = normalizeVietnameseMessage(category);
      const terms = [...name.matchAll(new RegExp(alias.category.source, "g"))];
      const remainder = name.replace(new RegExp(alias.category.source, "g"), "")
        .replace(/\b(and|va)\b/g, "").replace(/[\s&/+·,，、]+/g, "");
      return { category, score: remainder ? 0 : 2 + Math.min(terms.length, 2) };
    });
    const bestScore = Math.max(-1, ...ranked.map((item) => item.score));
    const best = ranked.filter((item) => item.score === bestScore);
    const selected = best.length === 1 ? best[0].category : null;
    // A broader shopping label must never override an unrecognised meal/education category.
    return { category: selected, candidates: matches, confidence: selected ? "confident" : matches.length ? "ambiguous" : "unknown", recognized: true };
  }
  return { category: null, candidates: [], confidence: "unknown", recognized: false };
}

export function inferDraftCategory(message: string, type: DraftType | null, state: DraftState): string | null {
  return resolveDraftCategory(message, type, state).category;
}

export function matchDraftCategoryAnswer(message: string, draft: TransactionDraft, state: DraftState): string | null {
  const answer = normalizeVietnameseMessage(message)
    .replace(/^(?:vui long\s+)?(?:hay\s+)?(?:chon|chọn|use|select|choose)(?:\s+danh muc|\s+category)?\s+/, "")
    .replace(/^(?:danh muc|category)(?:\s+(?:la|is|:))?\s*/, "")
    .replace(/[.!?]+$/, "").trim();
  if (!answer || !draft.type) return null;
  const activeCategories = state.categories.filter((category) => !state.categoryMeta[category]?.archived && (state.categoryMeta[category]?.type || "expense") === draft.type);
  const literalAnswer = message.trim().replace(/^(?:(?:vui lòng\s+)?(?:hãy\s+)?(?:chọn|chon|use|select|choose)(?:\s+danh mục|\s+category)?\s+)?(?:(?:danh mục|category)(?:\s+(?:là|is|:))?\s+)?/i, "").replace(/[.!?]+$/, "").trim();
  const literal = activeCategories.find(category => category.toLocaleLowerCase("vi") === literalAnswer.toLocaleLowerCase("vi"));
  if (literal) return literal;
  const exact = activeCategories.filter((category) => normalizeVietnameseMessage(category) === answer);
  if (exact.length > 1) return null;
  const semantic = resolveDraftCategory(answer, draft.type, state);
  if (semantic.confidence === "ambiguous") return null;
  if (exact.length === 1) return exact[0];
  if (answer === "other") return activeCategories.find((category) => normalizeVietnameseMessage(category) === "khac") || null;
  return inferDraftCategory(answer, draft.type, state);
}

export function requestedDraftCategory(message: string): string | null {
  const requested = message.trim().match(/^(?:(?:(?:tạo|thêm|tao|them)\s+(?:danh mục|category)(?:\s+(?:mới|new))?)|(?:(?:create|add)\s+(?:a\s+)?(?:new\s+)?category)|(?:danh mục|category)(?:\s+(?:là|mới|:|is))?)\s+(.+?)[.!?]*$/i)?.[1]?.trim();
  return requested && isValidDraftCategoryName(requested) ? requested : null;
}

export function isValidDraftCategoryName(value: string): boolean {
  const name = value.trim();
  return name.length > 0 && name.length <= 100 && !["__proto__", "constructor", "prototype"].includes(name.toLocaleLowerCase("en"))
    && /^[\p{L}\p{N}][\p{L}\p{N}\s&'’().-]*$/u.test(name);
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    let diagonal = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const previous = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return row[right.length];
}

export function similarDraftCategories(candidate: string, categories: string[]): string[] {
  const normalized = normalizeVietnameseMessage(candidate).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  if (!normalized) return [];
  return categories.map((name) => ({ name, normalized: normalizeVietnameseMessage(name).replace(/[^\p{L}\p{N}]+/gu, " ").trim() }))
    .filter((item) => item.normalized && (item.normalized.includes(normalized) || normalized.includes(item.normalized)
      || Math.min(...normalized.split(/\s+/).map((token) => editDistance(token, item.normalized))) <= 2))
    .map((item) => item.name);
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
    next.needsReview.push("wallet");
  } else if (next.currency && wallet.currency.toUpperCase() !== next.currency.toUpperCase()) {
    // Keep the stated currency so the UI can request a compatible wallet;
    // never silently rewrite the user's amount currency during validation.
    next.wallet = null;
    next.needsReview.push("wallet");
  } else {
    next.currency = wallet.currency;
  }
  if (next.amount === null || !Number.isFinite(next.amount) || next.amount <= 0 || next.amount > 1_000_000_000_000) {
    next.amount = null;
    next.needsReview.push("amount");
  }
  if (next.amount !== null && next.currency) {
    try {
      const digits = new Intl.NumberFormat("en", { style: "currency", currency: next.currency }).resolvedOptions().maximumFractionDigits ?? 2;
      const units = next.amount * 10 ** digits;
      if (!Number.isSafeInteger(Math.round(units)) || Math.abs(units - Math.round(units)) > 1e-5) { next.amount = null; next.needsReview.push("amount"); }
    } catch { next.needsReview.push("wallet"); }
  }
  if (!next.type || !["expense", "income"].includes(next.type)) {
    next.type = null;
    next.needsReview.push("type");
  }
  const pendingCategoryName = next.newCategory?.name.trim();
  const pendingCategoryValid = !!pendingCategoryName && !!next.type && next.newCategory?.type === next.type
    && isValidDraftCategoryName(pendingCategoryName)
    && !state.categories.some((name) => normalizeVietnameseMessage(name) === normalizeVietnameseMessage(pendingCategoryName));
  if (!next.category || next.category.trim().toLocaleLowerCase("vi") === "chưa được phân loại" || !state.categories.includes(next.category) || state.categoryMeta[next.category]?.archived || !next.type || (state.categoryMeta[next.category]?.type || "expense") !== next.type) {
    next.category = null;
    if (!pendingCategoryValid) next.needsReview.push("category");
  } else {
    next.newCategory = undefined;
  }
  if (!validDate(next.date)) {
    next.date = null;
    next.needsReview.push("date");
  }
  return { ...next, needsReview: [...new Set(next.needsReview)] };
}

export function editDraftById(drafts: TransactionDraft[], id: string, patch: Partial<Omit<TransactionDraft, "id" | "needsReview">>, state: DraftState): TransactionDraft[] {
  return drafts.map((draft) => draft.id === id
    ? validateDraftForState({ ...draft, ...patch, ...(Object.hasOwn(patch, "category") ? { newCategory: undefined } : {}) }, state)
    : draft);
}

export function applyDraftAmountCorrection(drafts: TransactionDraft[], id: string, message: string, state: DraftState): { drafts: TransactionDraft[]; draft: TransactionDraft } | null {
  const amount = parseDraftAmountCorrection(message);
  if (!amount || !drafts.some((draft) => draft.id === id)) return null;
  const original = drafts.find((draft) => draft.id === id)!;
  const updatedDrafts = editDraftById(drafts, id, { amount: amount.amount, currency: amount.currency || original.currency }, state);
  const draft = updatedDrafts.find((item) => item.id === id);
  return draft ? { drafts: updatedDrafts, draft } : null;
}

export function removeDraftById(drafts: TransactionDraft[], id: string): TransactionDraft[] {
  return drafts.filter((draft) => draft.id !== id);
}

/** Recover actionable controls from the draft, including older conversation snapshots. */
export function categoryResolutionDraftIds(
  messages: Array<{ draftIds?: string[]; categoryChoiceDraftIds?: string[] }>,
  messageIndex: number,
  drafts: TransactionDraft[],
): string[] {
  const message = messages[messageIndex];
  if (!message) return [];
  const ids = [...new Set([...(message.categoryChoiceDraftIds || []), ...(message.draftIds || [])])];
  return ids.filter((id) => {
    const draft = drafts.find((item) => item.id === id);
    // Old conversation prompts must not reopen a category already resolved on
    // the live draft, including a new category staged until confirmation.
    if (!draft || (draft.type && !draft.needsReview.includes("category") && (draft.category || draft.newCategory))) return false;
    return !messages.slice(messageIndex + 1).some((later) => later.draftIds?.includes(id) || later.categoryChoiceDraftIds?.includes(id));
  });
}

export function readyDrafts(drafts: TransactionDraft[], state: DraftState): TransactionDraft[] {
  return drafts.map((draft) => validateDraftForState(draft, state)).filter((draft) =>
    Boolean(draft.title.trim()) && draft.amount !== null && draft.type !== null && (draft.category !== null || !!draft.newCategory?.name.trim()) && draft.date !== null && draft.wallet !== null,
  );
}

export function validateAndCommitDrafts<T extends DraftState>(state: T, drafts: TransactionDraft[]): { state: T; committed: string[] } {
  const known = new Set(state.transactions.map((transaction) => transaction.id));
  const committed: string[] = [];
  const transactions: Array<{ id: string; title: string; amount: number; type: DraftType; category: string; date: string; wallet: string; note: string }> = [];
  const categories = [...state.categories];
  const categoryMeta = { ...state.categoryMeta };
  const walletCategories = state.walletCategories ? Object.fromEntries(Object.entries(state.walletCategories).map(([id, names]) => [id, [...names]])) : undefined;
  const pendingNames = new Map<string, { name: string; type: DraftType }>();
  for (const raw of drafts) {
    if (known.has(raw.id) || !raw.title.trim() || raw.amount === null || !Number.isFinite(raw.amount) || raw.amount <= 0 || !raw.type || !validDate(raw.date)) continue;
    const rawWallet = state.wallets.find((item) => item.id === raw.wallet && !item.archived);
    if (!rawWallet || !raw.currency || rawWallet.currency.toUpperCase() !== raw.currency.toUpperCase()) continue;
    let draft = validateDraftForState(raw, { ...state, categories, categoryMeta });
    if (draft.amount === null || !draft.type || !draft.date || !draft.wallet) continue;
    if (draft.newCategory && draft.type === draft.newCategory.type) {
      const requestedName = draft.newCategory.name.trim();
      if (!isValidDraftCategoryName(requestedName)) continue;
      const normalizedName = normalizeVietnameseMessage(requestedName);
      const existing = categories.find((name) => normalizeVietnameseMessage(name) === normalizedName);
      if (existing) {
        if ((categoryMeta[existing]?.type || "expense") !== draft.type) continue;
        draft = { ...draft, category: existing, newCategory: undefined };
      } else {
        const pending = pendingNames.get(normalizedName);
        if (pending && pending.type !== draft.type) continue;
        const name = pending?.name || requestedName;
        if (!pending) {
          if (categories.length >= 500) continue;
          pendingNames.set(normalizedName, { name, type: draft.type });
          categories.push(name);
          categoryMeta[name] = { type: draft.type, icon: "❓", children: [] };
        }
        if (walletCategories && draft.wallet) {
          walletCategories[draft.wallet] = [...new Set([...(walletCategories[draft.wallet] || categories.filter((item) => item !== name)), name])];
        }
        draft = { ...draft, category: name, newCategory: undefined };
      }
      draft = validateDraftForState(draft, { ...state, categories, categoryMeta });
    }
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
  const categoriesChanged = categories.length !== state.categories.length;
  const nextState = transactions.length || categoriesChanged
    ? { ...state, ...(categoriesChanged ? { categories, categoryMeta, ...(walletCategories ? { walletCategories } : {}) } : {}), transactions: [...state.transactions, ...transactions] }
    : state;
  return { state: nextState, committed };
}
