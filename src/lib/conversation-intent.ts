import { z } from "zod";
import { isWorkspaceCreationRequest } from "./workspace-actions";
import { normalizeVietnameseMessage, parseTransactionAmounts, type TransactionDraft } from "./transaction-drafts";
import type { CategoryCommand } from "./category-operations";

export const conversationIntents = ["create_transaction", "create_wallet", "create_budget", "create_fixed_expense", "update_pending_transaction", "answer_clarification", "query_financial_data", "analyze_spending", "simulate_financial_scenario", "list_categories", "create_category", "rename_category", "merge_categories", "delete_category", "delete_transactions", "general_finance_question", "unsupported_or_ambiguous_request"] as const;
export type ConversationIntent = typeof conversationIntents[number];
export const draftPatchSchema = z.object({ title: z.string().trim().min(1).max(160).optional(), amount: z.number().finite().positive().max(1e12).nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(), type: z.enum(["expense", "income"]).nullable().optional(), category: z.string().max(100).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), wallet: z.string().max(100).nullable().optional(),
}).strict();

export function isCategoryManagementMessage(message: string) {
  const text = normalizeVietnameseMessage(message);
  if (/\b(xoa (?:tat ca )?(?:cac )?giao dich|delete (?:all )?transactions)\b|删除交易/.test(text)) return false;
  if (/\b(giao dich|khoan|draft|transaction)\b/.test(text) && /\b(sua|doi danh muc|edit|update|change category)\b/.test(text) && !/\b(doi ten|rename|merge|gop|xoa|delete)\b/.test(text)) return false;
  return /\b(danh muc|categor(?:y|ies))\b|类别|分类/.test(text)
    && /\b(xoa|bo|doi ten|sua|chinh sua|gop|hop nhat|tao|them|liet ke|delete|remove|rename|merge|create|add|list|edit|update)\b|删除|重命名|合并|创建|列出/.test(text);
}
export function isDraftCorrection(message: string) {
  return /\b(nham|sua|doi (?:lai|so tien|ngay|vi|danh muc)|khoan (?:do|nay)|giao dich (?:do|nay)|actually|i meant|correct|change|that (?:one|transaction))\b|改成|刚才那笔/.test(normalizeVietnameseMessage(message));
}
export function isHypotheticalMessage(message: string) {
  return /\b(neu|gia su|gia dinh|what if|if i|simulate|simulation)\b|如果|假设/.test(normalizeVietnameseMessage(message));
}
export function isClearlyNewTransaction(message: string) {
  if (isWorkspaceCreationRequest(message) || isCategoryManagementMessage(message) || isDraftCorrection(message) || isHypotheticalMessage(message)) return false;
  const text = normalizeVietnameseMessage(message);
  return parseTransactionAmounts(message).length > 0 && /\b(mua|an|uong|hoc|chi|het|dong|nop|nhan|tra|kham|di|paid|spent|bought|received|earned|breakfast|lunch|dinner|tuition|them (?:mot )?khoan (?:nua|moi)|another (?:one|transaction)|one more)\b|买|花了|收入|学费/.test(text)
    && !/[?？]|\b(bao nhieu|du tien|co du|how much|can i|enough)\b/.test(text);
}

/** Explicit identity beats recency. No silent default to the last of several drafts. */
export function resolvePendingDraft(message: string, drafts: TransactionDraft[], targetId: string | null, activeId: string | null): TransactionDraft | null {
  const text = normalizeVietnameseMessage(message);
  const mentioned = drafts.filter(d => d.title.trim().length >= 3 && text.includes(normalizeVietnameseMessage(d.title)));
  if (mentioned.length === 1) return mentioned[0];
  if (mentioned.length > 1) return null;
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 1);
  const descriptiveMatches = drafts.filter(d => {
    const title = normalizeVietnameseMessage(d.title);
    const ignored = new Set(["toi", "minh", "mua", "an", "uong", "khoan", "giao", "dich", "ngay", "hom", "nay", "qua", "the", "that", "transaction"]);
    return tokens.some(word => !ignored.has(word) && title.split(/[^\p{L}\p{N}]+/u).includes(word));
  });
  if (descriptiveMatches.length === 1) return descriptiveMatches[0];
  const genericReference = /^(?:(?:toi|minh)\s+)?(?:nham|sua|doi|actually|i meant)|\b(khoan do|khoan nay|that one|giao dich do)\b/.test(text) && descriptiveMatches.length === 0;
  if (drafts.length > 1 && !activeId && genericReference) return null;
  if (targetId) return drafts.find(d => d.id === targetId) || null;
  if (activeId) return drafts.find(d => d.id === activeId) || null;
  return drafts.length === 1 ? drafts[0] : null;
}

/** Exact user-owned names resolve common management requests; other phrasing goes to the LLM. */
export function localCategoryCommand(message: string, categories: string[]): CategoryCommand | "list_categories" | null {
  if (!isCategoryManagementMessage(message)) return null;
  const text = normalizeVietnameseMessage(message);
  const spans = categories.flatMap(name => {
    const normalized = normalizeVietnameseMessage(name);
    const found: Array<{ name: string; start: number; end: number }> = [];
    let start = normalized ? text.indexOf(normalized) : -1;
    while (start >= 0) {
      found.push({ name, start, end: start + normalized.length });
      start = text.indexOf(normalized, start + normalized.length);
    }
    return found;
  }).sort((left, right) => (right.end - right.start) - (left.end - left.start));
  const selected: typeof spans = [];
  for (const span of spans) if (!selected.some(other => span.start < other.end && span.end > other.start)) selected.push(span);
  const matches = [...new Set(selected.sort((a, b) => a.start - b.start).map(span => span.name))];
  if (/\b(liet ke|danh sach|list|show)\b|列出/.test(text)) return "list_categories";
  if (/\b(xoa|delete|remove)\b|删除/.test(text) && matches.length) {
    const count = text.match(/\b(?:xoa|delete|remove)\s+(\d+)\s+(?:danh muc|categories)\b/);
    if (count && Number(count[1]) !== matches.length) return null;
    return { operation: "delete_category", sources: matches, target: null, type: null };
  }
  return null;
}
