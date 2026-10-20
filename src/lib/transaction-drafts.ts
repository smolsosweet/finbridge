import { draftFundingIssues } from "./transaction-funding";
import type { Transaction } from "../components/finbridge/workspace/store";
interface DraftWallet { id: string; currency: string; archived?: boolean; initial?: number; type?: string; limit?: number; }
interface DraftState {
  wallets: DraftWallet[];
  categories: string[];
  categoryMeta: Record<string, { type: string; icon?: string; children?: string[]; archived?: boolean } | undefined>;
  walletCategories?: Record<string, string[]>;
  transactions: Array<{ id: string } & Partial<Transaction>>;
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

type SpokenAmount = ParsedTransactionAmount & { start: number; end: number };
const viSmall: Record<string, number> = { khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
const enSmall: Record<string, number> = { zero: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const spokenCurrency = /^(?:nhân\s+dân\s+tệ|nhan\s+dan\s+te|renminbi|bảng\s+anh|bang\s+anh|mỹ\s+kim|my\s+kim|đô\s+la|do\s+la|đô\s+mỹ|do\s+my|tiền\s+việt|tien\s+viet|dollars?|dollar|đồng|dong|yuan|rmb|vnd|cny|usd|eur|euro|gbp|pounds?|pound|yen|jpy|tệ|te|đô|do|元|人民币|美元|₫|đ|\$|€|£|¥)(?=\s|$|[.,!?])/iu;
function parseChineseNumber(value: string): number | null {
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  const small: Record<string, number> = { 十: 10, 百: 100, 千: 1_000 };
  const large: Record<string, number> = { 万: 10_000, 亿: 100_000_000 };
  let total = 0, section = 0, current = 0, seen = false;
  for (const char of value) {
    if (char in digits) { current = digits[char]; seen = true; continue; }
    if (char in small) { section += (current || (char === "十" ? 1 : 0)) * small[char]; current = 0; seen = true; continue; }
    if (char in large) { section += current; total += (section || 1) * large[char]; section = 0; current = 0; seen = true; continue; }
    return null;
  }
  const result = total + section + current;
  return seen && result > 0 && result <= 1_000_000_000_000 ? result : null;
}
function parseSpokenGroup(words: string[], language: "vi" | "en"): { value: number; scaled: boolean } | null {
  let total = 0, group = 0, current = 0, scaled = false, used = false, lastScale = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (language === "vi" && word === "ruoi") { if (!lastScale) return null; total += lastScale / 2; lastScale = 0; used = true; continue; }
    if (lastScale) lastScale = 0;
    if (language === "vi" && word === "muoi") { current = (current || 1) * 10; used = true; continue; }
    if (language === "vi" && word === "tram") { current = (current || 1) * 100; used = true; continue; }
    const scale = language === "vi" ? ({ nghin: 1_000, ngan: 1_000, trieu: 1_000_000, ty: 1_000_000_000 } as Record<string, number>)[word]
      : ({ hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 } as Record<string, number>)[word];
    if (scale) {
      if (language === "en" && scale === 100) current = (current || 1) * scale;
      else {
        if (!(group + current)) return null;
        total += (group + current) * scale; group = 0; current = 0; lastScale = scale;
      }
      scaled = true; used = true; continue;
    }
    const n = (language === "vi" ? viSmall : enSmall)[word];
    if (n === undefined || (n === 0 && !used)) return null;
    if (language === "en" && n >= 20 && n % 10 === 0) current += n;
    else if (language === "en" && n < 10 && current >= 20 && current % 10 === 0) current += n;
    else if (language === "en" && n < 20 && current === 0) current = n;
    else current += n;
    used = true;
  }
  if (!used) return null;
  return { value: total + group + current, scaled };
}

/** Parse spoken cardinal amounts in a phrase, requiring a scale or currency so
 * ordinary numbers in descriptions are not mistaken for transaction amounts. */
export function parseSpokenTransactionAmounts(message: string): SpokenAmount[] {
  const matches: SpokenAmount[] = [];
  const chinesePattern = /([零〇一二两三四五六七八九十百千万亿]+)\s*(人民币|元|美元|美金|块钱|块|日元)?/gu;
  for (const match of message.matchAll(chinesePattern)) {
    const raw = match[1], currencyWord = match[2] || null;
    const hasScale = /[十百千万亿]/u.test(raw);
    if (!hasScale && !currencyWord) continue;
    const amount = parseChineseNumber(raw);
    if (amount === null) continue;
    const currency = currencyWord ? normalizeCurrency(currencyWord) || (/^块(?:钱)?$/u.test(currencyWord) ? "CNY" : null) : null;
    matches.push({ start: match.index!, end: match.index! + match[0].length, amount, currency });
  }
  const tokenPattern = /[\p{L}]+/gu;
  const normalizeWord = (word: string) => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLocaleLowerCase("vi");
  const tokens = [...message.matchAll(tokenPattern)].map(match => ({ word: normalizeWord(match[0]), start: match.index!, end: match.index! + match[0].length }));
  const allowedVi = new Set([...Object.keys(viSmall), "muoi", "tram", "nghin", "ngan", "trieu", "ty", "ruoi"]);
  const allowedEn = new Set([...Object.keys(enSmall), "hundred", "thousand", "million", "billion", "and"]);
  for (let start = 0; start < tokens.length; start++) {
    for (const language of ["vi", "en"] as const) {
      const allowed = language === "vi" ? allowedVi : allowedEn;
      const words: string[] = [];
      for (let end = start; end < Math.min(tokens.length, start + 15); end++) {
        if (!allowed.has(tokens[end].word)) break;
        if (tokens[end].word !== "and") words.push(tokens[end].word);
        const parsed = parseSpokenGroup(words, language);
        if (!parsed || parsed.value <= 0 || parsed.value > 1_000_000_000_000) continue;
        const currencySuffix = message.slice(tokens[end].end);
        const trimmedSuffix = currencySuffix.trimStart();
        const currencyMatch = trimmedSuffix.match(spokenCurrency);
        const currency = currencyMatch?.[0] || null;
        if (!parsed.scaled && !currency) continue;
        const phraseEnd = currency ? tokens[end].end + currencySuffix.length - trimmedSuffix.length + currency.length : tokens[end].end;
        matches.push({ start: tokens[start].start, end: phraseEnd, amount: parsed.value, currency: currency ? normalizeCurrency(currency) : language === "vi" ? "VND" : null });
      }
    }
  }
  return matches.sort((a, b) => a.start - b.start || b.end - a.end).filter((item, index, list) => !list.slice(0, index).some(previous => item.start < previous.end));
}

/** A wallet choice is actionable only if an active compatible wallet exists. */
export function hasCompatibleDraftWallet(draft: Pick<TransactionDraft, "currency">, wallets: DraftWallet[]): boolean {
  return wallets.some(wallet => !wallet.archived && (!draft.currency || wallet.currency.toUpperCase() === draft.currency.toUpperCase()));
}

export function unavailableWalletReply(currencies: Array<string | null>, language: "vi" | "en" | "zh" = "vi"): string {
  const codes = [...new Set(currencies.filter((value): value is string => !!value).map(value => value.toUpperCase()))].join(", ");
  return {
    vi: codes ? `Chưa có ví ${codes} đang hoạt động. Bạn hãy tạo ví phù hợp rồi gửi lại giao dịch nhé.` : "Chưa có ví đang hoạt động. Bạn hãy tạo ví rồi gửi lại giao dịch nhé.",
    en: codes ? `There is no active ${codes} wallet. Create a matching wallet, then send the transaction again.` : "There is no active wallet. Create a wallet, then send the transaction again.",
    zh: codes ? `暂无可用的 ${codes} 钱包。请先创建对应钱包，再重新发送交易。` : "暂无可用钱包。请先创建钱包，再重新发送交易。",
  }[language];
}

export function normalizeCurrency(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const norm = unit.toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").trim();
  if (/^(cny|rmb|yuan|renminbi|te|nhan dan te|元|人民币)$/.test(norm)) return "CNY";
  if (/^(usd|dollars?|dollar|do la|do|\$|my kim|do my|usdt|美元)$/.test(norm)) return "USD";
  if (/^(eur|euro|€|tien au|ou yuan|欧)$/.test(norm)) return "EUR";
  if (/^(gbp|pound|pounds|£|bang anh|bang|ying bang|镑)$/.test(norm)) return "GBP";
  if (/^(jpy|yen|¥|tien nhat|ri yuan|日元)$/.test(norm)) return "JPY";
  if (/^(vnd|dong|₫|d|tien viet|vnđ)$/.test(norm)) return "VND";
  return null;
}

/** Parse only amounts with an explicit shorthand or currency marker. */
export function parseTransactionAmounts(message: string): ParsedTransactionAmount[] {
  const pattern = /(?:\$\s*(\d[\d.,]*)|\b(\d[\d.,]*)\s*(k|nghìn|ngàn|nghin|ngan|triệu|trieu|tr|million|m|nhân\s+dân\s+tệ|nhan\s+dan\s+te|renminbi|bảng\s+anh|bang\s+anh|đô\s*la|do\s*la|đô\s*mỹ|do\s*my|mỹ\s*kim|my\s*kim|tiền\s*việt|tien\s*viet|usd|dollars?|dollar|đô|do|cny|rmb|yuan|tệ|te|eur|euro|gbp|pound|pounds|bảng|bang|jpy|yen|yên|vnd|đồng|dong|₫|đ|\$|€|£|¥|元|人民币|美元))/giu;
  const amounts: Array<{ start: number; end: number; value: ParsedTransactionAmount }> = [];
  for (const match of message.matchAll(pattern)) {
    const raw = match[1] || match[2];
    const unit = (match[3] || (match[1] ? "usd" : "")).toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    const trailingCurrency = message.slice((match.index || 0) + match[0].length).match(/^\s*(nhân\s+dân\s+tệ|nhan\s+dan\s+te|renminbi|bảng\s+anh|bang\s+anh|đô\s*la|do\s*la|đô\s*mỹ|do\s*my|mỹ\s*kim|my\s*kim|tiền\s*việt|tien\s*viet|usd|dollars?|dollar|đô|do|cny|rmb|yuan|tệ|te|eur|euro|gbp|pound|pounds|bảng|bang|jpy|yen|yên|vnd|đồng|dong|₫|đ|\$|€|£|¥|元|人民币|美元)(?=\s|$|[.,!?])/iu)?.[1];
    const currencyUnit = trailingCurrency || unit;
    const normalized = raw.includes(".") && raw.includes(",")
      ? raw.replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".")
      : /^[\d]{1,3}(?:[.,]\d{3})+$/.test(raw) ? raw.replace(/[.,]/g, "") : raw.replace(",", ".");
    const numeric = Number(normalized);
    const multiplier = /^(k|nghin|ngan)$/.test(unit) ? 1_000 : /^(trieu|tr|million|m)$/.test(unit) ? 1_000_000 : 1;
    const half = /^\s*(?:rưỡi|ruoi)\b/iu.test(message.slice((match.index || 0) + match[0].length)) ? multiplier / 2 : 0;
    const amount = Math.round((numeric * multiplier + half) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) continue;
    const currency = normalizeCurrency(currencyUnit)
      || (/^(k|nghin|ngan|trieu|tr|million|m)$/.test(unit) ? "VND" : null);
    amounts.push({ start: match.index || 0, end: (match.index || 0) + match[0].length, value: { amount, currency } });
  }
  const spoken = parseSpokenTransactionAmounts(message).filter(item => !amounts.some(amount => item.start < amount.end && item.end > amount.start));
  return [...amounts.map(item => ({ start: item.start, value: item.value })), ...spoken.map(item => ({ start: item.start, value: { amount: item.amount, currency: item.currency } }))]
    .sort((a, b) => a.start - b.start).map(item => item.value);
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
  if (amounts.length !== 1) return null;
  // A fast amount-only edit must not swallow a changed description or date.
  // Leave meaningful remaining words to the contextual model and full patch.
  const rest = normalized
    .replace(/\$\s*\d[\d.,]*|\b\d[\d.,]*\s*(?:k|nghin|ngan|trieu|tr|million|m|nhan\s+dan\s+te|renminbi|bang\s+anh|my\s+kim|do\s+la|usd|dollars?|dollar|do|cny|rmb|yuan|te|eur|euro|gbp|pound|pounds|bang|jpy|yen|vnd|dong|₫|đ|\$|€|£|¥|元|人民币|美元)(?:\s*(?:nhan\s+dan\s+te|renminbi|bang\s+anh|my\s+kim|do\s+la|usd|dollars?|dollar|do|cny|rmb|yuan|te|eur|euro|gbp|pound|pounds|bang|jpy|yen|vnd|dong|₫|đ|\$|€|£|¥|元|人民币|美元))?/g, " ")
    .replace(/\b(?:i meant|y toi|dinh noi|make that|change it to|so tien|toi|minh|nham|sai|actually|correction|i|la|thanh)\b/g, " ")
    .replace(/[\s,.:;!]+/g, "");
  return rest ? null : amounts[0];
}

/** Draft amounts always include an unambiguous ISO currency code. */
export function formatTransactionMoney(amount: number, currency: string): string {
  const code = currency.trim().toUpperCase();
  let fractionDigits = code === "VND" || code === "JPY" || code === "KRW" ? 0 : 2;
  try {
    const resolved = new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits;
    if (typeof resolved === "number") fractionDigits = resolved;
  } catch { /* use default */ }
  const formatted = new Intl.NumberFormat("en-US", { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }).format(amount);
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
  const spokenRanges = parseSpokenTransactionAmounts(message).sort((a, b) => b.start - a.start);
  const withoutSpokenAmount = spokenRanges.reduce((text, item) => text.slice(0, item.start) + " " + text.slice(item.end), message);
  const title = withoutSpokenAmount.trim().replace(/\b(?:rưỡi|ruoi)\b/giu, " ")
    .replace(/(?:\$\s*\d[\d.,]*|\b\d[\d.,]*\s*(?:k|nghìn|ngàn|nghin|ngan|triệu|trieu|tr|million|m|nhân\s+dân\s+tệ|nhan\s+dan\s+te|renminbi|bảng\s+anh|bang\s+anh|đô\s*la|do\s*la|đô\s*mỹ|do\s*my|mỹ\s*kim|my\s*kim|usd|dollars?|dollar|đô|do|cny|rmb|yuan|tệ|te|eur|euro|gbp|pound|pounds|bảng|bang|jpy|yen|yên|vnd|đồng|dong|₫|đ|\$|€|£|¥|元|人民币|美元)(?:\s*(?:nhân\s+dân\s+tệ|nhan\s+dan\s+te|renminbi|bảng\s+anh|bang\s+anh|đô\s*la|do\s*la|đô\s*mỹ|do\s*my|mỹ\s*kim|my\s*kim|usd|dollars?|dollar|đô|do|cny|rmb|yuan|tệ|te|eur|euro|gbp|pound|pounds|bảng|bang|jpy|yen|yên|vnd|đồng|dong|₫|đ|\$|€|£|¥|元|人民币|美元))?)/giu, " ")
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
  return /\b(an|uong|mua|dong|nop|nhan|tra|di xe|bat xe|do xang|gui|thanh toan|chuyen khoan|kham benh|ve xe)\b/.test(value)
    || /\d[\d.,]*\s*(k|nghin|ngan|trieu|tr|million|m|dong|vnd|₫|đ|te|nhan\s*dan\s*te|cny|rmb|yuan|usd|do|euro?|gbp|bang|yen)\b/.test(value);
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
  return drafts.map((draft) => {
    if (draft.id !== id) return draft;
    const next = { ...draft, ...patch, ...(Object.hasOwn(patch, "category") ? { newCategory: undefined } : {}) };
    if (patch.currency && patch.currency !== draft.currency && !Object.hasOwn(patch, "wallet")) {
      const matches = state.wallets.filter(wallet => !wallet.archived && wallet.currency.toUpperCase() === patch.currency!.toUpperCase());
      next.wallet = matches.length === 1 ? matches[0].id : null;
    }
    return validateDraftForState(next, state);
  });
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
  if (draftFundingIssues(drafts, state).length) return { state, committed: [] };
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
    const now = new Date();
    const timeString = [
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0"),
    ].join(":");
    const finalDate = draft.date.length === 10 ? `${draft.date}T${timeString}` : draft.date;
    transactions.push({
      id: draft.id,
      title: draft.title.trim(),
      amount: draft.amount,
      type: draft.type,
      category: draft.category,
      date: finalDate,
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
