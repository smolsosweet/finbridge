import { normalizeVietnameseMessage } from "./transaction-drafts";

export interface TransactionDeletionCriteria {
  scope: "none" | "matching" | "all";
  amount: number | null;
  walletId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  category: string | null;
  searchTerm: string | null;
  type: "expense" | "income" | "transfer" | null;
  relativeOrder?: "latest" | "oldest" | null;
}

export interface DeletableTransaction {
  id: string;
  title: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  category: string;
  date: string;
  wallet: string;
  note?: string;
  occurredAt?: string;
}

export function detectRelativeOrder(text: string): "latest" | "oldest" | null {
  const norm = normalizeVietnameseMessage(text);
  if (/\b(?:moi nhat|gan nhat|vua tao|vua roi|vua nhap|gan day nhat|latest|most recent|newest|last)\b|最新|刚创建|最近/.test(norm)) {
    return "latest";
  }
  if (/\b(?:cu nhat|dau tien|oldest|first)\b|最早|第一笔/.test(norm)) {
    return "oldest";
  }
  return null;
}

export function cleanDeletionSearchTerm(term: string | null): string | null {
  if (!term) return null;
  const cleaned = normalizeVietnameseMessage(term)
    .replace(/\b(?:giao\s*d[ií]ch|giao\s*diichj|khoan|cai|muc|gd|transaction|the|this|nay|do)\b/giu, "")
    .replace(/\b(?:moi nhat|gan nhat|vua tao|vua roi|vua nhap|gan day nhat|latest|most recent|newest|last)\b/giu, "")
    .replace(/\b(?:cu nhat|dau tien|oldest|first)\b/giu, "")
    .replace(/最新|刚创建|最近|最早|第一笔/gu, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

export function hasTransactionDeletionFilter(criteria: TransactionDeletionCriteria) {
  return Boolean(
    criteria.amount !== null ||
    criteria.walletId ||
    criteria.periodStart ||
    criteria.periodEnd ||
    criteria.category ||
    criteria.searchTerm ||
    criteria.type ||
    criteria.relativeOrder
  );
}

function normalizedDeletionTokens(value: string) {
  const ignored = new Set(["xoa", "bo", "hay", "giao", "dich", "khoan", "an", "uong", "giup", "toi", "cho", "ngay", "hom", "qua", "yesterday", "today", "transaction", "transactions", "please", "delete", "remove", "the", "on", "from"]);
  return normalizeVietnameseMessage(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !ignored.has(word));
}

export function findTransactionsForDeletion<T extends DeletableTransaction>(transactions: T[], criteria: TransactionDeletionCriteria): T[] {
  if (criteria.scope === "none") return [];

  const relativeOrder = criteria.relativeOrder || (criteria.searchTerm ? detectRelativeOrder(criteria.searchTerm) : null);
  const rawTerm = criteria.searchTerm ? cleanDeletionSearchTerm(criteria.searchTerm) : null;
  const effectiveCriteria: TransactionDeletionCriteria = {
    ...criteria,
    searchTerm: rawTerm,
    relativeOrder,
  };

  const hasFilter = hasTransactionDeletionFilter(effectiveCriteria);
  if (criteria.scope === "matching" && !hasFilter) return [];

  const term = rawTerm ? normalizeVietnameseMessage(rawTerm) : "";
  const tokens = rawTerm ? normalizedDeletionTokens(rawTerm) : [];
  const expectedCents = criteria.amount === null ? null : Math.round(criteria.amount * 100);

  const matched = transactions.filter((transaction) => {
    const date = transaction.date.slice(0, 10);
    if (expectedCents !== null && Math.round(transaction.amount * 100) !== expectedCents) return false;
    if (criteria.walletId && transaction.wallet !== criteria.walletId) return false;
    if (criteria.periodStart && date < criteria.periodStart) return false;
    if (criteria.periodEnd && date > criteria.periodEnd) return false;
    if (criteria.category && normalizeVietnameseMessage(transaction.category) !== normalizeVietnameseMessage(criteria.category)) return false;
    if (criteria.type && transaction.type !== criteria.type) return false;
    const searchText = normalizeVietnameseMessage(`${transaction.title} ${transaction.category} ${transaction.note || ""}`);
    if (term && !searchText.includes(term) && (!tokens.length || !tokens.every((token) => searchText.includes(token)))) return false;
    return true;
  });

  if (relativeOrder === "latest" && matched.length > 0) {
    const sorted = [...matched].sort((a, b) => {
      const aKey = a.occurredAt || a.date || "";
      const bKey = b.occurredAt || b.date || "";
      return bKey.localeCompare(aKey);
    });
    return [sorted[0]];
  }

  if (relativeOrder === "oldest" && matched.length > 0) {
    const sorted = [...matched].sort((a, b) => {
      const aKey = a.occurredAt || a.date || "";
      const bKey = b.occurredAt || b.date || "";
      return aKey.localeCompare(bKey);
    });
    return [sorted[0]];
  }

  return matched;
}
