import { normalizeVietnameseMessage } from "@/lib/transaction-drafts";

export interface TransactionDeletionCriteria {
  scope: "none" | "matching" | "all";
  amount: number | null;
  walletId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  category: string | null;
  searchTerm: string | null;
  type: "expense" | "income" | "transfer" | null;
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
}

export function hasTransactionDeletionFilter(criteria: TransactionDeletionCriteria) {
  return Boolean(criteria.amount !== null || criteria.walletId || criteria.periodStart || criteria.periodEnd || criteria.category || criteria.searchTerm || criteria.type);
}

function normalizedDeletionTokens(value: string) {
  const ignored = new Set(["xoa", "bo", "hay", "giao", "dich", "khoan", "an", "uong", "giup", "toi", "cho", "ngay", "hom", "qua", "yesterday", "today", "transaction", "transactions", "please", "delete", "remove", "the", "on", "from"]);
  return normalizeVietnameseMessage(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1 && !ignored.has(word));
}

export function findTransactionsForDeletion<T extends DeletableTransaction>(transactions: T[], criteria: TransactionDeletionCriteria): T[] {
  if (criteria.scope === "none") return [];
  const hasFilter = hasTransactionDeletionFilter(criteria);
  if (criteria.scope === "matching" && !hasFilter) return [];

  const term = criteria.searchTerm ? normalizeVietnameseMessage(criteria.searchTerm) : "";
  const tokens = criteria.searchTerm ? normalizedDeletionTokens(criteria.searchTerm) : [];
  const expectedCents = criteria.amount === null ? null : Math.round(criteria.amount * 100);
  return transactions.filter((transaction) => {
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
}
