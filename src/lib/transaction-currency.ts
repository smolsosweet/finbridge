export interface CurrencyWalletCandidate {
  id: string;
  currency: string;
}

export interface WalletCurrencyResolution {
  currency: string | null;
  walletId: string | null;
  ambiguous: boolean;
}

function normalizeCurrencyText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi").replace(/đ/g, "d");
}

function detectCurrencyCues(message: string): Set<string> {
  const normalized = normalizeCurrencyText(message);
  const detected = new Set<string>();

  if (/(?:\$|\busd\b|\bdollars?\b|\bdo\s+la\b|\b\d[\d.,]*\s*do\b)/i.test(normalized)) detected.add("USD");
  if (/(?:\bcny\b|\brmb\b|\byuan\b|\brenminbi\b|\bnhan\s+dan\s+te\b|\b\d[\d.,]*\s*te\b)/i.test(normalized)) detected.add("CNY");
  const explicitForeignCurrencyAfterShorthand = /\b\d[\d.,]*\s*(?:k|nghin|ngan|trieu|tr)\s*(?:usd|dollars?|dollar|do\s*la|do|cny|rmb|yuan|te)\b/i.test(normalized);
  if (/(?:\bvnd\b|\bdong\b|₫)/i.test(normalized)
    || (!explicitForeignCurrencyAfterShorthand && /\b\d[\d.,]*\s*(?:k|nghin|ngan|trieu|tr)\b/i.test(normalized))) detected.add("VND");

  return detected;
}

/** Detect only explicit, common currency wording; no cue means no currency assumption. */
export function inferTransactionCurrency(message: string): string | null {
  const detected = detectCurrencyCues(message);
  return detected.size === 1 ? [...detected][0] : null;
}

export function resolveExplicitWallet(message: string, wallets: Array<CurrencyWalletCandidate & { name: string }>): string | null {
  const normalizedMessage = normalizeCurrencyText(message);
  const matches = wallets.filter((wallet) => {
    const name = normalizeCurrencyText(wallet.name).trim();
    if (name.length < 3 || name === ".") return false;
    return new RegExp(`(^|[^a-z0-9])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(normalizedMessage);
  });
  return matches.length === 1 ? matches[0].id : null;
}

/** Select a wallet only when a currency cue maps to exactly one active wallet. */
export function resolveUniqueCurrencyWallet(message: string, wallets: CurrencyWalletCandidate[]): WalletCurrencyResolution {
  const detected = detectCurrencyCues(message);
  if (detected.size !== 1) return { currency: null, walletId: null, ambiguous: detected.size > 1 };
  const currency = [...detected][0];
  const matching = wallets.filter((wallet) => wallet.currency.trim().toUpperCase() === currency);
  return {
    currency,
    walletId: matching.length === 1 ? matching[0].id : null,
    ambiguous: matching.length > 1,
  };
}
