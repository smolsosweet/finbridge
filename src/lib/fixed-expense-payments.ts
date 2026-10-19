import type { AppState, FixedExpense, Transaction } from "../components/sites/rolly/replica/store";
import { occurrencePayment, plannedOccurrences } from "../components/sites/rolly/replica/planningModel";

export function expenseWallet(state: AppState, expense: FixedExpense) {
  const budget = state.goals.find(g => g.kind === "budget" && g.id === expense.budgetId);
  return state.wallets.find(w => w.id === (budget?.wallet || expense.walletId));
}
export function fixedExpensePayment(state: AppState, expenseId: string, dueDate: string) {
  return occurrencePayment(state, expenseId, dueDate);
}
export type ExpenseOccurrenceStatus = "not-due" | "due-soon" | "due-today" | "overdue" | "paid";
export const occurrenceStatusCopy = {
  vi: { "not-due": "Chưa đến hạn", "due-soon": "Sắp đến hạn", "due-today": "Đến hạn hôm nay", overdue: "Quá hạn", paid: "Đã thanh toán" },
  en: { "not-due": "Not due yet", "due-soon": "Due soon", "due-today": "Due today", overdue: "Overdue", paid: "Paid" },
  zh: { "not-due": "尚未到期", "due-soon": "即将到期", "due-today": "今天到期", overdue: "已逾期", paid: "已支付" },
} as const;
/** Occurrence identity and payment are per due date, never per recurring plan. */
export function fixedExpenseOccurrence(state: Pick<AppState, "transactions">, expense: FixedExpense, due: string, asOf: string) {
  const daysUntil = Math.round((Date.parse(due + "T12:00:00Z") - Date.parse(asOf + "T12:00:00Z")) / 86400000);
  const payment = occurrencePayment(state, expense.id, due);
  const paid = !!payment && payment.date.slice(0, 10) <= asOf;
  // Three days is the existing application fallback; an explicit zero stays zero.
  const reminderDays = expense.reminderDays ?? 3;
  const status: ExpenseOccurrenceStatus = paid ? "paid" : daysUntil < 0 ? "overdue" : daysUntil === 0 ? "due-today" : daysUntil <= reminderDays ? "due-soon" : "not-due";
  return { id: `${expense.id}:${due}`, due, status, daysUntil, reminderDays, reminderActive: !paid && daysUntil <= reminderDays, payment: paid ? payment : undefined };
}
export function nextScheduledExpenseDue(expense: FixedExpense, afterDue: string) {
  if (expense.recurrence === "once" || !expense.active) return null;
  const start = new Date(afterDue + "T12:00:00Z");
  if (!Number.isFinite(start.getTime())) return null;
  start.setUTCDate(start.getUTCDate() + 1);
  return plannedOccurrences(expense, start.toISOString().slice(0, 10), `${start.getUTCFullYear() + 2}-12-31`)[0] || null;
}
export function unpaidOccurrences(state: AppState, expense: FixedExpense, start: string, end: string) {
  const result: string[] = [];
  const paid = new Set(state.transactions.filter(t => t.type === "expense" && t.paymentConfirmation === "user" && t.fixedExpenseId === expense.id).map(t => t.fixedExpenseDueDate));
  let cursor = start;
  // Page through long histories: 400 already-paid weekly occurrences must not
  // hide the next outstanding bill. The horizon bounds all generated dates.
  for (;;) {
    const batch = plannedOccurrences(expense, cursor, end);
    result.push(...batch.filter(due => !paid.has(due)));
    if (batch.length < 400) return result;
    const next = new Date(batch[batch.length - 1] + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
    if (cursor > end) return result;
  }
}
export function nextExpenseDue(state: AppState, expense: FixedExpense, asOf: string) {
  if (expense.recurrence === "once") return expense.dueDate;
  const year = Number(asOf.slice(0, 4)) + 2;
  return unpaidOccurrences(state, expense, expense.dueDate, `${year}-12-31`)[0] || null;
}
export function recordFixedExpensePayment(state: AppState, expenseId: string, input: { dueDate: string; paidOn: string; amount: number; walletId: string; note: string; transactionId: string; existingTransactionId?: string }, asOf: string): AppState {
  const expense = state.fixedExpenses?.find(e => e.id === expenseId), originalWallet = expense && expenseWallet(state, expense);
  const existing=input.existingTransactionId?state.transactions.find(t=>t.id===input.existingTransactionId):undefined;
  if(input.existingTransactionId){if(!existing||existing.type!=="expense"||(existing.fixedExpenseId&&(existing.fixedExpenseId!==expenseId||existing.fixedExpenseDueDate!==input.dueDate))||existing.category!==expense?.category)throw new Error("INVALID_BILL_PAYMENT");input={...input,amount:existing.amount,paidOn:existing.date.slice(0,10),walletId:existing.wallet,note:existing.note};}
  const source = state.wallets.find(w => w.id === input.walletId && !w.archived);
  const digits = source ? new Intl.NumberFormat("en",{style:"currency",currency:source.currency}).resolvedOptions().maximumFractionDigits ?? 2 : 2;
  const validDate = (key: string) => {const d=new Date(key+"T12:00:00Z");return /^\d{4}-\d{2}-\d{2}$/.test(key)&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===key;};
  if (!expense?.active || !originalWallet || originalWallet.archived || !source || source.currency!==originalWallet.currency || !validDate(input.dueDate) || !plannedOccurrences(expense,input.dueDate,input.dueDate).length || !validDate(input.paidOn) || input.paidOn > asOf || !Number.isFinite(input.amount) || input.amount<=0 || input.amount>1e12 || Math.abs(input.amount*10**digits-Math.round(input.amount*10**digits))>1e-5 || input.note.length>10000) throw new Error("INVALID_BILL_PAYMENT");
  if (fixedExpensePayment(state,expenseId,input.dueDate)) return state;
  if(existing)return {...state,transactions:state.transactions.map(t=>t.id===existing.id?{...t,fixedExpenseId:expenseId,fixedExpenseDueDate:input.dueDate,paymentConfirmation:"user"}:t)};
  if (!input.transactionId || input.transactionId.length>100 || state.transactions.some(t=>t.id===input.transactionId)) throw new Error("INVALID_BILL_PAYMENT");
  const transaction: Transaction = {id:input.transactionId,title:expense.title,amount:input.amount,type:"expense",category:expense.category,wallet:source.id,date:input.paidOn,note:input.note,fixedExpenseId:expense.id,fixedExpenseDueDate:input.dueDate,paymentConfirmation:"user"};
  return {...state,transactions:[...state.transactions,transaction]};
}
// Validate new/edited links on the server too. Historical payments survive removal
// of their plan. Changes to amount/date remain possible through transaction editing.
export function validateFixedPaymentChanges(previous: AppState | null, next: AppState) {
  let timeZone=String(next.settings.timeZone||"UTC");try{new Intl.DateTimeFormat("en",{timeZone});}catch{timeZone="UTC";}
  const parts=new Intl.DateTimeFormat("en",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const now=["year","month","day"].map(key=>parts.find(p=>p.type===key)!.value).join("-");
  for (const tx of next.transactions.filter(t=>t.fixedExpenseId)) {
    const currency=next.wallets.find(w=>w.id===tx.wallet)?.currency;
    if(!currency||tx.date.slice(0,10)>now||tx.amount<=0)throw new Error("INVALID_BILL_PAYMENT");
    const digits=new Intl.NumberFormat("en",{style:"currency",currency}).resolvedOptions().maximumFractionDigits??2;
    if(Math.abs(tx.amount*10**digits-Math.round(tx.amount*10**digits))>1e-5)throw new Error("INVALID_BILL_PAYMENT");
    const old = previous?.transactions.find(t=>t.id===tx.id);
    if (old && old.fixedExpenseId===tx.fixedExpenseId && old.fixedExpenseDueDate===tx.fixedExpenseDueDate) {
      if (previous?.wallets.find(w=>w.id===old.wallet)?.currency !== next.wallets.find(w=>w.id===tx.wallet)?.currency) throw new Error("INVALID_BILL_PAYMENT");
      continue;
    }
    const expense = next.fixedExpenses?.find(e=>e.id===tx.fixedExpenseId), original = expense && expenseWallet(next,expense), source = next.wallets.find(w=>w.id===tx.wallet);
    if (!expense?.active || !original || original.archived || !source || source.archived || source.currency!==original.currency || tx.category!==expense.category || !plannedOccurrences(expense,tx.fixedExpenseDueDate!,tx.fixedExpenseDueDate!).length) throw new Error("INVALID_BILL_PAYMENT");
  }
}
