import type { TransferAudit, TransferBill, TransferDocument, TransferPlan } from "./international-transfer";

export type TransferView = "pending" | "completed" | "history";
export const TRANSFER_LIST_BATCH = 5;
export function completedTransfers(doc: Pick<TransferDocument, "receipts" | "plans">) {
  const unique = new Map<string, TransferPlan>();
  for (const plan of [...doc.plans, ...doc.receipts]) {
    if (plan.status === "completed" && plan.receiptId) unique.set(plan.id, plan);
  }
  return [...unique.values()].sort((a, b) => (b.completedAt || b.createdAt).localeCompare(a.completedAt || a.createdAt));
}
export function pendingTransferBills(bills: TransferBill[], receipts: TransferPlan[], includeArchived = false) {
  const paid = new Set(receipts.map(plan => plan.bill.id));
  return bills.filter(bill => !paid.has(bill.id) && (includeArchived || !bill.archived));
}
export function transferHistoryTarget(event: TransferAudit, doc: Pick<TransferDocument, "bills" | "plans" | "receipts">) {
  const plan = doc.plans.find(plan => plan.id === event.targetId) || doc.receipts.find(plan => plan.id === event.targetId);
  const bill = plan?.bill || doc.bills.find(bill => bill.id === event.targetId);
  return { plan, bill };
}
