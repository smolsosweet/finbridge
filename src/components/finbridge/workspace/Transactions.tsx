"use client";
import { aiQuotaClientMessage } from "@/lib/ai-quota";

import { useAppUiText } from "./useAppUiText";
import { useConversationLanguage } from "./useConversationLanguage";
import { CONVERSATION_TRANSLATION_COPY } from "@/lib/conversation-translation";

import { finnChatCopy } from "@/lib/finn-voice";
import { useState, useRef, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ledgerDateKey } from "./calendarLedger";
import { Camera, Mic, Square, Send, Settings, Plus, X, Trash2 } from "lucide-react";
import { EmptyState, Field, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { ChatTransferCard } from "./ChatTransferCard";
import { transferChatCopy, transferChatResultSchema, transferChatWriteSchema, type TransferChatRequest, type TransferChatResult } from "@/lib/transfer-chat-model";
import { transferChatWriteResult } from "@/lib/transfer-chat";
import { TRANSFER_COPY } from "@/components/transfers/transfer-copy";
import { currencySymbol, flushWorkspace, flushWorkspaceForAnalysis, getWorkspaceState, money, setSetting, today, updateState, useAppState, workspaceOwner, workspacePersistence, type AppState, type ChatMessage, type Transaction } from "./store";
import { applyCategoryOperation, prepareCategoryOperation, renameCategoryMessageReferences, type CategoryCommand, type CategoryConfirmation } from "@/lib/category-operations";
import { categoryDialogueSchema, type CategoryChoice } from "@/lib/category-dialogue";
import { categoryOperationCopy, categoryOperationDescription, categoryOperationError } from "@/lib/category-operation-copy";
import { isCategoryManagementMessage, isClearlyNewTransaction, isDraftCorrection, localCategoryCommand, resolvePendingDraft, type ConversationIntent } from "@/lib/conversation-intent";
import { applyDraftAmountCorrection, categoryResolutionDraftIds, createTimeoutTransactionDraft, editDraftById, formatTransactionMoney, inferDraftCategory, isNewTransactionMessage, isValidDraftCategoryName, matchDraftCategoryAnswer, normalizeVietnameseMessage, readyDrafts, removeDraftById, requestedDraftCategory, similarDraftCategories, validateAndCommitDrafts, validateDraftForState, type TransactionDraft } from "@/lib/transaction-drafts";
import { resolveExplicitWallet, resolveUniqueCurrencyWallet } from "@/lib/transaction-currency";
import { answerFinancialQuery, resolveFinancialFollowup, type FinancialAction } from "@/lib/financial-chat";
import { modelHistory } from "@/lib/chat-local-plan";
import { answerPresentationSchema, assistantScenarioSchema } from "@/lib/assistant-response";
import { resolveSpendingPlanAdjustment, spendingPlanAdjustmentSchema, spendingPlanOptionsSchema, type SpendingPlanOptions } from "@/lib/financial-outlook";
import { ChatSpendingPlan } from "./ChatSpendingPlan";
import { FinancialChatAnswer } from "./FinancialChatAnswer";
import { prepareReceiptImage } from "@/lib/receipt-image";
import { AI_AUDIO_BYTES, AI_RECORDING_SECONDS } from "@/lib/ai-limits";
import { definitelyRejectedWorkspace, workspaceSaveErrorMessage } from "@/lib/workspace-payload";
import { pendingDraftInterruption, pendingDraftReminder, rollbackRejectedDrafts, shouldBlockNewDraft } from "@/lib/pending-draft-policy";
import { asksForCalculationExplanation, scenarioCalculationExplanation } from "@/lib/scenario-explanation";
import { scenarioAnswer } from "@/lib/scenario-answer";
import { applyPlanningDeletion, explicitPlanningDeletion, planningConfirmationReply, planningDeletionCopy, planningDeletionSchema, planningEntities, planningReferencesSchema, planningSelectionReply, type PlanningDeletion } from "@/lib/planning-deletion";
import { PlanningDeletionCard } from "./PlanningDeletionCard";
import { FixedExpensePaymentCard } from "./FixedExpensePaymentCard";
import { FixedExpenseStatusCard } from "./FixedExpenseStatusCard";
import { PlanningEditCard } from "./PlanningEditCard";
import {
  fixedExpensePaymentProposalSchema,
  type FixedExpensePaymentProposal,
  fixedExpenseStatusProposalSchema,
  type FixedExpenseStatusProposal,
  planningEditProposalSchema,
  type PlanningEditProposal,
  fixedExpensePaymentCopy,
  fixedExpenseStatusCopy,
  planningEditCopy,
  isFixedExpensePaymentMessage,
  isFixedExpenseStatusMessage,
  isPlanningEditMessage,
  prepareFixedExpensePayment,
  prepareFixedExpenseStatus,
  preparePlanningEdit,
  applyFixedExpensePayment,
  applyFixedExpenseStatus,
  applyPlanningEdit,
  planningActionConfirmationReply,
} from "@/lib/planning-actions";
import { hasCompatibleDraftWallet, unavailableWalletReply } from "@/lib/transaction-drafts";
import { WorkspaceActionCard } from "./WorkspaceActionCard";
import { applyWorkspaceProposal, inspectWorkspaceProposal, isWorkspaceCreationRequest, workspaceActionCopy, workspaceProposalSchema, type ActionField, type WorkspaceProposal } from "@/lib/workspace-actions";
import { calculateScenario, normalizePlannerResponse, scenarioContext, type NormalizedPlannerResponse, type ScenarioResult } from "@/lib/scenario-planner";
import planStyles from "./FinancialOutlook.module.css";
import { tools } from "./Tools";
import { resolveLanguage, resolveWalletDisplayName, resolveCategoryDisplayName, type AppLanguage, LANGUAGE_LABELS } from "@/lib/i18n";
import { findTransactionsForDeletion, transactionDeletionSelection, detectRelativeOrder, cleanDeletionSearchTerm, type TransactionDeletionCriteria } from "@/lib/transaction-deletion";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-format";
import { draftAmountWarnings } from "@/lib/draft-amount-warnings";
import { DraftAmountWarnings } from "./DraftAmountWarnings";
import { draftFundingIssues, fundingIssueMessage } from "@/lib/transaction-funding";
import { SettingsActionCard } from "./SettingsActionCard";
import {
  settingsActionProposalSchema,
  type SettingsActionProposal,
  settingsActionCopy,
  isSettingsThemeMessage,
  isSettingsLanguageMessage,
  isSettingsWalletArchiveMessage,
  prepareWalletArchive,
  applyWalletArchive,
} from "@/lib/settings-actions";

const lockedDeletionConfirmations = new Set<string>();
const CATEGORY_FLOW_COPY = {
  en: { choose: "Choose a category", income: "Income", expense: "Expense", transaction: "Transaction", newCategory: "Create a new category", name: "New category name", placeholder: "Enter a category name", create: "Create and attach to draft", cancel: "Cancel", invalid: "Use 1–100 letters, numbers, spaces, or basic punctuation.", wrongType: "That name is already used for the other transaction type.", similar: "A similar category already exists", existing: "Similar categories already exist", selected: "Selected", temporary: "Temporary category", draftOnly: "Draft only", savedOnConfirm: "A new category is saved only when you confirm the transaction. Removing the draft discards it.", updated: "Category set to", notSaved: "Draft not saved yet", noOptions: "No existing category is available for this transaction type.", categoryPrompt: "Choose a category below or create a new one.", pendingCategory: "New category", stillDraft: "is attached to the draft only. It will be saved when you confirm.", saving: "Saving transaction…", processing: "Processing…", askTarget: "Which transaction needs a category?" },
  vi: { choose: "Chọn danh mục phù hợp", income: "Khoản thu", expense: "Khoản chi", transaction: "Giao dịch", newCategory: "Tạo danh mục mới", name: "Tên danh mục mới", placeholder: "Nhập tên danh mục", create: "Tạo và gắn vào bản nháp", cancel: "Hủy", invalid: "Tên danh mục không hợp lệ. Dùng chữ, số, dấu cách và dấu câu cơ bản (tối đa 100 ký tự).", wrongType: "Tên này đã được dùng cho loại giao dịch khác.", similar: "Có danh mục gần giống đã tồn tại", existing: "Danh mục gần giống đã có", selected: "Đang chọn", temporary: "Danh mục mới", draftOnly: "Chỉ trong bản nháp", savedOnConfirm: "Danh mục mới chỉ được lưu cùng giao dịch khi bạn xác nhận; bỏ bản nháp sẽ hủy danh mục đó.", updated: "Đã chọn danh mục", notSaved: "Bản nháp chưa được lưu", noOptions: "Chưa có danh mục phù hợp cho loại giao dịch này.", categoryPrompt: "Chọn danh mục có sẵn bên dưới hoặc tạo danh mục mới.", pendingCategory: "Danh mục", stillDraft: "đã được gắn tạm vào bản nháp. Danh mục mới chỉ được lưu khi bạn xác nhận giao dịch.", saving: "Đang lưu giao dịch…", processing: "Đang xử lý yêu cầu…", askTarget: "Bạn muốn chọn danh mục cho giao dịch nào?" },
  zh: { choose: "选择合适的类别", income: "收入", expense: "支出", transaction: "交易", newCategory: "创建新类别", name: "新类别名称", placeholder: "输入类别名称", create: "创建并附加到草稿", cancel: "取消", invalid: "请输入 1–100 个字母、数字、空格或常用标点。", wrongType: "该名称已用于另一种交易类型。", similar: "已有相似类别", existing: "已有相似类别", selected: "已选择", temporary: "新类别", draftOnly: "仅在草稿中", savedOnConfirm: "新类别仅在确认交易时保存；删除草稿会一并取消。", updated: "已选择类别", notSaved: "草稿尚未保存", noOptions: "此交易类型暂无可用类别。", categoryPrompt: "请选择下方现有类别或创建新类别。", pendingCategory: "类别", stillDraft: "附加类别草稿中。确认交易后才会保存新类别。", saving: "正在保存交易…", processing: "正在处理…", askTarget: "要为哪笔交易选择类别？" },
} as const;

export interface TransactionFormCopy {
  expense: string;
  income: string;
  item: string;
  amount: string;
  category: string;
  subcategory: string;
  wallet: string;
  date: string;
  nextScheduledDate: string;
  recurringInterval: string;
  timeUnit: string;
  recurringUnits: Array<{ value: string; label: string }>;
  note: string;
  attachedImage: string;
  attach: string;
  attached: string;
  cancel: string;
  save: string;
  confirm: string;
  deleteTransaction: string;
  addTransaction: string;
  editTransaction: string;
  addTransactionSubtitle: string;
  editTransactionSubtitle: string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  uncategorized: string;
}

export const TRANSACTION_FORM_I18N: Record<AppLanguage, TransactionFormCopy> = {
  vi: {
    expense: "Chi phí",
    income: "Thu nhập",
    item: "Mục",
    amount: "Số tiền",
    category: "Loại",
    subcategory: "Danh mục phụ (tùy chọn)",
    wallet: "Chọn Ví",
    date: "Ngày",
    nextScheduledDate: "Lịch trình tiếp theo Ngày",
    recurringInterval: "Khoảng thời gian định kỳ",
    timeUnit: "Đơn vị thời gian",
    recurringUnits: [
      { value: "day", label: "Ngày" },
      { value: "week", label: "Tuần" },
      { value: "month", label: "Tháng" },
      { value: "year", label: "Năm" },
    ],
    note: "Ghi chú",
    attachedImage: "Hình ảnh đính kèm",
    attach: "Đính kèm",
    attached: "✓ Đã đính kèm",
    cancel: "Hủy bỏ",
    save: "Lưu",
    confirm: "Xác nhận",
    deleteTransaction: "Xóa giao dịch",
    addTransaction: "Thêm giao dịch",
    editTransaction: "Chỉnh sửa giao dịch",
    addTransactionSubtitle: "Thêm giao dịch của bạn bên dưới.",
    editTransactionSubtitle: "Chỉnh sửa giao dịch của bạn bên dưới.",
    deleteConfirmTitle: "Xóa giao dịch?",
    deleteConfirmMessage: "Bạn có chắc chắn muốn xóa giao dịch này không?",
    uncategorized: "Chưa được phân loại",
  },
  en: {
    expense: "Expense",
    income: "Income",
    item: "Item",
    amount: "Amount",
    category: "Category",
    subcategory: "Subcategory (optional)",
    wallet: "Wallet",
    date: "Date",
    nextScheduledDate: "Next scheduled date",
    recurringInterval: "Recurring interval",
    timeUnit: "Time unit",
    recurringUnits: [
      { value: "day", label: "Daily" },
      { value: "week", label: "Weekly" },
      { value: "month", label: "Monthly" },
      { value: "year", label: "Yearly" },
    ],
    note: "Note",
    attachedImage: "Attached image",
    attach: "Attach",
    attached: "✓ Attached",
    cancel: "Cancel",
    save: "Save",
    confirm: "Confirm",
    deleteTransaction: "Delete transaction",
    addTransaction: "Add transaction",
    editTransaction: "Edit transaction",
    addTransactionSubtitle: "Add your transaction below.",
    editTransactionSubtitle: "Edit your transaction below.",
    deleteConfirmTitle: "Delete transaction?",
    deleteConfirmMessage: "Are you sure you want to delete this transaction?",
    uncategorized: "Uncategorized",
  },
  zh: {
    expense: "支出",
    income: "收入",
    item: "项目",
    amount: "金额",
    category: "分类",
    subcategory: "子分类（可选）",
    wallet: "钱包",
    date: "日期",
    nextScheduledDate: "下次计划日期",
    recurringInterval: "周期频率",
    timeUnit: "时间单位",
    recurringUnits: [
      { value: "day", label: "每天" },
      { value: "week", label: "每周" },
      { value: "month", label: "每月" },
      { value: "year", label: "每年" },
    ],
    note: "备注",
    attachedImage: "附加图片",
    attach: "附件",
    attached: "✓ 已附加",
    cancel: "取消",
    save: "保存",
    confirm: "确认",
    deleteTransaction: "删除交易",
    addTransaction: "添加交易",
    editTransaction: "编辑交易",
    addTransactionSubtitle: "在下方添加您的交易。",
    editTransactionSubtitle: "在下方编辑您的交易。",
    deleteConfirmTitle: "删除交易？",
    deleteConfirmMessage: "您确定要删除此交易吗？",
    uncategorized: "未分类",
  },
};

export function normalizeRecurringUnit(raw: string | undefined): "day" | "week" | "month" | "year" {
  if (!raw) return "month";
  const lower = raw.trim().toLowerCase();
  if (lower === "ngày" || lower === "day" || lower === "daily" || lower === "每天" || lower === "天" || lower === "日") return "day";
  if (lower === "tuần" || lower === "week" || lower === "weekly" || lower === "每周" || lower === "周") return "week";
  if (lower === "tháng" || lower === "month" || lower === "monthly" || lower === "每月" || lower === "月") return "month";
  if (lower === "năm" || lower === "year" || lower === "yearly" || lower === "每年" || lower === "年") return "year";
  return "month";
}

function clarificationQuestion(fields: string[]) {
  const labels: Record<string, string> = { amount: "số tiền", type: "đây là khoản thu hay chi", category: "danh mục", date: "ngày giao dịch", wallet: "ví hoặc tiền tệ" };
  return `Mình chưa xác định được ${[...new Set(fields)].map((field) => labels[field] || field).join(" và ")}. Bạn có thể trả lời ngay trong chat hoặc bấm “Chỉnh sửa” để bổ sung; giao dịch chưa được lưu.`;
}

function getBalanceAnswer(message: string, state: AppState, selectedWalletId: string) {
  const question = normalizeVietnameseMessage(message);
  if (!/(con bao nhieu|so du|bao nhieu tien|balance|how much.*(wallet|account))/.test(question)) return null;
  const mentionedWallet = state.wallets.find((wallet) => wallet.name.trim() !== "." && question.includes(normalizeVietnameseMessage(wallet.name)));
  const selectedWallet = state.wallets.find((wallet) => wallet.id === selectedWalletId && !wallet.archived);
  const wallets = mentionedWallet ? [mentionedWallet] : selectedWallet ? [selectedWallet] : state.wallets.filter((wallet) => !wallet.archived);
  if (!wallets.length) return "Mình chưa thấy ví đang hoạt động để tính số dư.";
  const query = resolveFinancialFollowup(message, {
    action: "balance", walletId: wallets.length === 1 ? wallets[0].id : null, scope: wallets.length === 1 ? "selected" : "all",
    periodStart: null, periodEnd: null, category: null, searchTerm: null, transactionType: null,
  });
  // Legacy error recovery has no validated scenario context. Do not turn a
  // conditional payment into an answer about the unchanged actual balance.
  return query.action === "balance" ? answerFinancialQuery(query, state, selectedWalletId, today()) : null;
}

export function TransactionForm({
  navigate,
  id = "",
  recurring = false,
  onClose,
}: {
  navigate: (screen: string) => void;
  id?: string;
  recurring?: boolean;
  onClose?: () => void;
}) {
  const state = useAppState();
  const lang = resolveLanguage(state.settings.language);
  const t = TRANSACTION_FORM_I18N[lang];

  const existing = state.transactions.find((item) => item.id === id);
  const calendarParams = useSearchParams();
  const requestedDate = ledgerDateKey(calendarParams.get("date") || "");
  const requestedWallet = state.wallets.find(w => !w.archived && w.currency === calendarParams.get("currency"));
  const [type, setType] = useState<"expense" | "income">(existing?.type === "income" ? "income" : "expense");
  const [title, setTitle] = useState(existing?.title || "");
  const [amount, setAmount] = useState(existing ? formatCurrencyInput(existing.amount) : "");
  const [date, setDate] = useState((existing && ledgerDateKey(existing.date)) || requestedDate || today());
  const [category, setCategory] = useState(existing?.category || state.categories[0]);
  const [wallet, setWallet] = useState(existing?.wallet || requestedWallet?.id || state.wallets.find(w => !w.archived)?.id || "");
  const [note, setNote] = useState(existing?.note || "");
  const [image, setImage] = useState(existing?.image || "");
  const [subcategory, setSubcategory] = useState(existing?.subcategory || "");
  const [interval, setInterval] = useState(existing?.interval || 1);
  const [unit, setUnit] = useState<string>(() => normalizeRecurringUnit(existing?.unit));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = () => (onClose ? onClose() : navigate("?tab=transactions"));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseCurrencyInput(amount);
    if (parsedAmount <= 0) return;
    const item: Transaction = {
      ...existing,
      id: existing?.id || crypto.randomUUID(),
      type,
      title,
      amount: parsedAmount,
      date: (existing?.date && existing.date.slice(0, 10) === date && existing.date.length > 10)
        ? existing.date
        : date.length === 10
          ? `${date}T${[String(new Date().getHours()).padStart(2, "0"), String(new Date().getMinutes()).padStart(2, "0"), String(new Date().getSeconds()).padStart(2, "0")].join(":")}`
          : date,
      category,
      subcategory,
      wallet,
      note,
      image: image || (!id ? state.receiptDraft : "") || "",
      ...(recurring ? { interval, unit } : {}),
    };
    updateState((s) =>
      recurring
        ? { ...s, recurring: [...s.recurring, item] }
        : {
            ...s,
            receiptDraft: "",
            transactions: existing
              ? s.transactions.map((target) => (target.id === existing.id ? item : target))
              : [...s.transactions, item],
          }
    );
    back();
  };

  const content = (
    <form className="r-form" onSubmit={save}>
      <div className="r-type-pills r-align-left">
        <button
          type="button"
          className={type === "expense" ? "active" : ""}
          onClick={() => setType("expense")}
        >
          {t.expense}
        </button>
        <button
          type="button"
          className={type === "income" ? "active" : ""}
          disabled={!!existing?.fixedExpenseId}
          onClick={() => setType("income")}
        >
          {t.income}
        </button>
      </div>

      <input
        aria-label={t.item}
        placeholder={t.item}
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <input
        aria-label={t.amount}
        placeholder={t.amount}
        required
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={() => setAmount(formatCurrencyInput(amount))}
      />

      <Field label={t.category}>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setSubcategory("");
          }}
        >
          {state.categories
            .filter((c) => (state.categoryMeta[c]?.type || "expense") === type)
            .map((c) => (
              <option key={c} value={c}>
                {resolveCategoryDisplayName(c, lang)}
              </option>
            ))}
        </select>
      </Field>

      <Field label={t.subcategory}>
        <select
          value={subcategory}
          onChange={(event) => setSubcategory(event.target.value)}
        >
          <option value="">-</option>
          {(state.categoryMeta[category]?.children || []).map((child) => (
            <option key={child} value={child}>
              {child}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.wallet}>
        <select value={wallet} onChange={(e) => setWallet(e.target.value)}>
          {state.wallets.filter(w => !existing?.fixedExpenseId || w.currency === state.wallets.find(original => original.id === existing.wallet)?.currency).map((w) => (
            <option value={w.id} key={w.id}>
              {resolveWalletDisplayName(w.name, lang)}
            </option>
          ))}
        </select>
      </Field>

      <Field label={recurring ? t.nextScheduledDate : t.date}>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>

      {recurring && (
        <div className="r-date-cycle">
          <Field label={t.recurringInterval}>
            <input
              type="number"
              min="1"
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
              required
            />
          </Field>
          <select
            aria-label={t.timeUnit}
            value={normalizeRecurringUnit(unit)}
            onChange={(event) => setUnit(event.target.value)}
          >
            {t.recurringUnits.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <textarea
        aria-label={t.note}
        placeholder={t.note}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />

      {!recurring && (
        <label className="r-attachment">
          {t.attachedImage}
          <input
            aria-label={t.attach}
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImage(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
          {(image || (!id && state.receiptDraft)) && <span>{t.attached}</span>}
        </label>
      )}

      <div className="r-two-options">
        {recurring && (
          <button type="button" className="r-secondary" onClick={back}>
            {t.cancel}
          </button>
        )}
        <button type="submit" className="r-primary">
          {recurring ? t.confirm : t.save}
        </button>
      </div>

      {existing && (
        <button
          type="button"
          className="r-danger"
          onClick={() => setConfirmDelete(true)}
        >
          {t.deleteTransaction}
        </button>
      )}
    </form>
  );

  if (recurring) return content;

  return (
    <div className="r-form-page">
      <PageHeader
        title={existing ? t.editTransaction : t.addTransaction}
        subtitle={existing ? t.editTransactionSubtitle : t.addTransactionSubtitle}
        close
        onBack={back}
      />
      {content}
      {confirmDelete && (
        <Modal title={t.deleteConfirmTitle} onClose={() => setConfirmDelete(false)}>
          <p>{t.deleteConfirmMessage}</p>
          <button
            className="r-danger"
            onClick={() => {
              updateState((s) => ({
                ...s,
                transactions: s.transactions.filter((t) => t.id !== id),
              }));
              back();
            }}
          >
            {t.deleteTransaction}
          </button>
        </Modal>
      )}
    </div>
  );
}

export function ChatPage({ navigate }: { navigate: (screen: string) => void }) {
  const uiText = useAppUiText();
  const state = useAppState();
  const categoryFlowCopy = CATEGORY_FLOW_COPY[resolveLanguage(state.settings.language)];
  const categoryCommandCopy = categoryOperationCopy[resolveLanguage(state.settings.language)];
  const serviceCopy = finnChatCopy[resolveLanguage(state.settings.language)];
  const chatKey = `finbridge:transaction-chat:${workspaceOwner() || "demo"}`;
  const [text, setText] = useState("");
  const [wallet, setWallet] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: serviceCopy.greeting }]);
  const conversationLanguage = useConversationLanguage(messages.flatMap(message => [message.text, message.scenarioExplanation || ""]), resolveLanguage(state.settings.language), workspaceOwner(), [...state.wallets.map(wallet => wallet.name), ...state.categories, ...state.goals.map(goal => goal.title), ...(state.fixedExpenses || []).map(expense => expense.title)]);
  const translationCopy = CONVERSATION_TRANSLATION_COPY[resolveLanguage(state.settings.language)];
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const latestDrafts = useRef<TransactionDraft[]>([]);
  useEffect(() => { latestDrafts.current = drafts; }, [drafts]);
  const [clarifyingDraftId, setClarifyingDraftId] = useState<string | null>(null);
  const [focusedDraftId, setFocusedDraftId] = useState<string | null>(null);
  const [referencedCategories, setReferencedCategories] = useState<string[]>([]);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [receiptImageUrls, setReceiptImageUrls] = useState<Record<string, string>>({});
  const [failedReceiptFile, setFailedReceiptFile] = useState<File | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryFormDraftId, setCategoryFormDraftId] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const workspaceCreationLock = useRef(false);
  const lastWorkspaceRequest = useRef<{ owner: string | null; message: string; id: string; failed: boolean } | null>(null);
  const [categoryBusy, setCategoryBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modal, setModal] = useState("");
  const [rule, setRule] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const recorderStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const aiRequestLock = useRef(false);
  const conversationGeneration = useRef(0);
  const transferRequestLock = useRef(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const activeChatRequest = useRef<AbortController | null>(null);
  const categoryOperationLock = useRef(false);
  const draftCommitLock = useRef(false);
  const draftCommitSnapshot = useRef<AppState | null>(null);
  const [uncertainDraftIds, setUncertainDraftIds] = useState<string[]>([]);
  const lastSubmission = useRef<{ owner: string | null; message: string; batchId: string; failed: boolean } | null>(null);
  const close = () => { recorder.current?.stop(); setListening(false); setModal(""); };
  useEffect(() => () => {
    if (recordingTimer.current) clearTimeout(recordingTimer.current);
    const activeRecorder = recorder.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      activeRecorder.stop();
    }
    recorderStream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    let cancelled = false;
    let messagesToRestore: ChatMessage[] | null = null;
    let draftsToRestore: TransactionDraft[] | null = null;
    let clarifyingDraftIdToRestore: string | null = null;
    try {
      const raw = state.transactionChat || workspacePersistence() === "database" ? null : localStorage.getItem(chatKey);
      const saved = state.transactionChat || (raw ? JSON.parse(raw) as { messages?: ChatMessage[]; drafts?: TransactionDraft[]; clarifyingDraftId?: string | null; referencedCategories?: string[] } : null);
      if (saved) {
        if (Array.isArray(saved.messages) && Array.isArray(saved.drafts)) {
          const checkedSaved = saved.drafts.filter(draft => !state.transactions.some(transaction => transaction.id === draft.id)).map((draft) => validateDraftForState(draft, state));
          const blockedDrafts = checkedSaved.filter(draft => !hasCompatibleDraftWallet(draft, state.wallets));
          const blockedIds = new Set(blockedDrafts.map(draft => draft.id));
          const restoredDrafts = checkedSaved.filter(draft => !blockedIds.has(draft.id));
          const unresolved = restoredDrafts.filter((draft) => draft.needsReview.length > 0);
          const needsWalletChoice = new Set(restoredDrafts.filter((draft) => draft.needsReview.includes("wallet")).map((draft) => draft.id));
          const labels: Record<string, string> = { amount: "số tiền", type: "khoản thu hay chi", category: "danh mục", date: "ngày giao dịch", wallet: "ví hoặc tiền tệ" };
          const unresolvedLabels = [...new Set(unresolved.flatMap((draft) => draft.needsReview))].map((field) => labels[field] || field);
          const restoredMessages = saved.messages.map((originalMessage) => {
            let message = { ...originalMessage, text: originalMessage.role === "assistant" && originalMessage.text === "Xin chào!👋 Hãy mô tả giao dịch; tôi sẽ tạo bản nháp để bạn kiểm tra trước khi lưu." ? "Xin chào!👋 Hãy mô tả giao dịch; Finn sẽ tạo bản nháp để bạn kiểm tra trước khi lưu." : originalMessage.text };
            if (message.workspaceProposal?.status === "saving") message = { ...message, workspaceProposal: { ...message.workspaceProposal, status: "failed" } };
            if (message.planningDeletion?.status === "saving") message = { ...message, planningDeletion: { ...message.planningDeletion, status: "failed" } };
            if (message.categoryOperation?.status === "saving") message = { ...message, categoryOperation: { ...message.categoryOperation, status: "failed" } };
            if (message.transactionDeletion?.status === "saving") message = { ...message, transactionDeletion: { ...message.transactionDeletion, status: "failed" } };
            const blockedReferences = [...(message.draftIds || []), ...(message.walletChoiceDraftIds || []), ...(message.categoryChoiceDraftIds || [])].filter(id => blockedIds.has(id));
            if (blockedReferences.length) {
              message.draftIds = message.draftIds?.filter(id => !blockedIds.has(id));
              message.walletChoiceDraftIds = message.walletChoiceDraftIds?.filter(id => !blockedIds.has(id));
              message.categoryChoiceDraftIds = message.categoryChoiceDraftIds?.filter(id => !blockedIds.has(id));
              if (!message.draftIds?.length && !message.walletChoiceDraftIds?.length && !message.categoryChoiceDraftIds?.length) {
                message.text = unavailableWalletReply(blockedDrafts.filter(draft => blockedReferences.includes(draft.id)).map(draft => draft.currency), resolveLanguage(state.settings.language));
              }
            }
            const movedToWalletChoice = message.draftIds?.filter((id) => needsWalletChoice.has(id)) || [];
            if (message.role !== "assistant" || !movedToWalletChoice.length) return message.role === "assistant" && /chưa xác định được/i.test(message.text) ? { ...message, draftIds: undefined } : message;
            const remainingDraftIds = message.draftIds?.filter((id) => !needsWalletChoice.has(id));
            return { ...message, draftIds: remainingDraftIds?.length ? remainingDraftIds : undefined, walletChoiceDraftIds: [...new Set([...(message.walletChoiceDraftIds || []), ...movedToWalletChoice])], text: "Chọn ví để tiếp tục tạo bản nháp cho giao dịch này." };
          });
          const promptedWalletIds = new Set(restoredMessages.flatMap((message) => message.walletChoiceDraftIds || []));
          const unpromptedWalletIds = [...needsWalletChoice].filter((id) => !promptedWalletIds.has(id));
          if (unpromptedWalletIds.length) restoredMessages.push({ role: "assistant", text: "Bạn muốn ghi giao dịch này vào ví nào? Chọn ví bên dưới để tiếp tục.", walletChoiceDraftIds: unpromptedWalletIds });
          const promptedCategoryIds = new Set(restoredMessages.flatMap((message) => message.categoryChoiceDraftIds || []));
          const unpromptedCategoryIds = unresolved.filter((draft) => draft.needsReview.includes("category") && !!draft.type).map((draft) => draft.id).filter((id) => !promptedCategoryIds.has(id));
          if (unpromptedCategoryIds.length) {
            const prompt = [...restoredMessages].reverse().find((message) => message.role === "assistant" && message.draftIds?.some((id) => unpromptedCategoryIds.includes(id)));
            if (prompt) prompt.categoryChoiceDraftIds = [...new Set([...(prompt.categoryChoiceDraftIds || []), ...unpromptedCategoryIds])];
            else restoredMessages.push({ role: "assistant", text: "Chọn danh mục phù hợp cho giao dịch bên dưới hoặc tạo danh mục mới.", draftIds: unpromptedCategoryIds, categoryChoiceDraftIds: unpromptedCategoryIds });
          }
          const alreadyAsked = restoredMessages.some((message) => message.role === "assistant" && /chưa xác định được/i.test(message.text) && unresolvedLabels.every((label) => message.text.includes(label)))
            || restoredMessages.some((message) => message.walletChoiceDraftIds?.some((id) => unresolved.some((draft) => draft.id === id)) || message.categoryChoiceDraftIds?.some((id) => unresolved.some((draft) => draft.id === id)));
          for (let index = 0; index < restoredMessages.length - 1; index++) {
            const question = restoredMessages[index];
            const oldError = restoredMessages[index + 1];
            if (question.role !== "user" || oldError.role !== "assistant" || !/AI trả về dữ liệu chưa hợp lệ/i.test(oldError.text)) continue;
            const recoveredAnswer = getBalanceAnswer(question.text, state, wallet);
            if (recoveredAnswer) restoredMessages[index + 1] = { ...oldError, text: recoveredAnswer };
          }
          messagesToRestore = alreadyAsked || !unresolved.length ? restoredMessages : [...restoredMessages, {
            role: "assistant",
            text: clarificationQuestion([...new Set(unresolved.flatMap((draft) => draft.needsReview))]),
          }];
          draftsToRestore = restoredDrafts;
          clarifyingDraftIdToRestore = needsWalletChoice.size ? null : saved.clarifyingDraftId && unresolved.some((draft) => draft.id === saved.clarifyingDraftId) ? saved.clarifyingDraftId : unresolved[0]?.id || null;
        }
      }
    } catch { /* Ignore a damaged chat snapshot; the financial workspace is stored separately. */ }
    queueMicrotask(() => {
      if (cancelled) return;
      if (messagesToRestore) setMessages(messagesToRestore);
      if (draftsToRestore) setDrafts(draftsToRestore);
      if (state.transactionChat?.referencedCategories) setReferencedCategories(state.transactionChat.referencedCategories.filter(name => state.categories.includes(name)));
      if (state.transactionChat?.activeDraftId && draftsToRestore?.some(d => d.id === state.transactionChat?.activeDraftId)) setFocusedDraftId(state.transactionChat.activeDraftId);
      if (clarifyingDraftIdToRestore !== null) setClarifyingDraftId(clarifyingDraftIdToRestore);
      setSessionLoaded(true);
    });
    return () => { cancelled = true; };
  // Load once for the current signed-in workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);
  useEffect(() => {
    if (!sessionLoaded) return;
    const transactionChat = { messages, drafts, clarifyingDraftId, activeDraftId: focusedDraftId, referencedCategories };
    try { updateState((current) => ({ ...current, transactionChat })); } catch { /* Chat remains usable if workspace storage is unavailable. */ }
  }, [sessionLoaded, messages, drafts, clarifyingDraftId, focusedDraftId, referencedCategories]);
  useEffect(() => {
    if (!sessionLoaded) return;
    const container = messagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length, sessionLoaded]);
  function resetConversation() {
    if (transferRequestLock.current || messages.some(m => m.transfer?.uncertain || m.transfer?.status === "saving")) return;
    if (committing || categoryBusy || deletingId) return;
    if (uncertainDraftIds.length) { setModal(""); setMessages(previous => [...previous, { role: "assistant", text: workspaceSaveErrorMessage(null, resolveLanguage(state.settings.language)), draftIds: uncertainDraftIds }]); return; }
    conversationGeneration.current += 1;
    activeChatRequest.current?.abort(); activeChatRequest.current = null;
    aiRequestLock.current = false; setBusy(false);
    if (workspacePersistence() !== "database") localStorage.removeItem(chatKey);
    setReceiptImageUrls({});
    setFailedReceiptFile(null);
    setMessages([{ role: "assistant", text: serviceCopy.greeting }]);
    setDrafts([]); setReferencedCategories([]); setClarifyingDraftId(null); setFocusedDraftId(null); lastSubmission.current = null; setModal(""); setText("");
  }
  function cancelTransactionDeletion(confirmationId: string) {
    if (lockedDeletionConfirmations.has(confirmationId)) return;
    lockedDeletionConfirmations.add(confirmationId);
    setMessages((previous) => previous.map((message) => message.transactionDeletion?.confirmationId === confirmationId
      ? { ...message, transactionDeletion: { ...message.transactionDeletion, status: "cancelled" } }
      : message));
  }
  function selectTransactionForDeletion(confirmationId: string, transactionId: string, selected: boolean) {
    if (lockedDeletionConfirmations.has(confirmationId)) return;
    setMessages((previous) => previous.map((message) => {
      const deletion = message.transactionDeletion;
      if (deletion?.confirmationId !== confirmationId || deletion.status !== "pending") return message;
      const selectedIds = new Set(deletion.selectedIds);
      if (selected) selectedIds.add(transactionId); else selectedIds.delete(transactionId);
      return { ...message, transactionDeletion: { ...deletion, selectedIds: [...selectedIds] } };
    }));
  }
  async function confirmTransactionDeletion(confirmationId: string) {
    if (lockedDeletionConfirmations.has(confirmationId)) return;
    const confirmation = messages.find(m => m.transactionDeletion?.confirmationId === confirmationId)?.transactionDeletion;
    if (!confirmation || !["pending", "failed"].includes(confirmation.status) || !confirmation.selectedIds.length) return;
    lockedDeletionConfirmations.add(confirmationId);
    setDeletingId(confirmationId);
    const owner = workspaceOwner();
    let appliedIds = confirmation.appliedIds;
    const mark = (status: "saving" | "confirmed" | "failed") => setMessages(previous => previous.map(m => m.transactionDeletion?.confirmationId === confirmationId
      ? { ...m, transactionDeletion: { ...m.transactionDeletion, status, appliedIds, deletedCount: appliedIds?.length } } : m));
    try {
      if (!appliedIds) {
        const selectedIds = new Set(confirmation.selectedIds);
        updateState(current => {
          if (!owner || workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          appliedIds = current.transactions.filter(t => selectedIds.has(t.id)).map(t => t.id);
          return { ...current, transactions: current.transactions.filter(t => !selectedIds.has(t.id)),
            transactionChat: current.transactionChat && { ...current.transactionChat, messages: current.transactionChat.messages.map(m => m.transactionDeletion?.confirmationId === confirmationId
              ? { ...m, transactionDeletion: { ...m.transactionDeletion, status: "saving", appliedIds } } : m) } };
        });
      }
      mark("saving");
      await flushWorkspace(true);
      if (workspaceOwner() !== owner) return;
      mark("confirmed");
      const deletedCount = appliedIds?.length || 0;
      setMessages(previous => [...previous, { role: "assistant", text: deletedCount ? `Đã xóa ${deletedCount} giao dịch. Số dư và lịch sử đã được cập nhật.` : "Không có giao dịch nào bị xóa vì các mục này không còn trong dữ liệu.", localOnly: true }]);
    } catch {
      if (workspaceOwner() === owner) mark("failed");
      lockedDeletionConfirmations.delete(confirmationId);
    } finally { setDeletingId(null); }
  }
  function previewCategoryCommand(command: CategoryCommand) {
    try {
      const current = getWorkspaceState();
      const operation = prepareCategoryOperation(current, command, crypto.randomUUID());
      if (messages.some(m => m.categoryOperation?.status === "pending" && JSON.stringify(m.categoryOperation.command) === JSON.stringify(operation.command))) return;
      setReferencedCategories(command.sources);
      setMessages(previous => [...previous, { role: "assistant", text: categoryOperationDescription(operation, resolveLanguage(state.settings.language)), categoryOperation: operation, localOnly: true }]);
    } catch (error) {
      setMessages(previous => [...previous, { role: "assistant", text: categoryOperationError(error, resolveLanguage(state.settings.language)), categoryList: state.categories.filter(name => !state.categoryMeta[name]?.archived) }]);
    }
  }
  async function confirmCategoryCommand(id: string) {
    if (categoryOperationLock.current || busy) return;
    const operation = messages.find(m => m.categoryOperation?.id === id)?.categoryOperation;
    if (!operation || !["pending", "failed"].includes(operation.status)) return;
    categoryOperationLock.current = true;
    setCategoryBusy(true);
    const owner = workspaceOwner();
    let applied = !!operation.applied;
    const mark = (status: CategoryConfirmation["status"]) => setMessages(previous => previous.map(m => m.categoryOperation?.id === id ? { ...m, categoryOperation: { ...m.categoryOperation, status, applied } } : m));
    try {
      mark("saving");
      if (!applied) {
        updateState(current => {
          if (!owner || workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyCategoryOperation(current, { ...operation, status: "pending" });
          return { ...next, transactionChat: next.transactionChat && { ...next.transactionChat, messages: next.transactionChat.messages.map(m => m.categoryOperation?.id === id ? { ...m, categoryOperation: { ...m.categoryOperation, status: "saving", applied: true } } : m) } };
        });
        applied = true;
        mark("saving");
        const current = getWorkspaceState();
        setDrafts(previous => previous.map(d => validateDraftForState(current.transactionChat?.drafts.find(item => item.id === d.id) || d, current)));
        if (["rename_category", "merge_categories"].includes(operation.command.operation) && operation.command.target) {
          setMessages(previous => previous.map(m => renameCategoryMessageReferences(m, operation.command.sources, operation.command.target!)));
        }
        setReferencedCategories(operation.command.target ? [operation.command.target] : []);
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner) return;
      mark("confirmed");
    } catch (error) {
      if (workspaceOwner() !== owner) return;
      mark("failed");
      if (!applied) setMessages(previous => [...previous, { role: "assistant", text: categoryOperationError(error, resolveLanguage(state.settings.language)) }]);
    } finally { categoryOperationLock.current = false; setCategoryBusy(false); }
  }
  function markWorkspaceProposal(id: string, patch: Partial<WorkspaceProposal>) {
    setMessages(previous => previous.map(item => item.workspaceProposal?.id === id ? { ...item, workspaceProposal: { ...item.workspaceProposal, ...patch } } : item));
  }
  function markPlanningDeletion(id: string, patch: Partial<PlanningDeletion>) {
    setMessages(previous => previous.map(item => item.planningDeletion?.id === id ? { ...item, planningDeletion: { ...item.planningDeletion, ...patch } } : item));
  }
  function selectPlanningDeletion(id: string, targetId: string, selected: boolean) {
    if (busy || committing) return;
    setMessages(previous => previous.map(item => {
      const proposal = item.planningDeletion;
      if (proposal?.id !== id || proposal.applied || !["pending", "failed"].includes(proposal.status) || !proposal.targets.some(t => t.id === targetId)) return item;
      return { ...item, planningDeletion: { ...proposal, selectedIds: selected ? [...new Set([...proposal.selectedIds, targetId])] : proposal.selectedIds.filter(key => key !== targetId), error: undefined } };
    }));
  }
  function cancelPlanningDeletion(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(m => m.planningDeletion?.id === id)?.planningDeletion;
    if (!proposal || proposal.applied || !["pending", "failed"].includes(proposal.status)) return;
    markPlanningDeletion(id, { status: "cancelled", error: undefined });
  }
  async function confirmPlanningDeletion(id: string) {
    if (workspaceCreationLock.current || busy || committing || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(m => m.planningDeletion?.id === id)?.planningDeletion;
    if (!proposal || !["pending", "failed"].includes(proposal.status) || !proposal.selectedIds.length) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const t = planningDeletionCopy[resolveLanguage(state.settings.language)];
    let applied = !!proposal.applied;
    workspaceCreationLock.current = true; setCommitting(true); markPlanningDeletion(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyPlanningDeletion(current, proposal);
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.planningDeletion?.id === id ? { ...item, planningDeletion: { ...item.planningDeletion, status: "saving", applied: true } } : item) } };
        });
        applied = true; markPlanningDeletion(id, { applied: true, status: "saving" });
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markPlanningDeletion(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.saved }]);
    } catch (error) {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markPlanningDeletion(id, { status: "failed", applied, error: !applied && error instanceof Error && error.message === "PLANNING_DATA_CHANGED" ? t.stale : t.failed });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }
  function markFixedExpensePayment(id: string, patch: Partial<FixedExpensePaymentProposal>) {
    setMessages(previous => previous.map(item => item.fixedExpensePayment?.id === id ? { ...item, fixedExpensePayment: { ...item.fixedExpensePayment, ...patch } } : item));
  }
  function cancelFixedExpensePayment(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(m => m.fixedExpensePayment?.id === id)?.fixedExpensePayment;
    if (!proposal || proposal.applied || !["pending", "failed"].includes(proposal.status)) return;
    markFixedExpensePayment(id, { status: "cancelled", error: undefined });
  }
  async function confirmFixedExpensePayment(id: string) {
    if (workspaceCreationLock.current || busy || committing || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(m => m.fixedExpensePayment?.id === id)?.fixedExpensePayment;
    if (!proposal || !["pending", "failed"].includes(proposal.status)) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const t = fixedExpensePaymentCopy[resolveLanguage(state.settings.language)];
    let applied = !!proposal.applied;
    workspaceCreationLock.current = true; setCommitting(true); markFixedExpensePayment(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyFixedExpensePayment(current, proposal, today());
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.fixedExpensePayment?.id === id ? { ...item, fixedExpensePayment: { ...item.fixedExpensePayment, status: "saving", applied: true } } : item) } };
        });
        applied = true; markFixedExpensePayment(id, { applied: true, status: "saving" });
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markFixedExpensePayment(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.saved }]);
    } catch {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markFixedExpensePayment(id, { status: "failed", applied, error: t.failed });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }

  function markFixedExpenseStatus(id: string, patch: Partial<FixedExpenseStatusProposal>) {
    setMessages(previous => previous.map(item => item.fixedExpenseStatus?.id === id ? { ...item, fixedExpenseStatus: { ...item.fixedExpenseStatus, ...patch } } : item));
  }
  function cancelFixedExpenseStatus(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(m => m.fixedExpenseStatus?.id === id)?.fixedExpenseStatus;
    if (!proposal || proposal.applied || !["pending", "failed"].includes(proposal.status)) return;
    markFixedExpenseStatus(id, { status: "cancelled", error: undefined });
  }
  async function confirmFixedExpenseStatus(id: string) {
    if (workspaceCreationLock.current || busy || committing || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(m => m.fixedExpenseStatus?.id === id)?.fixedExpenseStatus;
    if (!proposal || !["pending", "failed"].includes(proposal.status)) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const t = fixedExpenseStatusCopy[resolveLanguage(state.settings.language)];
    let applied = !!proposal.applied;
    workspaceCreationLock.current = true; setCommitting(true); markFixedExpenseStatus(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyFixedExpenseStatus(current, proposal);
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.fixedExpenseStatus?.id === id ? { ...item, fixedExpenseStatus: { ...item.fixedExpenseStatus, status: "saving", applied: true } } : item) } };
        });
        applied = true; markFixedExpenseStatus(id, { applied: true, status: "saving" });
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markFixedExpenseStatus(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.saved }]);
    } catch {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markFixedExpenseStatus(id, { status: "failed", applied, error: t.failed });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }

  function markPlanningEdit(id: string, patch: Partial<PlanningEditProposal>) {
    setMessages(previous => previous.map(item => item.planningEdit?.id === id ? { ...item, planningEdit: { ...item.planningEdit, ...patch } } : item));
  }
  function cancelPlanningEdit(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(m => m.planningEdit?.id === id)?.planningEdit;
    if (!proposal || proposal.applied || !["pending", "failed"].includes(proposal.status)) return;
    markPlanningEdit(id, { status: "cancelled", error: undefined });
  }
  async function confirmPlanningEdit(id: string) {
    if (workspaceCreationLock.current || busy || committing || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(m => m.planningEdit?.id === id)?.planningEdit;
    if (!proposal || !["pending", "failed"].includes(proposal.status)) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const t = planningEditCopy[resolveLanguage(state.settings.language)];
    let applied = !!proposal.applied;
    workspaceCreationLock.current = true; setCommitting(true); markPlanningEdit(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyPlanningEdit(current, proposal);
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.planningEdit?.id === id ? { ...item, planningEdit: { ...item.planningEdit, status: "saving", applied: true } } : item) } };
        });
        applied = true; markPlanningEdit(id, { applied: true, status: "saving" });
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markPlanningEdit(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.saved }]);
    } catch {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markPlanningEdit(id, { status: "failed", applied, error: t.failed });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }

  function markSettingsAction(id: string, patch: Partial<SettingsActionProposal>) {
    setMessages(previous => previous.map(item => item.settingsAction?.id === id ? { ...item, settingsAction: { ...item.settingsAction, ...patch } } : item));
  }
  function cancelSettingsAction(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(m => m.settingsAction?.id === id)?.settingsAction;
    if (!proposal || proposal.applied || !["pending", "failed"].includes(proposal.status)) return;
    markSettingsAction(id, { status: "cancelled", error: undefined });
  }
  async function confirmSettingsAction(id: string) {
    if (workspaceCreationLock.current || busy || committing || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(m => m.settingsAction?.id === id)?.settingsAction;
    if (!proposal || !["pending", "failed"].includes(proposal.status)) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const t = settingsActionCopy[resolveLanguage(state.settings.language)];
    let applied = !!proposal.applied;
    workspaceCreationLock.current = true; setCommitting(true); markSettingsAction(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
          const next = applyWalletArchive(current, proposal);
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.settingsAction?.id === id ? { ...item, settingsAction: { ...item.settingsAction, status: "saving", applied: true } } : item) } };
        });
        applied = true; markSettingsAction(id, { applied: true, status: "saving" });
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markSettingsAction(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.savedArchive }]);
    } catch {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markSettingsAction(id, { status: "failed", applied, error: t.failed });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }
  function cancelWorkspaceProposal(id: string) {
    if (busy || committing) return;
    const proposal = [...messages].reverse().find(item => item.workspaceProposal?.id === id)?.workspaceProposal;
    if (!proposal || proposal.applied || !["collecting", "review", "failed"].includes(proposal.status)) return;
    markWorkspaceProposal(id, { status: "cancelled", error: undefined });
  }
  async function confirmWorkspaceProposal(id: string) {
    if (workspaceCreationLock.current || committing || busy || categoryBusy || deletingId) return;
    const proposal = [...messages].reverse().find(item => item.workspaceProposal?.id === id)?.workspaceProposal;
    if (!proposal || !["review", "failed"].includes(proposal.status)) return;
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const language = resolveLanguage(state.settings.language), t = workspaceActionCopy[language];
    workspaceCreationLock.current = true; setCommitting(true);
    let applied = !!proposal.applied;
    markWorkspaceProposal(id, { status: "saving", error: undefined });
    try {
      if (!applied) {
        await flushWorkspace(true);
        if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
        updateState(current => {
          const next = applyWorkspaceProposal(current, proposal, language);
          const chat = next.transactionChat || { messages, drafts, clarifyingDraftId, activeDraftId: focusedDraftId, referencedCategories };
          return { ...next, transactionChat: { ...chat, messages: chat.messages.map(item => item.workspaceProposal?.id === id ? { ...item, workspaceProposal: { ...item.workspaceProposal, status: "saving", applied: true } } : item) } };
        });
        applied = true;
        markWorkspaceProposal(id, { status: "saving", applied: true });
      } else {
        const current = getWorkspaceState();
        const inspection = inspectWorkspaceProposal(current, proposal, language);
        if (inspection.question || inspection.error || proposal.actions.some(action => !(action.kind === "wallet" ? current.wallets : action.kind === "budget" ? current.goals : current.fixedExpenses || []).some(item => item.id === action.id))) throw new Error(t.invalid);
      }
      await flushWorkspace(true);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      markWorkspaceProposal(id, { status: "confirmed", applied: true, error: undefined });
      setMessages(previous => [...previous, { role: "assistant", text: t.saved }]);
    } catch (error) {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) markWorkspaceProposal(id, { status: "failed", applied, error: applied ? t.failed : error instanceof Error ? error.message.slice(0, 500) : t.invalid });
    } finally { workspaceCreationLock.current = false; setCommitting(false); }
  }
  async function requestWorkspaceCreation(message: string, choice?: { operationId: string; field: ActionField; value: string | number }, alreadyAppended = false): Promise<boolean> {
    if (!alreadyAppended && (busy || aiRequestLock.current || committing || categoryBusy || deletingId)) return true;
    const pending = [...messages].reverse().find(item => item.workspaceProposal && ["collecting", "review", "failed"].includes(item.workspaceProposal.status) && !item.workspaceProposal.applied)?.workspaceProposal || null;
    const language = resolveLanguage(state.settings.language), t = workspaceActionCopy[language];
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const controller = new AbortController(); activeChatRequest.current = controller;
    const previous = lastWorkspaceRequest.current;
    const batchId = pending?.id || (previous?.failed && previous.owner === owner && previous.message === message ? previous.id : crypto.randomUUID());
    lastWorkspaceRequest.current = { owner, message, id: batchId, failed: false };
    let validationMessage: string | null = null;
    setBusy(true); aiRequestLock.current = true;
    try {
      await flushWorkspaceForAnalysis();
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return true;
      const snapshot = getWorkspaceState();
      const response = await fetch("/api/ai/workspace-actions", { method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": owner || "", "x-finbridge-language": language },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        body: JSON.stringify({ batchId, message, language, today: today(), pending, history: modelHistory(messages).slice(-8), ...(choice ? { choice } : {}),
          ...(workspacePersistence() === "browser" ? { context: { wallets: snapshot.wallets, goals: snapshot.goals, fixedExpenses: snapshot.fixedExpenses || [], categories: snapshot.categories, categoryMeta: snapshot.categoryMeta, ...(snapshot.walletCategories ? { walletCategories: snapshot.walletCategories } : {}) } } : {}) }),
      });
      const raw: unknown = await response.json().catch(() => null);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return true;
      const result = raw && typeof raw === "object" ? raw as { mode?: unknown; proposal?: unknown; reply?: unknown; message?: unknown } : null;
      if (!response.ok || !result) {
        const quotaMessage = aiQuotaClientMessage(raw, language);
        if (quotaMessage) { validationMessage = quotaMessage; throw new Error(quotaMessage); }
        if (response.status === 422 && typeof result?.message === "string") validationMessage = result.message;
        throw new Error(result?.message === t.invalid ? t.invalid : t.unavailable);
      }
      if (result.mode === "unrelated") { lastWorkspaceRequest.current = null; return false; }
      if (result.mode === "cancel") {
        if (pending) markWorkspaceProposal(pending.id, { status: "cancelled", error: undefined });
        setText(""); setMessages(previous => [...previous, ...(!alreadyAppended ? [{ role: "user" as const, text: message }] : []), { role: "assistant", text: t.cancelled }]);
        return true;
      }
      const parsed = workspaceProposalSchema.safeParse(result.proposal);
      if (!parsed.success || (pending && parsed.data.id !== pending.id) || !["collecting", "review"].includes(parsed.data.status)) throw new Error(t.unavailable);
      const proposal = parsed.data;
      setText(""); lastWorkspaceRequest.current = null;
      setMessages(previous => [...previous, ...(!alreadyAppended ? [{ role: "user" as const, text: message }] : []), { role: "assistant", text: typeof result.reply === "string" ? result.reply : t.ready, workspaceProposal: proposal }]);
      return true;
    } catch (error) {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) {
        lastWorkspaceRequest.current = { owner, message, id: batchId, failed: true };
        setText(message);
        setMessages(previous => [...previous, ...(!alreadyAppended ? [{ role: "user" as const, text: message }] : []), { role: "assistant", text: validationMessage || (error instanceof Error && error.message === t.invalid ? t.invalid : t.unavailable) }]);
      }
      return true;
    } finally {
      if (conversationGeneration.current === generation && workspaceOwner() === owner) { setBusy(false); aiRequestLock.current = false; activeChatRequest.current = null; }
    }
  }

  function handleCreateWorkspaceCategory(name: string, operationId: string): string | null {
    const trimmed = name.trim();
    if (!trimmed || !isValidDraftCategoryName(trimmed)) {
      return categoryFlowCopy.invalid;
    }
    const existing = state.categories.find(c => normalizeVietnameseMessage(c) === normalizeVietnameseMessage(trimmed));
    if (existing) {
      if (state.categoryMeta[existing]?.archived) return categoryCommandCopy.unavailable;
      if ((state.categoryMeta[existing]?.type || "expense") !== "expense") return categoryFlowCopy.wrongType;
      void requestWorkspaceCreation(existing, { operationId, field: "category", value: existing });
      return null;
    }
    try {
      const op = prepareCategoryOperation(state, {
        operation: "create_category",
        sources: [],
        target: trimmed,
        type: "expense",
      }, crypto.randomUUID());
      updateState(s => applyCategoryOperation(s, op));
      void requestWorkspaceCreation(trimmed, { operationId, field: "category", value: trimmed });
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "CATEGORY_EXISTS") return categoryFlowCopy.similar;
      if (msg === "INVALID_CATEGORY_NAME") return categoryFlowCopy.invalid;
      return categoryFlowCopy.invalid;
    }
  }
  function updateTransfer(id: string, patch: Partial<TransferChatResult>) {
    setMessages(previous => previous.map(m => m.transfer?.id === id ? { ...m, transfer: { ...m.transfer, ...patch } } : m));
  }
  function cancelTransfer(result: TransferChatResult) {
    if (transferRequestLock.current || result.uncertain || !["review","failed"].includes(result.status)) return;
    updateTransfer(result.id, { status: "cancelled", text: transferChatCopy[resolveLanguage(state.settings.language)].cancelled, choices: [], write: undefined, error: undefined });
  }
  async function chooseTransfer(result: TransferChatResult, patch: Partial<TransferChatRequest>, label: string) {
    if (transferRequestLock.current || busy || committing || categoryBusy || deletingId || messages.some(m => m.transfer?.uncertain || m.transfer?.status === "saving")) return;
    transferRequestLock.current = true; setTransferBusy(true);
    const owner = workspaceOwner(), generation = conversationGeneration.current, language = resolveLanguage(state.settings.language);
    const current = () => workspaceOwner() === owner && conversationGeneration.current === generation;
    try {
      const response = await fetch("/api/ai/transfer-options", { method: "POST", headers: { "content-type": "application/json", "x-finbridge-workspace-owner": owner || "finbridge-local-demo" }, body: JSON.stringify({ id: crypto.randomUUID(), request: { ...result.request, ...patch }, language }), signal: AbortSignal.timeout(30000) });
      const body = await response.json();
      if (!current()) return;
      const parsed = transferChatResultSchema.safeParse(body.transfer);
      if (!response.ok || !parsed.success) throw new Error("UNAVAILABLE");
      // Replace an unsubmitted proposal when a choice revises it; never mutate.
      setMessages(previous => [...previous.map(m => m.transfer?.id === result.id && m.transfer.write && ["review","failed"].includes(m.transfer.status) ? { ...m, transfer: { ...m.transfer, status: "cancelled" as const, write: undefined, choices: [] } } : m), { role: "user", text: label }, { role: "assistant", text: "", transfer: parsed.data, localOnly: true }]);
    } catch { if (current()) updateTransfer(result.id, { error: transferChatCopy[language].unavailable }); }
    finally { transferRequestLock.current = false; if (current()) setTransferBusy(false); }
  }
  async function confirmTransfer(result: TransferChatResult) {
    if (transferRequestLock.current || busy || committing || categoryBusy || deletingId || !["review","failed"].includes(result.status)) return;
    if (messages.some(m => m.transfer?.id !== result.id && (m.transfer?.uncertain || m.transfer?.status === "saving"))) return;
    const parsed = transferChatWriteSchema.safeParse(result.write);
    if (!parsed.success) return;
    transferRequestLock.current = true; setTransferBusy(true);
    const owner = workspaceOwner(), generation = conversationGeneration.current, language = resolveLanguage(state.settings.language), t = transferChatCopy[language];
    const current = () => workspaceOwner() === owner && conversationGeneration.current === generation;
    updateTransfer(result.id, { status: "saving", error: undefined });
    let definitiveFailure = false;
    try {
      const endpoint = parsed.data.endpoint === "reference" ? "/api/international-transfers/reference" : "/api/international-transfers";
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-finbridge-workspace-owner": owner || "finbridge-local-demo" }, body: JSON.stringify(parsed.data.command), signal: AbortSignal.timeout(45000) });
      const body: unknown = await response.json();
      if (!current()) return;
      if (!response.ok) {
        // 5xx can occur after a commit. Keep the idempotency key for recovery.
        definitiveFailure = response.status < 500;
        const code = body && typeof body === "object" && "error" in body ? String(body.error) : "UNAVAILABLE";
        throw new Error(TRANSFER_COPY[language].errors[code as keyof typeof TRANSFER_COPY.en.errors] || t.unavailable);
      }
      const verified = transferChatWriteResult(result, body, language);
      updateTransfer(result.id, { ...verified, uncertain: false, error: undefined });
    } catch (error) {
      if (current()) updateTransfer(result.id, { status: "failed", uncertain: !!result.uncertain || !definitiveFailure, error: result.uncertain || !definitiveFailure ? ({vi:"Chưa xác định thao tác đã lưu hay chưa. Bấm thử lại cùng yêu cầu để kiểm tra, tránh tạo yêu cầu mới.",en:"The result is not confirmed. Retry this same request to recover safely instead of creating another.",zh:"结果尚未确认，请重试同一请求以安全恢复，避免重复创建。"}[language]) : error instanceof Error ? error.message : t.unavailable });
    } finally { transferRequestLock.current = false; if (current()) setTransferBusy(false); }
  }
  async function send(value: string, requestedDraftId?: string, categoryChoice?: CategoryChoice) {
    const message = value.trim();
    if (!message || busy || aiRequestLock.current || transferRequestLock.current || committing || categoryBusy || deletingId) return;
    const recentAssistant = [...messages].reverse().find(m => m.role === "assistant");
    const pendingTransfer = recentAssistant?.transfer;
    if (pendingTransfer?.write && ["review","failed"].includes(pendingTransfer.status)) {
      const reply = planningActionConfirmationReply(message);
      if (reply === "cancel") {
        if (pendingTransfer.uncertain) { updateTransfer(pendingTransfer.id, { error: ({vi:"Kết quả lần gửi trước chưa được xác định. Hãy thử lại cùng yêu cầu trước khi hủy để tránh bỏ sót thao tác đã lưu.",en:"The previous result is unknown. Retry the same request before cancelling so a saved action is not overlooked.",zh:"上次结果尚未确认，请先重试同一请求，再决定是否取消。"}[resolveLanguage(state.settings.language)]) }); return; }
        setText(""); setMessages(previous=>[...previous,{role:"user",text:message}]); cancelTransfer(pendingTransfer); return;
      }
      if (reply === "confirm") {
        if (pendingTransfer.acknowledgement) { updateTransfer(pendingTransfer.id,{error:transferChatCopy[resolveLanguage(state.settings.language)].acknowledge}); return; }
        setText(""); setMessages(previous=>[...previous,{role:"user",text:message}]); await confirmTransfer(pendingTransfer); return;
      }
    }
    const pendingPlanningDeletion = recentAssistant?.planningDeletion;
    if (pendingPlanningDeletion && ["pending", "failed"].includes(pendingPlanningDeletion.status)) {
      const reply = planningConfirmationReply(message);
      if (reply === "confirm" && pendingPlanningDeletion.selectedIds.length) {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmPlanningDeletion(pendingPlanningDeletion.id); return;
      }
      if (reply === "cancel") { setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); cancelPlanningDeletion(pendingPlanningDeletion.id); return; }
      const selection = planningSelectionReply(message, pendingPlanningDeletion);
      if (selection && !pendingPlanningDeletion.applied) {
        setText(""); setMessages(previous => [...previous.map(m => m.planningDeletion?.id === pendingPlanningDeletion.id ? { ...m, planningDeletion: { ...m.planningDeletion, status: "cancelled" as const } } : m), { role: "user", text: message }, { role: "assistant", text: planningDeletionCopy[resolveLanguage(state.settings.language)].review, planningDeletion: { ...pendingPlanningDeletion, id: crypto.randomUUID(), selectedIds: [selection], status: "pending" } }]); return;
      }
    }
    const pendingFixedExpensePayment = recentAssistant?.fixedExpensePayment;
    if (pendingFixedExpensePayment && ["pending", "failed"].includes(pendingFixedExpensePayment.status)) {
      const reply = planningActionConfirmationReply(message);
      if (reply === "confirm") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmFixedExpensePayment(pendingFixedExpensePayment.id); return;
      }
      if (reply === "cancel") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); cancelFixedExpensePayment(pendingFixedExpensePayment.id); return;
      }
    }
    const pendingFixedExpenseStatus = recentAssistant?.fixedExpenseStatus;
    if (pendingFixedExpenseStatus && ["pending", "failed"].includes(pendingFixedExpenseStatus.status)) {
      const reply = planningActionConfirmationReply(message);
      if (reply === "confirm") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmFixedExpenseStatus(pendingFixedExpenseStatus.id); return;
      }
      if (reply === "cancel") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); cancelFixedExpenseStatus(pendingFixedExpenseStatus.id); return;
      }
    }
    const pendingPlanningEdit = recentAssistant?.planningEdit;
    if (pendingPlanningEdit && ["pending", "failed"].includes(pendingPlanningEdit.status)) {
      const reply = planningActionConfirmationReply(message);
      if (reply === "confirm") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmPlanningEdit(pendingPlanningEdit.id); return;
      }
      if (reply === "cancel") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); cancelPlanningEdit(pendingPlanningEdit.id); return;
      }
    }
    const pendingSettingsAction = recentAssistant?.settingsAction;
    if (pendingSettingsAction && ["pending", "failed"].includes(pendingSettingsAction.status)) {
      const reply = planningActionConfirmationReply(message);
      if (reply === "confirm") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmSettingsAction(pendingSettingsAction.id); return;
      }
      if (reply === "cancel") {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); cancelSettingsAction(pendingSettingsAction.id); return;
      }
    }
    const currentLang = resolveLanguage(state.settings.language);
    if (!requestedDraftId && isFixedExpensePaymentMessage(message, state)) {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
      const { proposal, clarification } = prepareFixedExpensePayment(state, message, today(), crypto.randomUUID());
      if (proposal) {
        setMessages(previous => [...previous, { role: "assistant", text: fixedExpensePaymentCopy[currentLang].note, fixedExpensePayment: proposal, localOnly: true }]);
      } else {
        setMessages(previous => [...previous, { role: "assistant", text: clarification || fixedExpensePaymentCopy[currentLang].failed, localOnly: true }]);
      }
      return;
    }
    if (!requestedDraftId && isFixedExpenseStatusMessage(message, state)) {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
      const { proposal, clarification } = prepareFixedExpenseStatus(state, message, crypto.randomUUID());
      if (proposal) {
        setMessages(previous => [...previous, { role: "assistant", text: proposal.action === "pause" ? fixedExpenseStatusCopy[currentLang].pauseNote : fixedExpenseStatusCopy[currentLang].resumeNote, fixedExpenseStatus: proposal, localOnly: true }]);
      } else {
        setMessages(previous => [...previous, { role: "assistant", text: clarification || fixedExpenseStatusCopy[currentLang].failed, localOnly: true }]);
      }
      return;
    }
    if (!requestedDraftId && isPlanningEditMessage(message, state)) {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
      const { proposal, clarification } = preparePlanningEdit(state, message, crypto.randomUUID());
      if (proposal) {
        setMessages(previous => [...previous, { role: "assistant", text: planningEditCopy[currentLang].note, planningEdit: proposal, localOnly: true }]);
      } else {
        setMessages(previous => [...previous, { role: "assistant", text: clarification || planningEditCopy[currentLang].failed, localOnly: true }]);
      }
      return;
    }
    if (!requestedDraftId) {
      const targetTheme = isSettingsThemeMessage(message);
      if (targetTheme) {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
        setSetting("theme", targetTheme);
        const reply = targetTheme === "dark" ? settingsActionCopy[currentLang].themeDark : settingsActionCopy[currentLang].themeLight;
        setMessages(previous => [...previous, { role: "assistant", text: reply, localOnly: true }]);
        return;
      }
      const targetLang = isSettingsLanguageMessage(message);
      if (targetLang) {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
        setSetting("language", LANGUAGE_LABELS[targetLang]);
        const reply = targetLang === "en" ? settingsActionCopy.en.langEn : targetLang === "zh" ? settingsActionCopy.zh.langZh : settingsActionCopy.vi.langVi;
        setMessages(previous => [...previous, { role: "assistant", text: reply, localOnly: true }]);
        return;
      }
      if (isSettingsWalletArchiveMessage(message, state)) {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
        const { proposal, clarification } = prepareWalletArchive(state, message, crypto.randomUUID());
        if (proposal) {
          setMessages(previous => [...previous, { role: "assistant", text: "", settingsAction: proposal, localOnly: true }]);
        } else {
          setMessages(previous => [...previous, { role: "assistant", text: clarification || settingsActionCopy[currentLang].failed, localOnly: true }]);
        }
        return;
      }
      const normMsg = normalizeVietnameseMessage(message);
      const relOrder = detectRelativeOrder(message);
      if (workspacePersistence() === "browser" && relOrder && /\b(?:xoa|huy|bo|delete|remove)\b/i.test(normMsg)) {
        setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
        const term = cleanDeletionSearchTerm(message);
        const matches = findTransactionsForDeletion(state.transactions, {
          scope: "matching",
          amount: null,
          walletId: null,
          periodStart: null,
          periodEnd: null,
          category: null,
          searchTerm: term,
          type: null,
          relativeOrder: relOrder,
        });
        if (!matches.length) {
          setMessages(previous => [...previous, { role: "assistant", text: "Hiện chưa có giao dịch nào để xóa.", localOnly: true }]);
          return;
        }
        const targetId = matches[0].id;
        setMessages(previous => [...previous, {
          role: "assistant",
          text: `Mình tìm thấy 1 giao dịch khớp yêu cầu. Hãy chọn đúng giao dịch cần xóa rồi xác nhận; hiện chưa giao dịch nào bị xóa.`,
          transactionDeletion: {
            confirmationId: crypto.randomUUID(),
            transactionIds: [targetId],
            selectedIds: [targetId],
            scope: "matching",
            status: "pending",
          },
          localOnly: true,
        }]);
        return;
      }
    }
    const outstanding = latestDrafts.current;
    if (!requestedDraftId && outstanding.length === 1 && /^(?:(?:huy|bo)(?:\s+(?:ban nhap|giao dich nay|giao dich do))?|cancel(?:\s+(?:draft|this draft))?|取消(?:草稿)?)[.!\s]*$/i.test(normalizeVietnameseMessage(message))) {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); removeDraft(outstanding[0].id); return;
    }
    if (!requestedDraftId && outstanding.length === 1 && /^(?:xac nhan(?:\s+luu)?|dong y|confirm|yes|确认)[.!\s]*$/i.test(normalizeVietnameseMessage(message))) {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]); await confirmDrafts([outstanding[0].id]); return;
    }
    if (!requestedDraftId && !explicitPlanningDeletion(message, state) && shouldBlockNewDraft(message, outstanding)) {
      setMessages(previous => [...previous, { role: "user", text: message }, pendingDraftInterruption(message, outstanding, resolveLanguage(state.settings.language))]);
      setText(message); return;
    }
    const pendingWorkspace = [...messages].reverse().find(item => item.workspaceProposal && ["collecting", "review", "failed"].includes(item.workspaceProposal.status) && !item.workspaceProposal.applied)?.workspaceProposal;
    const lastAssistantForConfirmation = [...messages].reverse().find(item => item.role === "assistant");
    if (pendingWorkspace && lastAssistantForConfirmation?.workspaceProposal?.id === pendingWorkspace.id && /^(?:xác nhận(?: tạo)?|đồng ý|đúng rồi|có|ok|confirm|yes|确认|同意)[.!\s]*$/i.test(message) && pendingWorkspace.status === "review") {
      setText(""); setMessages(previous => [...previous, { role: "user", text: message }]);
      await confirmWorkspaceProposal(pendingWorkspace.id); return;
    }
    if (!requestedDraftId && !explicitPlanningDeletion(message, state) && (isWorkspaceCreationRequest(message) || pendingWorkspace)) {
      if (await requestWorkspaceCreation(message)) return;
    }
    const pendingDrafts = drafts.filter(d => !state.transactions.some(t => t.id === d.id));
    const explicitlyNew = isClearlyNewTransaction(message, state);
    const categoryManagement = isCategoryManagementMessage(message);
    const deletionRequest = !categoryManagement && /\b(?:xoa|delete|remove|clear)\b/.test(normalizeVietnameseMessage(message));
    const target = explicitlyNew ? null : resolvePendingDraft(message, pendingDrafts, null, requestedDraftId || focusedDraftId || (pendingDrafts.length === 1 ? clarifyingDraftId : null));
    const activeDraftId = target?.id || null;
    const activeDraft = target || undefined;
    const appendUser = () => { setText(""); if (!requestedDraftId) setMessages(previous => [...previous, { role: "user", text: message }]); };
    if (explicitlyNew) {
      const currency = resolveUniqueCurrencyWallet(message, state.wallets.filter(item => !item.archived)).currency;
      if (!hasCompatibleDraftWallet({ currency }, state.wallets)) {
        appendUser();
        setMessages(previous => [...previous, { role: "assistant", text: unavailableWalletReply([currency], resolveLanguage(state.settings.language)) }]);
        return;
      }
    }
    const previousAssistant = [...messages].reverse().find(item => item.role === "assistant");
    const parsedSpendingPlan = spendingPlanOptionsSchema.safeParse(previousAssistant?.spendingPlan);
    const activeSpendingPlan = parsedSpendingPlan.success ? parsedSpendingPlan.data : null;
    if (activeSpendingPlan && asksForCalculationExplanation(message)) {
      appendUser();
      setMessages(previous => [...previous, { role: "assistant", text: "", spendingPlan: activeSpendingPlan, localOnly: true }]);
      return;
    }
    if (asksForCalculationExplanation(message) && previousAssistant?.scenarios?.length) {
      const snapshot = getWorkspaceState();
      const lang = resolveLanguage(snapshot.settings.language);
      try {
        const explanation = previousAssistant.scenarioExplanation || [
          { vi: "Tính lại theo dữ liệu hiện có:", en: "Recalculated from current data:", zh: "根据当前数据重新计算：" }[lang],
          ...previousAssistant.scenarios.map(scenario => scenarioCalculationExplanation(calculateScenario(snapshot, scenario, today()), scenario, snapshot.wallets, today(), lang)),
        ].join("\n\n");
        appendUser();
        setMessages(previous => [...previous, { role: "assistant", text: explanation, scenarioExplanation: explanation, scenarios: previousAssistant.scenarios, localOnly: true }]);
      } catch {
        appendUser();
        setMessages(previous => [...previous, { role: "assistant", text: serviceCopy.unavailable }]);
      }
      return;
    }
    const localCommand = localCategoryCommand(message, state.categories.filter(name => !state.categoryMeta[name]?.archived));
    if (localCommand && workspacePersistence() === "browser" && !recentAssistant?.categoryDialogue) {
      appendUser();
      if (localCommand === "list_categories") {
        const names = state.categories.filter(name => !state.categoryMeta[name]?.archived);
        setReferencedCategories([]);
        setMessages(previous => [...previous, { role: "assistant", text: names.length ? categoryFlowCopy.choose : categoryCommandCopy.empty, categoryList: names, localOnly: true }]);
      } else previewCategoryCommand(localCommand);
      return;
    }
    const createName = requestedDraftCategory(message);
    const categoryReply = !recentAssistant?.categoryDialogue && !explicitlyNew && !deletionRequest && (!categoryManagement || !!createName) && (
      /^(?:chọn|chon|danh mục|category|use|select|choose)\s/i.test(message)
      || !!createName || pendingDrafts.some(d => state.categories.some(name => normalizeVietnameseMessage(name) === normalizeVietnameseMessage(message) && (state.categoryMeta[name]?.type || "expense") === d.type)));
    const correction = !categoryManagement && !deletionRequest && isDraftCorrection(message);
    if ((categoryReply || correction) && !activeDraft && pendingDrafts.length) {
      appendUser();
      setMessages(previous => [...previous, { role: "assistant", text: categoryCommandCopy.chooseDraft, draftTargetChoices: pendingDrafts.map(d => d.id), pendingFollowup: message }]);
      return;
    }
    if (categoryReply && activeDraft?.type && (!categoryManagement || activeDraft.needsReview.includes("category"))) {
      const existing = matchDraftCategoryAnswer(message, activeDraft, state);
      if (existing) { appendUser(); selectDraftCategory(activeDraft.id, existing); return; }
      if (createName) {
        const similar = similarDraftCategories(createName, state.categories.filter(name => !state.categoryMeta[name]?.archived && (state.categoryMeta[name]?.type || "expense") === activeDraft.type));
        appendUser();
        if (similar.length) {
          setMessages(previous => [...previous, { role: "assistant", text: categoryFlowCopy.similar, draftIds: [activeDraft.id], categoryChoiceDraftIds: [activeDraft.id] }]);
        } else if (assignNewCategory(activeDraft.id, createName)) {
          setMessages(previous => [...previous, { role: "assistant", text: `${categoryFlowCopy.pendingCategory} “${createName}” ${categoryFlowCopy.stillDraft}`, draftIds: [activeDraft.id], categoryChoiceDraftIds: [activeDraft.id] }]);
        }
        return;
      }
    }
    const amountCorrection = correction && activeDraft ? applyDraftAmountCorrection(drafts, activeDraft.id, message, state) : null;
    if (amountCorrection) {
      if (!hasCompatibleDraftWallet(amountCorrection.draft, state.wallets)) {
        appendUser();
        setDrafts(previous => removeDraftById(previous, amountCorrection.draft.id));
        setClarifyingDraftId(null); setFocusedDraftId(null);
        setMessages(previous => [...previous, { role: "assistant", text: unavailableWalletReply([amountCorrection.draft.currency], resolveLanguage(state.settings.language)) }]);
        return;
      }
      appendUser(); setDrafts(amountCorrection.drafts); setClarifyingDraftId(activeDraftId); setFocusedDraftId(activeDraftId);
      setMessages(previous => [...previous, { role: "assistant", text: `Đã cập nhật bản nháp “${amountCorrection.draft.title}”. Hãy kiểm tra rồi xác nhận.`, draftIds: [amountCorrection.draft.id] }]);
      return;
    }
    setText(""); setBusy(true); aiRequestLock.current = true;
    if (clarifyingDraftId && (!activeDraftId || isNewTransactionMessage(message))) setClarifyingDraftId(null);
    if (!requestedDraftId) setMessages((previous) => [...previous, { role: "user", text: message }]);
    const submissionOwner = workspaceOwner();
    const submissionGeneration = conversationGeneration.current;
    const requestController = new AbortController(); activeChatRequest.current = requestController;
    const previousSubmission = lastSubmission.current;
    const batchId = previousSubmission?.failed && previousSubmission.owner === submissionOwner && previousSubmission.message === message ? previousSubmission.batchId : crypto.randomUUID();
    lastSubmission.current = { owner: submissionOwner, message, batchId, failed: false };
    try {
      await flushWorkspaceForAnalysis();
      if (workspaceOwner() !== submissionOwner || conversationGeneration.current !== submissionGeneration) return;
      const activeWallets = state.wallets.filter((item) => !item.archived);
      const selectedWalletId = activeWallets.some((item) => item.id === wallet) ? wallet : activeWallets.length === 1 ? activeWallets[0].id : null;
      const response = await fetch("/api/ai/assistant", {
        signal: AbortSignal.any([AbortSignal.timeout(30_000), requestController.signal]),
        method: "POST",
        headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": submissionOwner || "", "x-finbridge-language": resolveLanguage(state.settings.language) },
        body: JSON.stringify({
          batchId,
          message,
          ...(recentAssistant?.categoryDialogue && recentAssistant.categoryDialogue.status !== "cancelled" ? {pendingCategory:recentAssistant.categoryDialogue.command} : {}),
          ...(categoryChoice ? {categoryChoice} : {}),
          today: today(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          selectedWalletId,
          ...(workspacePersistence() === "browser" ? { planningContext: { goals: state.goals, fixedExpenses: state.fixedExpenses || [] } } : {}),
          pendingDrafts: [...(activeDraft ? [activeDraft] : []), ...pendingDrafts.filter(d => d.id !== activeDraftId)].slice(0, 50),
          activeDraftId,
          referencedCategories,
          ...(activeSpendingPlan ? { spendingPlan: activeSpendingPlan } : {}),
          language: resolveLanguage(state.settings.language),
          ...(recentAssistant?.pendingScenario && assistantScenarioSchema.safeParse(recentAssistant.pendingScenario).success ? { pendingScenario: recentAssistant.pendingScenario } : {}),
          ...(recentAssistant?.transfer && recentAssistant.transfer.status !== "cancelled" ? { transferContext: recentAssistant.transfer.request } : {}),
          history: modelHistory([...messages, { role: "user" as const, text: message }]),
          wallets: state.wallets.filter((item) => !item.archived).map(({ id, name, currency }) => ({ id, name, currency })),
          categories: state.categories.flatMap((name) => {
            const type = state.categoryMeta[name]?.type || "expense";
            return type === "income" || type === "expense" ? [{ name, type, archived: !!state.categoryMeta[name]?.archived }] : [];
          }),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (workspaceOwner() !== submissionOwner || conversationGeneration.current !== submissionGeneration) return;
      if (!response.ok || !result || typeof result !== "object" || !Array.isArray((result as { drafts?: unknown }).drafts) || typeof (result as { intent?: unknown }).intent !== "string") {
        const apiError = result && typeof result === "object" && typeof (result as { message?: unknown }).message === "string" ? (result as { message: string }).message : serviceCopy.unavailable;
        throw new Error(apiError);
      }
      const returned = (result as { drafts: unknown[] }).drafts;
      const validShape = returned.every((item) => item && typeof item === "object" && typeof (item as TransactionDraft).id === "string" && typeof (item as TransactionDraft).title === "string" && Array.isArray((item as TransactionDraft).needsReview));
      if (!validShape || returned.length > 20) throw new Error("AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại.");
      const ai = result as { intent: string; operationIntent?: ConversationIntent; targetDraftId?: string | null; categoryOperation?: CategoryCommand | null; action?: string; actions?: FinancialAction[]; walletId?: string | null; scope?: "selected" | "all"; periodStart?: string | null; periodEnd?: string | null; category?: string | null; searchTerm?: string | null; transactionType?: "expense" | "income" | null; percentage?: number | null; financialAnswer?: string | null; reply?: string; deletion?: TransactionDeletionCriteria };
      if (ai.intent === "international_transfer") {
        const parsed = transferChatResultSchema.safeParse((result as { transfer?: unknown }).transfer);
        if (!parsed.success) throw new Error(serviceCopy.unavailable);
        // A lost reply never authorizes another write. Existing proposals keep their keys.
        setMessages(previous => [...previous, { role: "assistant", text: "", transfer: parsed.data, localOnly: true }]);
        return;
      }
      if (ai.operationIntent === "delete_budget" || ai.operationIntent === "delete_fixed_expense") {
        const parsed = planningDeletionSchema.safeParse((result as { planningDeletion?: unknown }).planningDeletion);
        if (!parsed.success) throw new Error(serviceCopy.unavailable);
        setMessages(previous => [...previous, { role: "assistant", text: parsed.data.targets.length ? "" : planningDeletionCopy[resolveLanguage(state.settings.language)].empty, ...(parsed.data.targets.length ? { planningDeletion: parsed.data } : {}) }]);
        return;
      }
      if (ai.operationIntent === "pay_fixed_expense" && (result as { fixedExpensePayment?: unknown }).fixedExpensePayment) {
        const parsed = fixedExpensePaymentProposalSchema.safeParse((result as { fixedExpensePayment?: unknown }).fixedExpensePayment);
        if (parsed.success) {
          setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", fixedExpensePayment: parsed.data }]);
          return;
        }
      }
      if ((ai.operationIntent === "pause_fixed_expense" || ai.operationIntent === "resume_fixed_expense") && (result as { fixedExpenseStatus?: unknown }).fixedExpenseStatus) {
        const parsed = fixedExpenseStatusProposalSchema.safeParse((result as { fixedExpenseStatus?: unknown }).fixedExpenseStatus);
        if (parsed.success) {
          setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", fixedExpenseStatus: parsed.data }]);
          return;
        }
      }
      if ((ai.operationIntent === "edit_budget" || ai.operationIntent === "edit_fixed_expense") && (result as { planningEdit?: unknown }).planningEdit) {
        const parsed = planningEditProposalSchema.safeParse((result as { planningEdit?: unknown }).planningEdit);
        if (parsed.success) {
          setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", planningEdit: parsed.data }]);
          return;
        }
      }
      if (ai.operationIntent === "settings_action" && (result as { settingsAction?: unknown }).settingsAction) {
        const parsed = settingsActionProposalSchema.safeParse((result as { settingsAction?: unknown }).settingsAction);
        if (parsed.success) {
          if (parsed.data.action === "theme" && parsed.data.theme) {
            setSetting("theme", parsed.data.theme);
            setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", localOnly: true }]);
            return;
          }
          if (parsed.data.action === "language" && parsed.data.language) {
            setSetting("language", LANGUAGE_LABELS[parsed.data.language]);
            setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", localOnly: true }]);
            return;
          }
          if (parsed.data.action === "archive_wallet") {
            setMessages(previous => [...previous, { role: "assistant", text: ai.reply || "", settingsAction: parsed.data }]);
            return;
          }
        }
      }
      if (shouldBlockNewDraft(message, latestDrafts.current, ai.intent)) {
        setMessages(previous => [...previous, pendingDraftInterruption(message, latestDrafts.current, resolveLanguage(state.settings.language))]);
        setText(message); return;
      }
      if (activeSpendingPlan) {
        const adjustment = spendingPlanAdjustmentSchema.safeParse((result as { planAdjustment?: unknown }).planAdjustment);
        const categoryReduction = ai.intent === "financial" && ai.action === "category_savings" && ai.percentage !== null && ai.percentage !== undefined
          ? { walletId: ai.walletId || null, currency: null, category: ai.category || null, percent: ai.percentage, reserve: null, reset: false } : null;
        if (adjustment.success || categoryReduction) {
          const next = resolveSpendingPlanAdjustment(getWorkspaceState(), activeSpendingPlan, adjustment.success ? adjustment.data : categoryReduction!);
          const lang = resolveLanguage(state.settings.language);
          const questions = {
            vi: { wallet: "Bạn muốn điều chỉnh kế hoạch cho ví nào? Chọn “Hỏi tiếp cho ví này” trên kế hoạch rồi gửi lại yêu cầu nhé.", currency: "Tiền tệ bạn nêu khác với ví. Bạn muốn dùng ví nào và giữ dự phòng bằng tiền tệ nào?", precision: "Số tiền dự phòng chưa đúng đơn vị nhỏ nhất của tiền tệ trong ví. Bạn nhập lại nhé.", category: "Bạn muốn giảm chi cho danh mục nào?" },
            en: { wallet: "Which wallet should this apply to? Choose “Follow up for this wallet” on the plan and resend your request.", currency: "The currency differs from the wallet. Which wallet and reserve currency do you mean?", precision: "The reserve amount has unsupported currency precision. Please update it.", category: "Which spending category should be reduced?" },
            zh: { wallet: "要调整哪个钱包？请在计划中选择“针对此钱包继续提问”，然后重新发送。", currency: "币种与钱包不一致，请明确钱包和备用金币种。", precision: "备用金精度不符合钱包币种，请重新输入。", category: "要减少哪个支出类别？" },
          }[lang];
          setMessages(previous => [...previous, next.options ? { role: "assistant", text: "", spendingPlan: next.options, localOnly: true } : { role: "assistant", text: questions[next.missing!], spendingPlan: activeSpendingPlan, localOnly: true }]);
          return;
        }
        if (ai.intent === "financial" && ["safe_daily_allowance", "explain"].includes(ai.action || "")) {
          setMessages(previous => [...previous, { role: "assistant", text: "", spendingPlan: activeSpendingPlan, localOnly: true }]);
          return;
        }
      }
      if (ai.operationIntent && ["create_wallet", "create_budget", "create_fixed_expense"].includes(ai.operationIntent)) {
        const extracted=workspaceProposalSchema.safeParse((result as {workspaceProposal?:unknown}).workspaceProposal);
        if (extracted.success && extracted.data.id===batchId && ["collecting","review"].includes(extracted.data.status) && !extracted.data.applied) {
          setMessages(previous=>[...previous,{role:"assistant",text:ai.reply || workspaceActionCopy[resolveLanguage(state.settings.language)].ready,workspaceProposal:extracted.data}]);
          return;
        }
        if (!await requestWorkspaceCreation(message, undefined, true)) setMessages(previous => [...previous, { role: "assistant", text: { vi: "Bạn muốn Finn tạo ví, ngân sách hay chi phí cố định?", en: "Would you like Finn to create a wallet, budget or fixed expense?", zh: "你想让 Finn 创建钱包、预算还是固定支出？" }[resolveLanguage(state.settings.language)] }]);
        return;
      }
      if (ai.operationIntent === "list_categories") {
        const names = workspacePersistence() === "browser" ? state.categories.filter(name => !state.categoryMeta[name]?.archived) : Array.isArray((result as {categoryList?:unknown}).categoryList) ? (result as {categoryList:string[]}).categoryList : [];
        setReferencedCategories([]);
        setMessages(previous => [...previous, { role: "assistant", text: names.length ? categoryFlowCopy.choose : categoryCommandCopy.empty, categoryList: names }]);
        return;
      }
      if (ai.operationIntent && ["create_category", "rename_category", "merge_categories", "delete_category"].includes(ai.operationIntent)) {
        const dialogue=categoryDialogueSchema.safeParse((result as {categoryDialogue?:unknown}).categoryDialogue);
        if (dialogue.success) setMessages(previous=>[...previous,{role:"assistant",text:[dialogue.data.error,dialogue.data.question].filter(Boolean).join(" "),categoryDialogue:dialogue.data,localOnly:true}]);
        else if (ai.categoryOperation) previewCategoryCommand(ai.categoryOperation);
        else setMessages(previous => [...previous, { role: "assistant", text: ai.reply?.trim() || categoryCommandCopy.invalid }]);
        return;
      }
      if (categoryManagement) {
        setMessages(previous => [...previous, { role: "assistant", text: categoryCommandCopy.invalid, categoryList: state.categories.filter(name => !state.categoryMeta[name]?.archived) }]);
        return;
      }
      if (ai.operationIntent === "simulate_financial_scenario") {
        const snapshot = getWorkspaceState();
        const input = { message, preferredLanguage: resolveLanguage(snapshot.settings.language), today: today(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", history: modelHistory(messages).slice(-6), selectedWalletId, context: scenarioContext(snapshot) };
        // The assistant already interpreted and validated the scenario in its one
        // provider call. Keep the legacy endpoint only for older responses.
        const embedded = result as { scenarioResponse?: NormalizedPlannerResponse | null; calculations?: ScenarioResult[] | null; baselines?: ScenarioResult[] | null; presentation?: unknown };
        let raw: unknown = embedded.scenarioResponse ? { ...embedded.scenarioResponse, calculations: embedded.calculations } : null;
        if (!raw) {
          const response = await fetch("/api/ai/scenario-planner", { method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": submissionOwner || "", "x-finbridge-language": input.preferredLanguage }, body: JSON.stringify(input), signal: AbortSignal.any([AbortSignal.timeout(35_000), requestController.signal]) });
          raw = await response.json().catch(() => null);
          if (!response.ok) throw new Error(aiQuotaClientMessage(raw, input.preferredLanguage) || serviceCopy.unavailable);
        }
        if (workspaceOwner() !== submissionOwner || conversationGeneration.current !== submissionGeneration) return;
        const plan = embedded.scenarioResponse || normalizePlannerResponse(raw, input);
        const presentation = answerPresentationSchema.safeParse(embedded.presentation);
        const explanations: string[] = [];
        const parts = plan.scenarios.map(scenario => {
          const serverCalculations = raw && typeof raw === "object" && "calculations" in raw && Array.isArray(raw.calculations) ? raw.calculations as ScenarioResult[] : [];
          const result = workspacePersistence() === "browser" ? calculateScenario(snapshot, scenario, input.today) : serverCalculations.find(c => c.scenarioId === scenario.id);
          if (!result || !Array.isArray(result.wallets) || result.wallets.some(w => !snapshot.wallets.some(wallet => wallet.id === w.walletId && wallet.currency === w.currency) || ![w.balanceNow, w.projectedBalance, w.shortfall].every(Number.isFinite))) throw new Error(serviceCopy.unavailable);
          explanations.push(scenarioCalculationExplanation(result, scenario, snapshot.wallets, input.today, input.preferredLanguage));
          const baseline = workspacePersistence() === "browser" ? calculateScenario(snapshot, { ...scenario, changes: [], spendingReductions: [], dailySpendingLimits: [] }, input.today) : embedded.baselines?.find(b => b.scenarioId === scenario.id);
          return scenarioAnswer(result, scenario, snapshot.wallets, input.today, input.preferredLanguage, baseline, presentation.success ? presentation.data : undefined);
        });
        setMessages(previous => [...previous, { role: "assistant", text: parts.length ? parts.join("\n\n") : plan.clarification || plan.reply || serviceCopy.unavailable, scenarios: plan.scenarios, ...(assistantScenarioSchema.safeParse((plan as {pendingScenario?:unknown}).pendingScenario).success ? {pendingScenario:assistantScenarioSchema.parse((plan as {pendingScenario?:unknown}).pendingScenario)} : {}), scenarioExplanation: explanations.length ? explanations.join("\n\n") : undefined, localOnly: true }]);
        return;
      }
      if (ai.intent === "delete_transactions") {
        const deletion = ai.deletion;
        if (!deletion || deletion.scope === "none") {
          setMessages((previous) => [...previous, { role: "assistant", text: "Bạn muốn xóa giao dịch nào? Hãy cho biết tên, số tiền, ngày hoặc danh mục; dữ liệu chưa bị thay đổi." }]);
          return;
        }
        const serverSelection=(result as {transactionSelection?:ReturnType<typeof transactionDeletionSelection>|null}).transactionSelection;
        const selection=workspacePersistence()==="browser" ? transactionDeletionSelection(state.transactions,deletion) : serverSelection;
        if (!selection || !Array.isArray(selection.ids) || !Array.isArray(selection.matchedIds) || !Array.isArray(selection.selectedIds)) throw new Error(serviceCopy.unavailable);
        const matches=state.transactions.filter(t=>selection.matchedIds.includes(t.id));
        const candidates=selection.ids.flatMap(id=>{const item=state.transactions.find(t=>t.id===id);return item?[item]:[];});
        if (!candidates.length) {
          setMessages((previous) => [...previous, { role: "assistant", text: deletion.scope === "all" && !state.transactions.length
            ? "Hiện chưa có giao dịch nào để xóa."
            : "Mình chưa tìm thấy giao dịch khớp yêu cầu. Hãy nêu rõ tên, số tiền, ngày hoặc danh mục; chưa có dữ liệu nào bị xóa." }]);
          return;
        }
        const ids = candidates.map((transaction) => transaction.id);
        const all = deletion.scope === "all" && deletion.amount === null && !deletion.walletId && !deletion.periodStart && !deletion.periodEnd && !deletion.category && !deletion.searchTerm && !deletion.type && !deletion.relativeOrder;
        const exactMatch = matches.length > 0;
        const selectedIds=selection.selectedIds.filter(id=>ids.includes(id));
        const text = selection.browse
          ? ({vi:`Bạn muốn xóa giao dịch nào? Chọn trong ${candidates.length} giao dịch gần đây bên dưới rồi xác nhận. Chưa có giao dịch nào được chọn hay bị xóa.`,en:`Which transaction should be deleted? Choose from the ${candidates.length} recent records below, then confirm. Nothing is selected or deleted yet.`,zh:`要删除哪笔交易？请从下方最近${candidates.length}笔记录中选择并确认，目前没有选中或删除任何交易。`}[resolveLanguage(state.settings.language)])
          : all
          ? `Bạn yêu cầu xóa toàn bộ ${candidates.length} giao dịch. Hãy kiểm tra danh sách và xác nhận bên dưới; hiện chưa giao dịch nào bị xóa.`
          : exactMatch
            ? `Mình tìm thấy ${matches.length} giao dịch khớp yêu cầu. Hãy chọn đúng giao dịch cần xóa rồi xác nhận; hiện chưa giao dịch nào bị xóa.`
            : `Mình chưa khớp được tên giao dịch, nhưng có ${candidates.length} giao dịch trong khoảng ngày bạn nói. Hãy chọn đúng giao dịch; chưa có dữ liệu nào bị xóa.`;
        setMessages((previous) => [...previous, { role: "assistant", text, transactionDeletion: {
          confirmationId: crypto.randomUUID(), transactionIds: ids, selectedIds, scope: all ? "all" : "matching", status: "pending",
        } }]);
        return;
      }
      if (ai.intent === "financial") {
        const allowedActions: FinancialAction[] = ["balance", "balance_after_obligation", "spending_summary", "category_breakdown", "top_category", "category_savings", "savings_advice", "transactions", "largest_transaction", "budget_status", "safe_daily_allowance", "upcoming_obligations", "goals", "spending_trend", "anomalies", "explain", "unknown"];
        const actions = (ai.actions || [ai.action]).filter((action): action is FinancialAction => allowedActions.includes(action as FinancialAction));
        const presentation = answerPresentationSchema.safeParse((result as { presentation?: unknown }).presentation);
        const localAnswer = answerFinancialQuery({
          action: allowedActions.includes(ai.action as FinancialAction) ? ai.action as FinancialAction : "unknown",
          actions,
          walletId: state.wallets.some((item) => item.id === ai.walletId && !item.archived) ? ai.walletId || null : null,
          scope: ai.scope === "all" ? "all" : "selected", periodStart: ai.periodStart || null, periodEnd: ai.periodEnd || null,
          category: state.categories.includes(ai.category || "") ? ai.category || null : null,
          searchTerm: ai.searchTerm || null, transactionType: ai.transactionType || null, percentage: ai.percentage,
        }, state, wallet, today(), presentation.success ? presentation.data : undefined);
        if (workspacePersistence() !== "browser" && typeof ai.financialAnswer !== "string") throw new Error(serviceCopy.unavailable);
        const answer = typeof ai.financialAnswer === "string" ? ai.financialAnswer : localAnswer;
        setClarifyingDraftId(activeDraftId);
        const serverEntities = planningReferencesSchema.safeParse((result as { financialEntities?: unknown }).financialEntities);
        const financialEntities: NonNullable<ChatMessage["financialEntities"]> = workspacePersistence() !== "browser" && serverEntities.success ? serverEntities.data : actions.includes("budget_status") ? planningEntities(state, "budget").filter(t => {
          const budget = state.goals.find(g => g.id === t.id)!;
          return (ai.scope === "all" || budget.wallet === (ai.walletId || wallet)) && (!ai.searchTerm || budget.title.toLowerCase().includes(ai.searchTerm.toLowerCase())) && (!ai.category || (budget.category || budget.title).toLowerCase().includes(ai.category.toLowerCase()));
        }).map(t => ({ kind: "budget", id: t.id, title: t.title })) : [];
        setMessages((previous) => [...previous, { role: "assistant", text: answer, localOnly: true, financialEntities, financialContext: {
          walletId: ai.walletId || wallet || null, scope: ai.scope === "all" ? "all" : "selected", searchTerm: ai.searchTerm || null,
          action: ai.action || "unknown", category: ai.category || null, periodStart: ai.periodStart || null,
          periodEnd: ai.periodEnd || null, percentage: ai.percentage ?? null,
        } }]);
        return;
      }
      if (ai.intent === "general" || ai.intent === "unclear") {
        const answer = ai.reply?.trim() || "Bạn nói rõ hơn một chút giúp mình nhé.";
        setMessages((previous) => [...previous, { role: "assistant", text: answer }]);
        return;
      }
      if (ai.intent !== "transaction" && ai.intent !== "clarification") {
        setMessages((previous) => [...previous, { role: "assistant", text: ai.reply?.trim() || "Mình chưa hiểu ý bạn. Bạn có thể nói lại theo cách khác không?" }]);
        return;
      }
      const checkedReturned = returned.map(item => validateDraftForState(item as TransactionDraft, state));
      const unavailable = checkedReturned.filter(draft => !hasCompatibleDraftWallet(draft, state.wallets));
      const validated = checkedReturned.filter(draft => hasCompatibleDraftWallet(draft, state.wallets));
      if (unavailable.length) {
        const rejectedIds = new Set(unavailable.map(draft => draft.id));
        setDrafts(previous => previous.filter(draft => !rejectedIds.has(draft.id)));
        setMessages(previous => [...previous, { role: "assistant", text: unavailableWalletReply(unavailable.map(draft => draft.currency), resolveLanguage(state.settings.language)) }]);
        setClarifyingDraftId(null); setFocusedDraftId(null);
        if (!validated.length || ai.intent === "clarification") return;
      }
      if (ai.intent === "clarification") {
        const resolved = resolvePendingDraft(message, pendingDrafts, ai.targetDraftId || null, activeDraftId);
        if (!resolved || !validated[0] || validated[0].id !== resolved.id) {
          setMessages(previous => [...previous, { role: "assistant", text: ai.reply?.trim() || categoryCommandCopy.chooseDraft, draftTargetChoices: pendingDrafts.map(d => d.id), pendingFollowup: message }]);
          return;
        }
        if (JSON.stringify(latestDrafts.current.find(d => d.id === resolved.id)) !== JSON.stringify(resolved)) {
          setMessages(previous => [...previous, { role: "assistant", text: categoryCommandCopy.stale }]);
          return;
        }
        setDrafts((previous) => previous.map((draft) => draft.id === resolved.id ? validated[0] : draft));
        setFocusedDraftId(resolved.id);
        const update = validated[0];
        const missing = update ? update.needsReview : [];
        setClarifyingDraftId(update && missing.length ? update.id : null);
        const needsCategoryChoice = !!update && missing.includes("category") && !!update.type;
        setMessages((previous) => [...previous, { role: "assistant", text: update && missing.length ? needsCategoryChoice ? "Mình chưa xác định được danh mục. Chọn danh mục có sẵn bên dưới hoặc tạo danh mục mới." : clarificationQuestion(missing) : "Cảm ơn bạn, mình đã cập nhật bản nháp. Hãy kiểm tra rồi xác nhận để lưu nhé.",
          ...(update ? { draftIds: [update.id] } : {}), ...(needsCategoryChoice ? { categoryChoiceDraftIds: [update!.id] } : {}) }]);
      } else if (validated.length) {
        setDrafts((previous) => [...previous, ...validated.filter(draft => !previous.some(item => item.id === draft.id))]);
        setFocusedDraftId(pendingDrafts.length === 0 && validated.length === 1 ? validated[0].id : null);
        const walletChoiceDraftIds = validated.filter((draft) => draft.needsReview.includes("wallet")).map((draft) => draft.id);
        const categoryChoiceDraftIds = validated.filter((draft) => draft.needsReview.includes("category") && !!draft.type).map((draft) => draft.id);
        setClarifyingDraftId(pendingDrafts.length === 0 && validated.length === 1 ? validated[0].id : null);
        const currencyMatch = ai.intent === "transaction"
          ? resolveUniqueCurrencyWallet(message, state.wallets.filter((item) => !item.archived))
          : null;
        const explicitWalletId = ai.intent === "transaction" ? resolveExplicitWallet(message, state.wallets.filter((item) => !item.archived)) : null;
        const explicitWallet = state.wallets.find((item) => item.id === explicitWalletId);
        const explicitWalletConflict = !!explicitWallet && !!currencyMatch?.currency && explicitWallet.currency.toUpperCase() !== currencyMatch.currency;
        const walletPrompt = walletChoiceDraftIds.length
          ? explicitWalletConflict
            ? `Ví ${explicitWallet?.name === "." ? "chính" : explicitWallet?.name} không dùng ${currencyMatch?.currency}. Hãy chọn ví đúng tiền tệ cho bản nháp.`
            : currencyMatch?.ambiguous && currencyMatch.currency
            ? `Có nhiều ví dùng ${currencyMatch.currency}; hãy chọn ví cho từng bản nháp.`
            : currencyMatch?.ambiguous
              ? "Tin nhắn có nhiều đơn vị tiền tệ. Hãy chọn ví phù hợp cho từng bản nháp."
            : currencyMatch?.currency
              ? `Mình nhận ra tiền tệ ${currencyMatch.currency}, nhưng chưa có ví phù hợp đang hoạt động. Hãy chọn ví hoặc tạo ví ${currencyMatch.currency}.`
              : "Mình chưa chắc nên dùng ví nào. Hãy chọn ví cho từng bản nháp."
          : categoryChoiceDraftIds.length
            ? "Mình chưa chắc danh mục. Chọn một danh mục có sẵn bên dưới hoặc tạo danh mục mới."
            : "Mình đã tạo bản nháp. Hãy kiểm tra rồi xác nhận để lưu nhé.";
        setMessages((previous) => [...previous, {
          role: "assistant",
          text: walletPrompt,
          draftIds: validated.map((draft) => draft.id),
          ...(currencyMatch?.currency ? { requiredCurrency: currencyMatch.currency } : {}),
          ...(walletChoiceDraftIds.length ? { walletChoiceDraftIds } : {}),
          ...(!walletChoiceDraftIds.length && categoryChoiceDraftIds.length ? { categoryChoiceDraftIds } : {}),
        }]);
      }
      else setMessages((previous) => [...previous, { role: "assistant", text: "Chưa tìm thấy giao dịch nào có thể đưa vào bản nháp. Hãy thử mô tả lại." }]);
    } catch (error) {
      if (workspaceOwner() !== submissionOwner || conversationGeneration.current !== submissionGeneration) return;
      if (lastSubmission.current?.batchId === batchId) lastSubmission.current.failed = true;
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || /chưa phản hồi kịp/i.test(error.message));
      const fallback = timedOut ? createTimeoutTransactionDraft(message, batchId, today(), state) : null;
      if (fallback && latestDrafts.current.length) {
        setText(message);
        setMessages(previous => [...previous, { role: "assistant", text: pendingDraftReminder(resolveLanguage(state.settings.language), latestDrafts.current.length), draftIds: latestDrafts.current.map(d => d.id) }]);
        return;
      }
      if (fallback) {
        const activeWallets = state.wallets.filter((item) => !item.archived);
        const currencyWallet = resolveUniqueCurrencyWallet(message, activeWallets);
        const fallbackWallet = currencyWallet.walletId || (!currencyWallet.currency && !currencyWallet.ambiguous ? wallet || (activeWallets.length === 1 ? activeWallets[0].id : null) : null);
        const selectedWallet = state.wallets.find((item) => item.id === fallbackWallet && !item.archived);
        const checked = validateDraftForState({ ...fallback, id: `${batchId}:0`, wallet: selectedWallet?.id || null, currency: fallback.currency || selectedWallet?.currency || null }, state);
        if (!hasCompatibleDraftWallet(checked, state.wallets)) {
          setMessages(previous => [...previous, { role: "assistant", text: unavailableWalletReply([checked.currency], resolveLanguage(state.settings.language)) }]);
          return;
        }
        setDrafts((previous) => previous.some(d => d.id === checked.id) ? previous : [...previous, checked]);
        setFocusedDraftId(pendingDrafts.length === 0 ? checked.id : null);
        setClarifyingDraftId(pendingDrafts.length === 0 ? checked.id : null);
        const unresolvedWallet = checked.needsReview.includes("wallet");
        const categoryChoiceDraftIds = checked.needsReview.includes("category") && !!checked.type ? [checked.id] : [];
        setMessages((previous) => [...previous, {
          role: "assistant",
          text: serviceCopy.draftReady,
          draftIds: [checked.id],
          ...(currencyWallet.currency ? { requiredCurrency: currencyWallet.currency } : {}),
          ...(unresolvedWallet ? { walletChoiceDraftIds: [checked.id] } : {}),
          ...(!unresolvedWallet && categoryChoiceDraftIds.length ? { categoryChoiceDraftIds } : {}),
        }]);
      } else {
        const errorMessage = timedOut ? serviceCopy.timeout : error instanceof Error ? error.message : serviceCopy.unavailable;
        setText((current) => current.trim() ? current : message);
        setMessages((previous) => [...previous, { role: "assistant", text: errorMessage }]);
      }
    } finally {
      if (conversationGeneration.current === submissionGeneration) { setBusy(false); aiRequestLock.current = false; activeChatRequest.current = null; }
    }
  }
  async function readReceipt(file: File) {
    if (busy || aiRequestLock.current || committing) return;
    if (latestDrafts.current.length) {
      setMessages(previous => [...previous, { role: "assistant", text: pendingDraftReminder(resolveLanguage(state.settings.language), latestDrafts.current.length), draftIds: latestDrafts.current.map(d => d.id) }]);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (!state.wallets.some(item => !item.archived)) {
      setFailedReceiptFile(file);
      setMessages(previous => [...previous, { role: "assistant", text: unavailableWalletReply([], resolveLanguage(state.settings.language)), retryReceipt: true }]);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setMessages((previous) => [...previous, { role: "assistant", text: "Vui lòng chọn một tệp ảnh hóa đơn." }]);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessages((previous) => [...previous, { role: "assistant", text: "Ảnh quá lớn. Vui lòng chọn ảnh dưới 5 MB." }]);
      return;
    }
    const owner = workspaceOwner(), generation = conversationGeneration.current;
    const controller = new AbortController(); activeChatRequest.current = controller;
    setBusy(true); aiRequestLock.current = true; setFailedReceiptFile(file);
    setMessages((previous) => [...previous, { role: "user", text: "📷 Ảnh hóa đơn" }, { role: "assistant", text: "Đang đọc hóa đơn và kiểm tra thông tin…" }]);
    try {
      const imageDataUrl = await prepareReceiptImage(file);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      const response = await fetch("/api/ai/receipt-drafts", {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]), method: "POST",
        headers: { "Content-Type": "application/json", "x-finbridge-language": resolveLanguage(state.settings.language) },
        body: JSON.stringify({
          imageDataUrl, today: today(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          defaultWalletId: wallet || state.wallets.find((item) => !item.archived)?.id || "",
          wallets: state.wallets.filter((item) => !item.archived).map(({ id, name, currency }) => ({ id, name, currency })),
          categories: state.categories.filter((name) => !state.categoryMeta[name]?.archived).flatMap((name) => {
            const type = state.categoryMeta[name]?.type || "expense";
            return type === "income" || type === "expense" ? [{ name, type }] : [];
          }),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      const draftValue = result && typeof result === "object" ? (result as { draft?: unknown }).draft : null;
      if (!response.ok || !draftValue || typeof draftValue !== "object" || typeof (draftValue as TransactionDraft).id !== "string" || typeof (draftValue as TransactionDraft).title !== "string") {
        const message = result && typeof result === "object" && typeof (result as { message?: unknown }).message === "string" ? (result as { message: string }).message : "Không thể đọc hóa đơn. Hãy chọn ảnh rõ hơn hoặc nhập giao dịch bằng chat.";
        throw new Error(message);
      }
      const parsedDraft = draftValue as TransactionDraft;
      const inferredCategory = parsedDraft.category || inferDraftCategory(parsedDraft.title, parsedDraft.type, state);
      const draft = validateDraftForState({ ...(inferredCategory ? { ...parsedDraft, category: inferredCategory } : parsedDraft), wallet: null, currency: parsedDraft.currency }, state);
      if (!hasCompatibleDraftWallet(draft, state.wallets)) {
        setMessages(previous => [...previous.slice(0, -1), { role: "assistant", text: unavailableWalletReply([draft.currency], resolveLanguage(state.settings.language)), retryReceipt: true }]);
        return;
      }
      setReceiptImageUrls((previous) => ({ ...previous, [draft.id]: imageDataUrl }));
      setFailedReceiptFile(null);
      setDrafts((previous) => [...previous, draft]);
      setClarifyingDraftId(null);
        const needsCategory = draft.needsReview.includes("category") && !!draft.type;
        setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", text: "Mình đã đọc hóa đơn. Bạn muốn ghi giao dịch này vào ví nào? Chọn ví bên dưới để tạo bản nháp.", walletChoiceDraftIds: [draft.id], ...(needsCategory ? { categoryChoiceDraftIds: [draft.id] } : {}) }]);
    } catch (error) {
      if (workspaceOwner() !== owner || conversationGeneration.current !== generation) return;
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      const preparationFailed = error instanceof Error && ["RECEIPT_IMAGE_TOO_LARGE", "INVALID_RECEIPT_IMAGE", "InvalidStateError", "EncodingError"].some(code => error.message === code || error.name === code);
      const message = preparationFailed ? { vi: "Chưa chuẩn bị được ảnh để gửi an toàn. Ảnh gốc vẫn được giữ; hãy chọn JPEG/PNG rõ nét, nhỏ hơn rồi thử lại.", en: "The image could not be prepared safely. The original is kept; try a smaller, clear JPEG or PNG.", zh: "无法安全准备图片，原图已保留。请尝试较小且清晰的 JPEG 或 PNG。" }[resolveLanguage(state.settings.language)] : timedOut ? "Đọc hóa đơn quá thời gian chờ. Ảnh vẫn được giữ; bấm “Thử lại ảnh” hoặc chọn ảnh nhỏ hơn." : error instanceof Error ? error.message : "Không thể đọc hóa đơn. Vui lòng thử lại.";
      setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", text: message, retryReceipt: true }]);
    } finally {
      if (workspaceOwner() === owner && conversationGeneration.current === generation) {
        setBusy(false); aiRequestLock.current = false; activeChatRequest.current = null;
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  }
  function editDraft(id: string, patch: Partial<Omit<TransactionDraft, "id" | "needsReview">>) {
    if (uncertainDraftIds.includes(id)) return;
    setFocusedDraftId(id);
    const selectedWallet = patch.wallet ? state.wallets.find((item) => item.id === patch.wallet && !item.archived) : undefined;
    const explicitPatch = selectedWallet ? { ...patch, currency: selectedWallet.currency } : patch;
    setDrafts((previous) => editDraftById(previous, id, explicitPatch, state));
    if (clarifyingDraftId === id) setClarifyingDraftId(null);
  }
  function createDraftCategory() {
    const name = newCategoryName.trim();
    if (!name || !editingDraft?.type) return;
    if (!isValidDraftCategoryName(name)) { setCategoryError(categoryFlowCopy.invalid); return; }
    const existing = state.categories.find((category) => normalizeVietnameseMessage(category) === normalizeVietnameseMessage(name));
    if (existing) {
      if (state.categoryMeta[existing]?.archived) { setCategoryError(categoryCommandCopy.unavailable); return; }
      if ((state.categoryMeta[existing]?.type || "expense") !== editingDraft.type) {
        setCategoryError(categoryFlowCopy.wrongType);
        return;
      }
      editDraft(editingDraft.id, { category: existing });
      setNewCategoryName(""); setCategoryError(""); setAddingCategory(false);
      return;
    }
    setDrafts((previous) => previous.map((draft) => draft.id === editingDraft.id
      ? validateDraftForState({ ...draft, category: null, newCategory: { name, type: editingDraft.type! } }, state)
      : draft));
    setNewCategoryName(""); setCategoryError(""); setAddingCategory(false);
  }
  async function confirmDrafts(ids: string[]) {
    if (committing || draftCommitLock.current || ids.length === 0) return;
    if (uncertainDraftIds.some(id => !ids.includes(id))) {
      setMessages(previous => [...previous, { role: "assistant", text: workspaceSaveErrorMessage(null, resolveLanguage(state.settings.language)), draftIds: uncertainDraftIds }]); return;
    }
    const selected = drafts.filter(draft => ids.includes(draft.id));
    const fundingProblem = draftFundingIssues(selected, getWorkspaceState(), today())[0];
    if (fundingProblem) {
      setMessages(previous => [...previous, { role: "assistant", text: fundingIssueMessage(fundingProblem.issue, resolveLanguage(state.settings.language)), draftIds: ids }]); return;
    }
    if (!selected.some(draft => uncertainDraftIds.includes(draft.id) || state.transactions.some(t => t.id === draft.id)) && readyDrafts(selected, state).length !== selected.length) {
      setMessages(previous => [...previous, { role: "assistant", text: { vi: "Bản nháp còn thiếu thông tin. Bạn bổ sung các mục được đánh dấu bên dưới trước khi xác nhận nhé.", en: "The draft needs more details. Complete the marked fields below before confirming.", zh: "草稿信息不完整，请先补全下面标记的字段再确认。" }[resolveLanguage(state.settings.language)], draftIds: ids }]); return;
    }
    draftCommitLock.current = true;
    setCommitting(true);
    const owner = workspaceOwner();
    let committed: string[] = [];
    let duplicateIds: string[] = [];
    let savedTransactions: Transaction[] = [];
    draftCommitSnapshot.current ||= getWorkspaceState();
    try {
      const chosen = drafts.filter((draft) => ids.includes(draft.id));
      updateState((current) => {
        if (!owner || workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
        duplicateIds = chosen.filter((draft) => current.transactions.some((transaction) => transaction.id === draft.id)).map((draft) => draft.id);
        const result = validateAndCommitDrafts(current, chosen);
        committed = result.committed;
        const committedIds = new Set(result.committed);
        savedTransactions = result.state.transactions.filter((transaction) => committedIds.has(transaction.id));
        return { ...result.state, transactions: result.state.transactions.map((transaction) => committedIds.has(transaction.id) && receiptImageUrls[transaction.id] ? { ...transaction, image: receiptImageUrls[transaction.id] } : transaction) };
      });
      await flushWorkspace(true);
      if (workspaceOwner() !== owner) return;
      if (committed.some(id => !getWorkspaceState().transactions.some(t => t.id === id))) throw new Error("SAVE_NOT_CONFIRMED");
      if (committed.length) {
        const transactions = committed.map((id) => {
          const image = receiptImageUrls[id];
          setReceiptImageUrls((previous) => { const next = { ...previous }; delete next[id]; return next; });
          return { ...savedTransactions.find((transaction) => transaction.id === id)!, ...(image ? { image } : {}) } satisfies Transaction;
        });
        setReceiptImageUrls((previous) => { const next = { ...previous }; for (const id of committed) delete next[id]; return next; });
        setMessages((previous) => [...previous, ...transactions.map((transaction) => ({ role: "assistant" as const, text: `Đã lưu ${formatTransactionMoney(transaction.amount, state.wallets.find((item) => item.id === transaction.wallet)!.currency)} vào ${transaction.category}.`, transaction }))]);
      } else if (duplicateIds.length) {
        setMessages((previous) => [...previous, { role: "assistant", text: "Bản nháp này đã được lưu trước đó; không tạo bản ghi trùng." }]);
      }
      const processed = new Set([...committed, ...duplicateIds]);
      setUncertainDraftIds(previous => previous.filter(id => !processed.has(id)));
      draftCommitSnapshot.current = null;
      if (processed.size) setMessages((previous) => previous.map((message) => {
        const walletChoiceDraftIds = message.walletChoiceDraftIds?.filter((id) => !processed.has(id));
        const categoryChoiceDraftIds = message.categoryChoiceDraftIds?.filter((id) => !processed.has(id));
        const draftIds = message.draftIds?.filter((id) => !processed.has(id));
        return { ...message,
          walletChoiceDraftIds: walletChoiceDraftIds?.length ? walletChoiceDraftIds : undefined,
          categoryChoiceDraftIds: categoryChoiceDraftIds?.length ? categoryChoiceDraftIds : undefined,
          draftIds: draftIds?.length ? draftIds : undefined };
      }));
      setDrafts((previous) => previous.filter((draft) => !processed.has(draft.id)));
      if (processed.has(focusedDraftId || "")) setFocusedDraftId(null);
      if (ids.includes(clarifyingDraftId || "")) setClarifyingDraftId(null);
    } catch (error) {
      if (workspaceOwner() === owner) {
        if (definitelyRejectedWorkspace(error) && draftCommitSnapshot.current) {
          const before = draftCommitSnapshot.current;
          updateState(current => rollbackRejectedDrafts(current, before, ids));
          draftCommitSnapshot.current = null; setUncertainDraftIds(previous => previous.filter(id => !ids.includes(id)));
        } else setUncertainDraftIds(previous => [...new Set([...previous, ...ids])]);
        setMessages(previous => [...previous, { role: "assistant", text: workspaceSaveErrorMessage(error, resolveLanguage(state.settings.language)), draftIds: ids }]);
      }
    } finally { draftCommitLock.current = false; setCommitting(false); }
  }
  function removeDraft(id: string) {
    if (committing || draftCommitLock.current) return;
    if (uncertainDraftIds.includes(id)) { setMessages(previous => [...previous, { role: "assistant", text: workspaceSaveErrorMessage(null, resolveLanguage(state.settings.language)), draftIds: [id] }]); return; }
    if (lastSubmission.current && id.startsWith(lastSubmission.current.batchId + ":")) lastSubmission.current = null;
    if (focusedDraftId === id) setFocusedDraftId(null);
    setReceiptImageUrls((previous) => { const next = { ...previous }; delete next[id]; return next; });
    setDrafts((previous) => removeDraftById(previous, id));
    if (clarifyingDraftId === id) setClarifyingDraftId(null);
    setEditingDraftId((current) => current === id ? null : current);
    setMessages((previous) => [...previous.map((message) => ({ ...message,
      walletChoiceDraftIds: message.walletChoiceDraftIds?.filter((draftId) => draftId !== id).filter((draftId) => drafts.some((draft) => draft.id === draftId)) || undefined,
      categoryChoiceDraftIds: message.categoryChoiceDraftIds?.filter((draftId) => draftId !== id).filter((draftId) => drafts.some((draft) => draft.id === draftId)) || undefined,
      draftIds: message.draftIds?.filter((draftId) => draftId !== id).filter((draftId) => drafts.some((draft) => draft.id === draftId)) || undefined,
    })), { role: "assistant", text: "Đã bỏ bản nháp." }]);
  }
  function chooseDraftWallet(draftId: string, walletId: string) {
    if (committing || uncertainDraftIds.includes(draftId)) return;
    setFocusedDraftId(draftId);
    const chosenWallet = state.wallets.find((item) => item.id === walletId && !item.archived);
    const draft = drafts.find((item) => item.id === draftId);
    if (!chosenWallet || !draft) return;
    if (draft.currency && chosenWallet.currency.toUpperCase() !== draft.currency.toUpperCase()) return;
    setWallet(chosenWallet.id);
    const choiceMessage = messages.find((message) => message.walletChoiceDraftIds?.includes(draftId));
    if (choiceMessage?.requiredCurrency && chosenWallet.currency.toUpperCase() !== choiceMessage.requiredCurrency.toUpperCase()) return;
    const updatedDrafts = editDraftById(drafts, draftId, { wallet: chosenWallet.id, currency: chosenWallet.currency }, state);
    const updatedDraft = updatedDrafts.find((item) => item.id === draftId);
    if (!updatedDraft) return;
    const otherWalletChoicesRemain = messages.some((message) => message.walletChoiceDraftIds?.some((id) => id !== draftId));
    const needsCategory = updatedDraft.needsReview.includes("category") && !!updatedDraft.type;
    const batchDraftIds = [...new Set([...(choiceMessage?.draftIds || []), ...(choiceMessage?.walletChoiceDraftIds || [])])];
    setDrafts(updatedDrafts);
    const nextClarification = otherWalletChoicesRemain ? null : batchDraftIds
      .map((id) => updatedDrafts.find((item) => item.id === id))
      .find((item) => item?.needsReview.length)?.id || null;
    setClarifyingDraftId(needsCategory || otherWalletChoicesRemain ? null : nextClarification);
    setMessages((previous) => previous.map((message) => {
      if (!message.walletChoiceDraftIds?.includes(draftId)) return message;
      const remaining = message.walletChoiceDraftIds.filter((id) => id !== draftId);
      const categoryChoices = needsCategory ? [...new Set([...(message.categoryChoiceDraftIds || []), draftId])] : message.categoryChoiceDraftIds;
      return {
        ...message,
        walletChoiceDraftIds: remaining.length ? remaining : undefined,
        categoryChoiceDraftIds: categoryChoices,
        draftIds: needsCategory ? message.draftIds : [...new Set([...(message.draftIds || []), draftId])],
        text: needsCategory
          ? `${categoryFlowCopy.categoryPrompt} (${updatedDraft.title})`
          : remaining.length ? "Đã chọn ví cho giao dịch này. Chọn ví cho các giao dịch còn lại để tạo bản nháp." : "Đã chọn ví. Hãy kiểm tra bản nháp rồi xác nhận để lưu nhé.",
      };
    }));
  }
  function assignNewCategory(draftId: string, requestedName: string) {
    const draft = drafts.find((item) => item.id === draftId);
    const name = requestedName.trim();
    if (!draft?.type || !isValidDraftCategoryName(name)) return false;
    setFocusedDraftId(draftId);
    const existing = state.categories.find((category) => normalizeVietnameseMessage(category) === normalizeVietnameseMessage(name));
    if (existing && state.categoryMeta[existing]?.archived) {
      setMessages(previous => [...previous, { role: "assistant", text: categoryCommandCopy.unavailable }]);
      return false;
    }
    if (existing && (state.categoryMeta[existing]?.type || "expense") !== draft.type) {
      setMessages((previous) => [...previous, { role: "assistant", text: `${categoryFlowCopy.wrongType} (${existing}).` }]);
      return false;
    }
    const updated = existing
      ? validateDraftForState({ ...draft, category: existing, newCategory: undefined }, state)
      : validateDraftForState({ ...draft, category: null, newCategory: { name, type: draft.type } }, state);
    setDrafts((previous) => previous.map((item) => item.id === draftId ? updated : item));
    setClarifyingDraftId(updated.needsReview.length ? updated.id : null);
    return true;
  }
  function selectDraftCategory(draftId: string, category: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft?.type || state.categoryMeta[category]?.archived || (state.categoryMeta[category]?.type || "expense") !== draft.type) return;
    if (draft.wallet && state.walletCategories?.[draft.wallet] && !state.walletCategories[draft.wallet].includes(category)) return;
    const updated = editDraftById(drafts, draftId, { category }, state).find((item) => item.id === draftId);
    if (!updated) return;
    setFocusedDraftId(draftId); setReferencedCategories([category]);
    setDrafts((previous) => previous.map((item) => item.id === draftId ? updated : item));
    setCategoryFormDraftId(null); setNewCategoryName(""); setCategoryError("");
    setClarifyingDraftId(updated.needsReview.length ? updated.id : null);
    setMessages((previous) => previous.map((item) => {
      if (!item.categoryChoiceDraftIds?.includes(draftId)) return item;
      return { ...item,
        draftIds: [...new Set([...(item.draftIds || []), draftId])],
        text: `${categoryFlowCopy.updated} “${category}” (${updated.title}). ${categoryFlowCopy.notSaved}.` };
    }));
  }
  function selectDraftType(draftId: string, type: "expense" | "income") {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft || busy || committing) return;
    setFocusedDraftId(draftId);
    const category = inferDraftCategory(draft.title, type, state);
    const updated = validateDraftForState({ ...draft, type, category, newCategory: undefined }, state);
    setDrafts((previous) => previous.map((item) => item.id === draftId ? updated : item));
    setClarifyingDraftId(updated.needsReview.length ? draftId : null);
    setMessages((previous) => previous.map((item, index) =>
      categoryResolutionDraftIds(previous, index, drafts).includes(draftId)
        ? { ...item, categoryChoiceDraftIds: [...new Set([...(item.categoryChoiceDraftIds || []), draftId])], text: categoryFlowCopy.categoryPrompt }
        : item));
  }
  function openCategoryCreation(draftId: string) {
    setCategoryFormDraftId(draftId);
    setNewCategoryName("");
    setCategoryError("");
  }
  function stageChatCategory(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    const name = newCategoryName.trim();
    if (!draft?.type || !name) return;
      if (!isValidDraftCategoryName(name)) { setCategoryError(categoryFlowCopy.invalid); return; }
    const existing = state.categories.find((category) => normalizeVietnameseMessage(category) === normalizeVietnameseMessage(name));
    if (existing) {
      if (state.categoryMeta[existing]?.archived) { setCategoryError(categoryCommandCopy.unavailable); return; }
      if ((state.categoryMeta[existing]?.type || "expense") !== draft.type) {
        setCategoryError(categoryFlowCopy.wrongType);
        return;
      }
      selectDraftCategory(draftId, existing);
    } else {
      const options = state.categories.filter((category) => !state.categoryMeta[category]?.archived && (state.categoryMeta[category]?.type || "expense") === draft.type);
      const similar = similarDraftCategories(name, options);
      if (similar.length) {
        setCategoryError(`${categoryFlowCopy.existing}: ${similar.slice(0, 3).join(", ")}.`);
        return;
      }
      if (!assignNewCategory(draftId, name)) return;
      setMessages((previous) => previous.map((item) => {
        if (!item.categoryChoiceDraftIds?.includes(draftId)) return item;
        return { ...item,
          draftIds: [...new Set([...(item.draftIds || []), draftId])],
          text: `${categoryFlowCopy.pendingCategory} “${name}” ${categoryFlowCopy.stillDraft} (${draft.title}).` };
      }));
    }
    setCategoryFormDraftId(null); setNewCategoryName(""); setCategoryError("");
  }
  async function transcribeVoice(blob: Blob) {
    if (aiRequestLock.current) return;
    aiRequestLock.current = true;
    setTranscribing(true);
    try {
      if (blob.size > AI_AUDIO_BYTES) throw new Error(resolveLanguage(state.settings.language) === "vi" ? "Bản ghi quá lớn. Hãy nói ngắn hơn hoặc nhập bằng tay." : resolveLanguage(state.settings.language) === "zh" ? "录音过大。请缩短录音或手动输入。" : "Recording is too large. Record a shorter message or type it.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const response = await fetch("/api/ai/speech-transcription", { signal: AbortSignal.timeout(20_000), method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-language": resolveLanguage(state.settings.language) }, body: JSON.stringify({ mimeType: blob.type || "audio/webm", audioBase64: btoa(binary) }) });
      const result = await response.json() as { text?: string; message?: string };
      if (!response.ok || !result.text?.trim()) throw new Error(result.message || "Chưa nhận diện được lời nói. Hãy thử lại.");
      setText(result.text.trim());
      setVoiceError("");
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      setVoiceError(timedOut ? "Chuyển giọng nói mất nhiều thời gian hơn dự kiến. Hãy nói đoạn ngắn hơn rồi thử lại." : error instanceof Error ? error.message : "Không thể chuyển giọng nói thành chữ. Hãy thử lại.");
    } finally { setTranscribing(false); aiRequestLock.current = false; }
  }
  async function startVoice() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setVoiceError("Trình duyệt này chưa hỗ trợ ghi âm. Hãy mở FinBridge bằng Chrome hoặc Edge mới nhất.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStream.current = stream;
      audioChunks.current = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const activeRecorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 64_000 });
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      activeRecorder.onerror = () => setVoiceError("Có lỗi khi ghi âm. Hãy kiểm tra micro rồi thử lại.");
      activeRecorder.onstop = () => {
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        recordingTimer.current = null;
        const audio = new Blob(audioChunks.current, { type: activeRecorder.mimeType });
        recorderStream.current?.getTracks().forEach((track) => track.stop());
        recorderStream.current = null;
        recorder.current = null;
        setListening(false);
        if (audio.size) void transcribeVoice(audio);
        else setVoiceError("Chưa ghi được âm thanh. Hãy thử nói lại.");
      };
      activeRecorder.start();
      recordingTimer.current = setTimeout(() => { if (activeRecorder.state !== "inactive") activeRecorder.stop(); }, AI_RECORDING_SECONDS * 1000);
      setListening(true);
      setVoiceError("");
    } catch (error) {
      setListening(false);
      const name = error instanceof DOMException ? error.name : "";
      setVoiceError(name === "NotAllowedError" || name === "SecurityError"
        ? "Trình duyệt đang chặn micro. Hãy cho phép Micro trong quyền trang web rồi thử lại."
        : name === "NotFoundError" ? "Không tìm thấy micro trên thiết bị này."
          : "Không truy cập được micro. Hãy kiểm tra kết nối và quyền micro của trình duyệt.");
    }
  }
  const editingDraft = drafts.find((draft) => draft.id === editingDraftId);
  const chatMascotGreeting = /中文|zh/.test(String(state.settings.language))
    ? "今天你消费了什么？"
    : /English|en/i.test(String(state.settings.language))
      ? "What did you spend today?"
      : "Hôm nay bạn đã chi tiêu gì?";
  return <div className="r-chat-page"><PageHeader onBack={() => navigate("?tab=transactions")}><button type="button" className="r-icon-button" aria-label={uiText("Xóa hội thoại")} title={uiText("Xóa hội thoại")} onClick={() => setModal("resetChat")}><Trash2 size={18} /></button><button type="button" className="r-icon-button" aria-label={uiText("Cài đặt chat")} onClick={() => navigate("accountSettings")}><Settings size={20} /></button></PageHeader><div className="r-chat-messages" ref={messagesRef} role="log" aria-label={uiText("Lịch sử hội thoại")} tabIndex={0}><Mascot greeting={chatMascotGreeting} className="r-chat-mascot" size={80} />
      <div className={planStyles.chatIntroduction + " r-chat-introduction"}>
        <p>{String(state.settings.name || "")}, { /中文|zh/.test(String(state.settings.language)) ? "你好！我是 Finn。" : /Việt|vi/.test(String(state.settings.language)) ? "xin chào! Mình là Finn." : "hello! I'm Finn." }</p>
        <button type="button" disabled={busy || committing} onClick={() => setMessages(previous => [...previous, { role: "assistant", text: "", spendingPlan: {}, localOnly: true }])}>{/中文|zh/.test(String(state.settings.language)) ? "查看支出计划" : /Việt|vi/.test(String(state.settings.language)) ? "Xem kế hoạch chi tiêu" : "View spending plan"}</button>
      </div>
      <span className="r-chat-date">{uiText("Hôm nay")}</span>
      {conversationLanguage.status !== "idle" && <div role="status" className="r-chat-translation-status"><span>{conversationLanguage.status === "pending" ? translationCopy.pending : translationCopy.failed}</span>{conversationLanguage.status === "failed" && <button type="button" className="r-secondary" onClick={conversationLanguage.retry}>{translationCopy.retry}</button>}</div>}
      {messages.map((message, index) => <div key={index} className={"r-message " + message.role + (message.draftIds ? " r-ai-draft-message" : "")}>
        {message.transfer ? <ChatTransferCard result={message.transfer.status === "saving" && !transferBusy ? {...message.transfer,status:"failed",uncertain:true,error:transferChatCopy[resolveLanguage(state.settings.language)].unavailable} : message.transfer} language={resolveLanguage(state.settings.language)} busy={transferBusy || busy || committing || categoryBusy || !!deletingId} onChoice={(patch,label) => void chooseTransfer(message.transfer!,patch,label)} onConfirm={() => void confirmTransfer(message.transfer?.status === "saving" && !transferBusy ? {...message.transfer,status:"failed",uncertain:true} : message.transfer!)} onCancel={() => cancelTransfer(message.transfer!)} onOpen={() => navigate("?tab=transfers")} /> : message.spendingPlan ? <>{message.text && <p>{conversationLanguage.displayText(message.text)}</p>}<ChatSpendingPlan state={state} asOf={today()} options={message.spendingPlan} onScope={busy || committing ? undefined : (options: SpendingPlanOptions) => setMessages(previous => [...previous, { role: "assistant", text: "", spendingPlan: options, localOnly: true }])}/></> : message.role === "assistant" && (message.financialContext || message.scenarioExplanation || message.draftTargetChoices) && !/gemini|AI Studio/i.test(message.text) ? <FinancialChatAnswer text={conversationLanguage.displayText(message.text)} calculationDetails={message.scenarioExplanation ? conversationLanguage.displayText(message.scenarioExplanation) : undefined} calculationLabel={{ vi: "Xem cách tính", en: "Calculation details", zh: "查看计算方式" }[resolveLanguage(state.settings.language)]} /> : <p>{message.role === "assistant" && /gemini|AI Studio/i.test(message.text)
          ? message.draftIds?.length ? serviceCopy.draftReady : serviceCopy.unavailable
          : conversationLanguage.displayText(message.text)}</p>}
        {message.text && conversationLanguage.displayText(message.text) !== message.text && <details className="r-chat-original"><summary>{translationCopy.original}</summary><p>{message.text}</p></details>}
        {message.planningDeletion && !messages.slice(index + 1).some(item => item.planningDeletion?.id === message.planningDeletion?.id) && (() => {
          const parsed = planningDeletionSchema.safeParse(message.planningDeletion);
          return parsed.success ? <PlanningDeletionCard proposal={parsed.data} language={resolveLanguage(state.settings.language)} busy={busy || committing || categoryBusy || !!deletingId}
            onSelect={(id, selected) => selectPlanningDeletion(parsed.data.id, id, selected)} onConfirm={() => void confirmPlanningDeletion(parsed.data.id)} onCancel={() => cancelPlanningDeletion(parsed.data.id)} /> : null;
        })()}
        {message.fixedExpensePayment && !messages.slice(index + 1).some(item => item.fixedExpensePayment?.id === message.fixedExpensePayment?.id) && (() => {
          const parsed = fixedExpensePaymentProposalSchema.safeParse(message.fixedExpensePayment);
          return parsed.success ? <FixedExpensePaymentCard proposal={parsed.data} language={resolveLanguage(state.settings.language)} busy={busy || committing || categoryBusy || !!deletingId}
            onConfirm={() => void confirmFixedExpensePayment(parsed.data.id)} onCancel={() => cancelFixedExpensePayment(parsed.data.id)} /> : null;
        })()}
        {message.fixedExpenseStatus && !messages.slice(index + 1).some(item => item.fixedExpenseStatus?.id === message.fixedExpenseStatus?.id) && (() => {
          const parsed = fixedExpenseStatusProposalSchema.safeParse(message.fixedExpenseStatus);
          return parsed.success ? <FixedExpenseStatusCard proposal={parsed.data} language={resolveLanguage(state.settings.language)} busy={busy || committing || categoryBusy || !!deletingId}
            onConfirm={() => void confirmFixedExpenseStatus(parsed.data.id)} onCancel={() => cancelFixedExpenseStatus(parsed.data.id)} /> : null;
        })()}
        {message.planningEdit && !messages.slice(index + 1).some(item => item.planningEdit?.id === message.planningEdit?.id) && (() => {
          const parsed = planningEditProposalSchema.safeParse(message.planningEdit);
          return parsed.success ? <PlanningEditCard proposal={parsed.data} language={resolveLanguage(state.settings.language)} busy={busy || committing || categoryBusy || !!deletingId}
            onConfirm={() => void confirmPlanningEdit(parsed.data.id)} onCancel={() => cancelPlanningEdit(parsed.data.id)} /> : null;
        })()}
        {message.settingsAction && !messages.slice(index + 1).some(item => item.settingsAction?.id === message.settingsAction?.id) && (() => {
          const parsed = settingsActionProposalSchema.safeParse(message.settingsAction);
          return parsed.success ? <SettingsActionCard proposal={parsed.data} lang={resolveLanguage(state.settings.language)}
            onConfirm={() => void confirmSettingsAction(parsed.data.id)} onCancel={() => cancelSettingsAction(parsed.data.id)} /> : null;
        })()}
        {message.workspaceProposal && !messages.slice(index + 1).some(item => item.workspaceProposal?.id === message.workspaceProposal?.id) && (() => {
          const parsed = workspaceProposalSchema.safeParse(message.workspaceProposal);
          return parsed.success ? <WorkspaceActionCard proposal={parsed.data} state={state} language={resolveLanguage(state.settings.language)} busy={busy || committing || categoryBusy || !!deletingId}
            onConfirm={() => void confirmWorkspaceProposal(parsed.data.id)} onCancel={() => cancelWorkspaceProposal(parsed.data.id)}
            onAnswer={(choice, label) => void requestWorkspaceCreation(label, choice)}
            onCreateCategory={handleCreateWorkspaceCategory} /> : null;
        })()}
        {message.categoryDialogue && message.categoryDialogue.status !== "cancelled" && !messages.slice(index+1).some(item=>item.role==="assistant") && (()=>{
          const parsed=categoryDialogueSchema.safeParse(message.categoryDialogue);
          return parsed.success ? <div className="r-ai-category-options" role="group" aria-label={parsed.data.question} aria-busy={busy}>
            {parsed.data.choices.map(choice=><button key={choice.value} type="button" className="r-secondary" disabled={busy || committing || categoryBusy} onClick={()=>void send(choice.label,undefined,{field:parsed.data.field,value:choice.value})}>{choice.label}</button>)}
            <button type="button" className="r-secondary" disabled={busy || committing || categoryBusy} onClick={()=>setMessages(previous=>[...previous,{role:"assistant",text:categoryCommandCopy.cancelled,localOnly:true,categoryDialogue:{...parsed.data,status:"cancelled"}}])}>{categoryCommandCopy.cancel}</button>
          </div> : null;
        })()}
        {message.categoryList && <div className="r-ai-category-options" role="group" aria-label={categoryFlowCopy.choose}>
          {message.categoryList.filter(name => state.categories.includes(name) && !state.categoryMeta[name]?.archived).map(name => <button type="button" key={name} aria-pressed={referencedCategories.includes(name)} className={referencedCategories.includes(name) ? "selected" : ""} disabled={busy} onClick={() => setReferencedCategories(previous => previous.includes(name) ? previous.filter(n => n !== name) : [...previous, name].slice(-20))}>{state.categoryMeta[name]?.icon || "❓"} {resolveCategoryDisplayName(name, state.settings.language)}</button>)}
        </div>}
        {message.draftTargetChoices && <div className="r-ai-category-options" role="group" aria-label={categoryCommandCopy.chooseDraft}>
          {message.draftTargetChoices.map(id => {
            const draft = drafts.find(d => d.id === id);
            return draft && <button type="button" key={id} disabled={busy || committing || uncertainDraftIds.includes(id)} onClick={() => { setClarifyingDraftId(id); setFocusedDraftId(id); if (message.pendingFollowup) void send(message.pendingFollowup, id); }}>{{ vi: "Sửa bản nháp", en: "Edit draft", zh: "修改草稿" }[resolveLanguage(state.settings.language)]}: {draft.title} · {draft.currency && draft.amount ? formatTransactionMoney(draft.amount, draft.currency) : "—"}</button>;
          })}
        </div>}
        {message.categoryOperation && (() => {
          const operation = message.categoryOperation;
          const status = operation.status;
          return <section className="r-ai-delete-confirm" aria-label={categoryCommandCopy[operation.command.operation]}>
            <strong>{categoryOperationDescription(operation, resolveLanguage(state.settings.language))}</strong>
            <small role="status">{categoryCommandCopy[status]}</small>
            {["pending", "failed"].includes(status) && <>
              <p>{operation.command.operation === "delete_category" ? categoryCommandCopy.history : categoryCommandCopy.migration}</p>
              <p>{categoryCommandCopy.counts}: {Object.entries(operation.impact).map(([key, count]) => `${count} ${categoryCommandCopy[key as keyof typeof operation.impact]}`).join(" · ")}</p>
              <div className="r-two-options">
                <button type="button" className="r-secondary" disabled={categoryBusy || operation.applied} onClick={() => setMessages(previous => previous.map(m => m.categoryOperation?.id === operation.id ? { ...m, categoryOperation: { ...m.categoryOperation, status: "cancelled" } } : m))}>{categoryCommandCopy.cancel}</button>
                <button type="button" className="r-primary" disabled={busy || categoryBusy} onClick={() => void confirmCategoryCommand(operation.id)}>{status === "failed" ? categoryCommandCopy.retry : categoryCommandCopy.confirm}</button>
              </div>
            </>}
          </section>;
        })()}
        {message.transactionDeletion && (() => {
          const deletion = message.transactionDeletion;
          const candidates = state.transactions.filter((transaction) => deletion.transactionIds.includes(transaction.id));
          const copy = {
            vi: { all: "Xóa toàn bộ giao dịch", matched: "Giao dịch khớp yêu cầu", selected: "Được chọn để xóa", cancel: "Hủy yêu cầu", confirm: "Xác nhận xóa", cancelled: "Đã hủy yêu cầu xóa. Dữ liệu vẫn được giữ.", confirmed: `Đã xóa ${deletion.deletedCount || 0} giao dịch.`, empty: "Các giao dịch này không còn tồn tại.", danger: "Thao tác này sẽ xóa giao dịch khỏi dữ liệu và cập nhật số dư, lịch sử, ngân sách." },
            en: { all: "Delete all transactions", matched: "Matching transactions", selected: "Selected for deletion", cancel: "Cancel request", confirm: "Confirm deletion", cancelled: "Deletion cancelled. Your data is unchanged.", confirmed: `Deleted ${deletion.deletedCount || 0} transactions.`, empty: "These transactions are no longer available.", danger: "This removes the transactions and updates balances, history and budgets." },
            zh: { all: "删除全部交易", matched: "符合条件的交易", selected: "已选择删除", cancel: "取消请求", confirm: "确认删除", cancelled: "已取消删除，数据保持不变。", confirmed: `已删除 ${deletion.deletedCount || 0} 笔交易。`, empty: "这些交易已不存在。", danger: "删除后将更新余额、历史记录和预算。" },
          }[resolveLanguage(state.settings.language)];
          return <section className="r-ai-delete-confirm" aria-label={copy.matched}>
            <strong>{deletion.status === "pending" ? deletion.scope === "all" ? copy.all : copy.matched : deletion.status === "confirmed" ? copy.confirmed : deletion.status === "cancelled" ? copy.cancelled : deletion.status === "saving" ? categoryCommandCopy.saving : categoryCommandCopy.failed}</strong>
            {deletion.status === "failed" && <button type="button" className="r-primary" disabled={!!deletingId} onClick={() => void confirmTransactionDeletion(deletion.confirmationId)}>{categoryCommandCopy.retry}</button>}
            {deletion.status === "pending" && <>
              <p>{copy.danger}</p>
              {candidates.length ? <div className="r-ai-delete-list">{candidates.map((transaction) => {
                const transactionWallet = state.wallets.find((item) => item.id === transaction.wallet);
                return <label key={transaction.id}>
                  <input type="checkbox" checked={deletion.selectedIds.includes(transaction.id)} disabled={!!deletingId} onChange={(event) => selectTransactionForDeletion(deletion.confirmationId, transaction.id, event.target.checked)} />
                  <span><b>{transaction.title}</b><small>{transaction.date.slice(0, 10)}{transaction.date.length > 10 ? ` ${transaction.date.slice(11, 16)}` : ""} · {transaction.category} · {transactionWallet?.name || uiText("Ví")}</small></span>
                  <strong>{transactionWallet ? formatTransactionMoney(transaction.amount, transactionWallet.currency) : `${transaction.amount.toLocaleString("en-US")} · Chưa rõ tiền tệ`}</strong>
                </label>;
              })}</div> : <p>{copy.empty}</p>}
              <small>{deletion.selectedIds.length} {copy.selected.toLocaleLowerCase()}</small>
              <div className="r-two-options">
                <button type="button" className="r-secondary" disabled={!!deletingId} onClick={() => cancelTransactionDeletion(deletion.confirmationId)}>{copy.cancel}</button>
                <button type="button" className="r-primary" disabled={!!deletingId || !deletion.selectedIds.length || !candidates.length} onClick={() => void confirmTransactionDeletion(deletion.confirmationId)}>{copy.confirm} ({deletion.selectedIds.length})</button>
              </div>
            </>}
          </section>;
        })()}
        {message.retryReceipt && failedReceiptFile && <button type="button" className="r-ai-clarify-button" disabled={busy} onClick={() => void readReceipt(failedReceiptFile)}>{uiText("Thử lại ảnh")}</button>}
        {message.transaction && <button type="button" className="r-chat-record" onClick={() => navigate("editTransaction?id=" + message.transaction?.id)}>
          <small>{uiText("Đã ghi: ")}{message.transaction.type === "income" ? uiText("Thu nhập") : uiText("Chi phí")}</small><b>{resolveCategoryDisplayName(message.transaction.category, state.settings.language)}</b>
          <span>{(() => { const currency = state.wallets.find((item) => item.id === message.transaction?.wallet)?.currency; return currency ? formatTransactionMoney(message.transaction!.amount, currency) : `${message.transaction!.amount.toLocaleString("en-US")} · Chưa rõ tiền tệ`; })()}</span><small>{message.transaction.title}</small>
        </button>}
        {message.walletChoiceDraftIds?.map((id) => {
          const pending = drafts.find((draft) => draft.id === id);
          if (!pending || uncertainDraftIds.includes(id)) return null;
          const requiredCurrency = pending.currency || message.requiredCurrency;
          const availableWallets = state.wallets.filter((item) => !item.archived && (!requiredCurrency || item.currency.toUpperCase() === requiredCurrency.toUpperCase()));
          return <section className="r-ai-wallet-choice" key={id} aria-label={`${uiText("Chọn ví cho")} ${pending.title}`}>
            <b>{pending.title || "Giao dịch"}</b>
            <span>{pending.type === "income" ? uiText("Thu nhập") : uiText("Chi phí")}{pending.amount !== null && pending.currency ? ` · ${formatTransactionMoney(pending.amount, pending.currency)}` : ` · ${uiText("Chưa rõ số tiền hoặc tiền tệ")}`}</span>
            <div>{availableWallets.map((item) => <button type="button" key={item.id} onClick={() => chooseDraftWallet(id, item.id)}>{item.name === "." ? uiText("Ví chính") : item.name} · {item.currency}</button>)}</div>
            {!availableWallets.length && <small>{requiredCurrency ? ({en:`No active ${requiredCurrency} wallet. Create a matching wallet before confirming.`,vi:`Chưa có ví ${requiredCurrency} đang hoạt động. Hãy tạo ví cùng tiền tệ trước khi xác nhận.`,zh:`暂无可用的 ${requiredCurrency} 钱包，请先创建相同币种的钱包再确认。`}[resolveLanguage(state.settings.language)]) : ({en:"No active wallet. Create a wallet before recording transactions.",vi:"Hiện chưa có ví đang hoạt động. Hãy tạo ví trước khi ghi giao dịch.",zh:"暂无可用钱包，请先创建钱包再记录交易。"}[resolveLanguage(state.settings.language)])}</small>}
          </section>;
        })}
        {categoryResolutionDraftIds(messages, index, drafts).map((id) => {
          const pending = drafts.find((draft) => draft.id === id);
          if (!pending || uncertainDraftIds.includes(id)) return null;
          const walletCategoryNames = pending.wallet ? state.walletCategories?.[pending.wallet] : undefined;
          const options = state.categories.filter((name) => !state.categoryMeta[name]?.archived
            && name.toLocaleLowerCase("vi") !== "chưa được phân loại"
            && (state.categoryMeta[name]?.type || "expense") === pending.type
            && (!walletCategoryNames || walletCategoryNames.includes(name)));
          const similar = similarDraftCategories(newCategoryName, options);
          const chooseType = { en: "Is this an expense or income?", vi: "Đây là khoản chi hay khoản thu?", zh: "这是支出还是收入？" }[resolveLanguage(state.settings.language)];
          return <section className="r-ai-category-choice" key={id} aria-label={`${categoryFlowCopy.choose}: ${pending.title}`} aria-busy={busy || committing}>
            <div className="r-ai-category-choice-heading"><b>{pending.title || categoryFlowCopy.transaction}</b>{" "}<strong>{pending.amount !== null && pending.currency ? formatTransactionMoney(pending.amount, pending.currency) : "—"}</strong></div>
            <small>{pending.type ? `${pending.type === "income" ? categoryFlowCopy.income : categoryFlowCopy.expense} · ${categoryFlowCopy.choose}` : chooseType}</small>
            {(busy || committing) && <small role="status">{committing ? categoryFlowCopy.saving : categoryFlowCopy.processing}</small>}
            {!pending.type && <div className="r-ai-category-options" role="group" aria-label={chooseType}>
              <button type="button" disabled={busy || committing} onClick={() => selectDraftType(id, "expense")}>{categoryFlowCopy.expense}</button>
              <button type="button" disabled={busy || committing} onClick={() => selectDraftType(id, "income")}>{categoryFlowCopy.income}</button>
            </div>}
            {pending.type && <>
            <div className="r-ai-category-options" role="group" aria-label={`${uiText("Danh mục")} · ${pending.type === "income" ? uiText("Thu nhập") : uiText("Chi phí")}`}>
              {options.map((name) => <button type="button" key={name} aria-pressed={pending.category === name} className={pending.category === name ? "selected" : ""} disabled={busy || committing} onClick={() => selectDraftCategory(id, name)}>{state.categoryMeta[name]?.icon || "❓"} {resolveCategoryDisplayName(name, state.settings.language)}</button>)}
              {categoryFormDraftId !== id && <button type="button" style={{ borderStyle: "dashed", borderColor: "var(--r-teal, #12b8c4)", color: "var(--r-teal, #12b8c4)", fontWeight: 500 }} disabled={busy || committing} onClick={() => openCategoryCreation(id)}>{workspaceActionCopy[resolveLanguage(state.settings.language)].addCategory}</button>}
              {!options.length && categoryFormDraftId !== id && <span>{categoryFlowCopy.noOptions}</span>}
            </div>
            {pending.category && <small role="status">{categoryFlowCopy.selected}: {pending.category} · {categoryFlowCopy.notSaved}</small>}
            {pending.newCategory && <small role="status">{categoryFlowCopy.temporary}: “{pending.newCategory.name}” · {categoryFlowCopy.draftOnly}</small>}
            {categoryFormDraftId === id && <div className="r-ai-category-create">
              <label htmlFor={`new-chat-category-${id}`}>{categoryFlowCopy.name} · {pending.type === "income" ? categoryFlowCopy.income : categoryFlowCopy.expense}</label>
              <div className="r-ai-category-create-controls"><input id={`new-chat-category-${id}`} autoComplete="off" maxLength={100} value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCategoryError(""); }} placeholder={categoryFlowCopy.placeholder} disabled={busy || committing} /><button type="button" className="r-primary" disabled={!newCategoryName.trim() || busy || committing} onClick={() => stageChatCategory(id)}>{categoryFlowCopy.create}</button><button type="button" className="r-secondary" disabled={busy || committing} onClick={() => { setCategoryFormDraftId(null); setNewCategoryName(""); setCategoryError(""); }}>{categoryFlowCopy.cancel}</button></div>
              {categoryError && <small role="alert">{categoryError}</small>}
              {similar.length > 0 && <div className="r-ai-category-suggestions"><span>{categoryFlowCopy.similar}:</span>{similar.slice(0, 3).map((name) => <button type="button" key={name} disabled={busy || committing} onClick={() => { selectDraftCategory(id, name); setCategoryFormDraftId(null); setCategoryError(""); }}>{name}</button>)}</div>}
            </div>}
            <small className="r-ai-category-note">{categoryFlowCopy.savedOnConfirm}</small>
            </>}
          </section>;
        })}
        {message.draftIds?.map((id) => {
          if (messages.slice(index + 1).some(later => later.draftIds?.includes(id))) return null;
          const rawDraft = drafts.find((draft) => draft.id === id);
          if (!rawDraft) return null;
          const draft = validateDraftForState(rawDraft, state);
          const fundingIssue = draftFundingIssues([draft], state, today())[0]?.issue;
          const valid = readyDrafts([draft], state).length === 1 && !fundingIssue;
          const draftWallet = state.wallets.find((item) => item.id === draft.wallet && !item.archived);
          const labels: Record<string, string> = { amount: "số tiền", type: "loại giao dịch", category: "danh mục", date: "ngày", wallet: "ví/tiền tệ" };
          const needsReview = draft.needsReview.map((field) => uiText(labels[field] || field));
          return <article key={id} className="r-chat-record r-ai-draft-card">
            <div className="r-ai-draft-heading"><small>{uiText("Bản nháp · ")}{draft.type === "income" ? uiText("Thu nhập") : draft.type === "expense" ? uiText("Chi phí") : uiText("Chưa rõ loại")}</small><button type="button" className="r-icon-button" aria-label={uiText("Bỏ bản nháp")} disabled={committing || uncertainDraftIds.includes(id)} onClick={() => removeDraft(id)}><X size={16} /></button></div>
            {receiptImageUrls[id] && <div className="r-ai-receipt-thumb" role="img" aria-label={uiText("Ảnh hóa đơn đính kèm bản nháp")} style={{ backgroundImage: `url("${receiptImageUrls[id]}")` }} />}
            <div className="r-ai-draft-summary"><b>{draft.title.trim() || uiText("Chưa có mô tả")}</b>{" "}<strong>{draft.amount !== null && draft.currency ? formatTransactionMoney(draft.amount, draft.currency) : uiText("Chưa rõ số tiền/tiền tệ")}</strong></div>
            <p className="r-ai-draft-details">{resolveCategoryDisplayName(draft.category || draft.newCategory?.name, state.settings.language, uiText("Chưa chọn danh mục"))} · {draft.date || uiText("Chưa rõ ngày")} · {draftWallet ? `${resolveWalletDisplayName(draftWallet.name, state.settings.language)} (${draftWallet.currency})` : draft.currency ? `${uiText("Chưa chọn ví")} · ${draft.currency}` : uiText("Chưa chọn ví/tiền tệ")}</p>
            <DraftAmountWarnings id={`draft-funding-${id}`} warnings={draftAmountWarnings(draft, state, today())} fundingIssue={fundingIssue} language={resolveLanguage(state.settings.language)} />
            {needsReview.length > 0 && <small className="r-ai-draft-review">{uiText("Cần xem lại: ")}{needsReview.join(", ")}</small>}
            {draft.needsReview.includes("wallet") && !messages.some((item) => item.walletChoiceDraftIds?.includes(id)) && <label className="r-ai-draft-details">
              {{ en: "Payment wallet", vi: "Ví thanh toán", zh: "付款钱包" }[resolveLanguage(state.settings.language)]}
              <select aria-label={{ en: "Choose payment wallet", vi: "Chọn ví thanh toán", zh: "选择付款钱包" }[resolveLanguage(state.settings.language)]} value="" disabled={busy || committing} onChange={(event) => chooseDraftWallet(id, event.target.value)}>
                <option value="">{{ en: "Choose a wallet", vi: "Chọn ví", zh: "选择钱包" }[resolveLanguage(state.settings.language)]}</option>
                {state.wallets.filter((item) => !item.archived && (!draft.currency || item.currency.toUpperCase() === draft.currency.toUpperCase())).map((item) => <option key={item.id} value={item.id}>{item.name === "." ? uiText("Ví chính") : item.name} · {item.currency}</option>)}
              </select>
            </label>}
            <div className="r-two-options"><button type="button" className="r-secondary" disabled={committing || uncertainDraftIds.includes(id)} onClick={() => setEditingDraftId(id)}>{uiText("Chỉnh sửa")}</button><button type="button" className="r-primary" disabled={(!valid && !uncertainDraftIds.includes(id)) || committing} onClick={() => confirmDrafts([id])}>{uncertainDraftIds.includes(id) ? { vi: "Kiểm tra lưu lại", en: "Check save again", zh: "重新检查保存" }[resolveLanguage(state.settings.language)] : uiText("Xác nhận")}</button></div>
            {uncertainDraftIds.includes(id) && <small role="status">{workspaceSaveErrorMessage(null, resolveLanguage(state.settings.language))}</small>}
            {needsReview.length > 0 && <button type="button" className="r-ai-clarify-button" onClick={() => { setClarifyingDraftId(id); setFocusedDraftId(id); setText(""); }}>{uiText("Trả lời để bổ sung thông tin")}</button>}
            {!valid && !fundingIssue && <small className="r-ai-draft-review">{uiText("Hãy bổ sung các thông tin còn thiếu trước khi xác nhận.")}</small>}
          </article>;
        })}
      </div>)}
      {busy && <div className="r-chat-thinking" role="status" aria-label={uiText("Đang phân tích giao dịch")}><span /><span /><span /></div>}
    </div><div className="r-chat-bottom"><input ref={fileInput} className="sr-only" type="file" aria-label={uiText("Chọn ảnh hóa đơn")} accept="image/jpeg,image/png,image/webp,image/heic,image/heif" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readReceipt(file); }} /><form className="r-chat-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}><input aria-label={uiText("Nhập giao dịch")} placeholder={clarifyingDraftId ? uiText("Trả lời câu hỏi để bổ sung bản nháp…") : uiText("ví dụ: hôm qua ăn sáng 30k, trưa 50k")} value={text} onChange={(e) => setText(e.target.value)} />{text.trim() && !listening ? <button disabled={busy || transferBusy || transcribing} aria-label={uiText("Gửi tin nhắn")}><Send size={22} /></button> : <><button type="button" disabled={busy || transferBusy || transcribing} aria-pressed={listening} aria-label={listening ? uiText("Dừng ghi âm") : uiText("Ghi bằng giọng nói")} title={listening ? uiText("Dừng ghi âm") : uiText("Nói để chép lời vào ô chat")} onClick={() => { if (listening) recorder.current?.stop(); else { setVoiceError(""); void startVoice(); } }}>{listening ? <Square size={18} fill="currentColor" aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}</button><button type="button" disabled={busy || transferBusy || transcribing} aria-label={uiText("Thêm ảnh hóa đơn")} onClick={() => fileInput.current?.click()}><Camera size={22} /></button></>}</form>{(listening || transcribing || voiceError) && <p className="r-chat-voice-status" role="status">{listening ? uiText("Đang nghe… bấm nút vuông để dừng.") : transcribing ? uiText("Đang nhận diện lời nói…") : uiText(voiceError)}</p>}<button type="button" className="r-memory-button" onClick={() => setModal("memory")}>{uiText("Bộ nhớ của FinBridge")}</button></div>
    {modal === "resetChat" && <Modal title={uiText("Xóa hội thoại?")} onClose={close}><div className="r-form"><p>{uiText("Lịch sử chat và các bản nháp chưa xác nhận sẽ bị xóa. Giao dịch đã xác nhận vẫn được giữ.")}</p><div className="r-two-options"><button type="button" className="r-secondary" onClick={close}>{uiText("Quay lại")}</button><button type="button" className="r-danger" onClick={resetConversation}>{uiText("Xóa hội thoại")}</button></div></div></Modal>}
    {modal === "memory" && <Modal title={uiText("Bộ nhớ của FinBridge")} sheet onClose={close}><p>{uiText("Hãy dạy FinBridge quy tắc của bạn để FinBridge sắp xếp giao dịch theo cách bạn muốn.")}</p><form className="r-rule-input" onSubmit={(e) => { e.preventDefault(); if (rule.trim()) updateState((s) => ({ ...s, rules: [...s.rules, rule.trim()] })); setRule(""); }}><input placeholder={uiText("Nhập quy tắc của bạn vào đây...")} aria-label={uiText("Quy tắc")} value={rule} onChange={(e) => setRule(e.target.value)} /><button className="r-primary" aria-label={uiText("Thêm quy tắc")}><Plus /></button></form><small>{uiText("Ví dụ:")}<br />{uiText("- ăn tối với bạn bè được phân loại là giải trí")}<br />{uiText("- thể thao luôn được xếp vào danh mục sức khỏe")}<br />{uiText("- cho thuê được xếp vào danh mục nhà ở")}</small>{state.rules.length ? state.rules.map((r, i) => <div key={i} className="r-toggle-row"><span>{r}</span><button className="r-icon-button" aria-label={uiText("Xóa quy tắc")} onClick={() => updateState((s) => ({ ...s, rules: s.rules.filter((_, index) => i !== index) }))}><X size={18} /></button></div>) : <div className="r-no-rules"><b>{uiText("Chưa có quy tắc nào")}</b><p>{uiText("Thêm một quy tắc ở trên để dạy FinBridge cách phân loại giao dịch của bạn.")}</p></div>}<div className="r-toggle-row"><span>{uiText("Tự động cập nhật bộ nhớ")}<small>{uiText("FinBridge lưu quy tắc khi bạn sửa danh mục.")}</small></span><Toggle checked={Boolean(state.settings.autoMemory)} label={uiText("Tự động cập nhật bộ nhớ")} onChange={(v) => updateState((s) => ({ ...s, settings: { ...s.settings, autoMemory: v } }))} /></div></Modal>}
    {modal === "transfer" && <TransferForm onClose={close} />}
    {editingDraft && <Modal title={uiText("Chỉnh sửa bản nháp")} sheet onClose={() => setEditingDraftId(null)}><div className="r-form">
      <p>{uiText("Những thay đổi này chỉ sửa bản nháp. Giao dịch chỉ được lưu khi bạn bấm “Xác nhận” trong câu trả lời.")}</p>
      <label>{uiText("Mô tả")}<input aria-label={uiText("Mô tả bản nháp")} maxLength={160} value={editingDraft.title} onChange={(event) => editDraft(editingDraft.id, { title: event.target.value })} /></label>
      <label>{uiText("Số tiền")}<input aria-label={uiText("Số tiền bản nháp")} type="text" inputMode="decimal" value={editingDraft.amount !== null && editingDraft.amount !== undefined ? formatCurrencyInput(editingDraft.amount) : ""} onChange={(event) => editDraft(editingDraft.id, { amount: parseCurrencyInput(event.target.value) || null })} onBlur={(event) => editDraft(editingDraft.id, { amount: parseCurrencyInput(event.target.value) || null })} /></label>
      <Field label={uiText("Loại")}><select aria-label={uiText("Loại bản nháp")} value={editingDraft.type || ""} onChange={(event) => editDraft(editingDraft.id, { type: event.target.value ? event.target.value as "expense" | "income" : null, category: null })}><option value="">{uiText("Chọn loại")}</option><option value="expense">{uiText("Chi phí")}</option><option value="income">{uiText("Thu nhập")}</option></select></Field>
      <Field label={uiText("Danh mục")}><select aria-label={uiText("Danh mục bản nháp")} value={editingDraft.category || ""} onChange={(event) => editDraft(editingDraft.id, { category: event.target.value || null })}><option value="">{uiText("Chọn danh mục")}</option>{state.categories.filter((name) => !state.categoryMeta[name]?.archived && (state.categoryMeta[name]?.type || "expense") === editingDraft.type).map((name) => <option key={name} value={name}>{resolveCategoryDisplayName(name, state.settings.language)}</option>)}</select></Field>
      {!addingCategory ? <button type="button" className="r-ai-clarify-button" onClick={() => { setAddingCategory(true); setCategoryError(""); }}>{uiText("+ Thêm danh mục mới")}</button> : <div className="r-ai-new-category"><input aria-label={uiText("Tên danh mục mới")} maxLength={100} placeholder={uiText("Ví dụ: Y tế, Đi lại")} value={newCategoryName} onChange={(event) => { setNewCategoryName(event.target.value); setCategoryError(""); }} /><button type="button" className="r-primary" disabled={!newCategoryName.trim()} onClick={createDraftCategory}>{uiText("Tạo và chọn")}</button><button type="button" className="r-secondary" onClick={() => { setAddingCategory(false); setNewCategoryName(""); setCategoryError(""); }}>{uiText("Hủy")}</button>{categoryError && <small role="alert">{categoryError}</small>}{similarDraftCategories(newCategoryName, state.categories.filter((name) => !state.categoryMeta[name]?.archived && (state.categoryMeta[name]?.type || "expense") === editingDraft.type)).map((name) => <button type="button" key={name} className="r-secondary" onClick={() => { editDraft(editingDraft.id, { category: name }); setAddingCategory(false); setNewCategoryName(""); setCategoryError(""); }}>{uiText("Dùng danh mục gần giống: ")}{name}</button>)}</div>}
      <Field label={uiText("Ngày")}><input aria-label={uiText("Ngày bản nháp")} type="date" value={editingDraft.date || ""} onChange={(event) => editDraft(editingDraft.id, { date: event.target.value || null })} /></Field>
      <Field label={uiText("Ví")}><select aria-label={uiText("Ví bản nháp")} value={editingDraft.wallet || ""} onChange={(event) => editDraft(editingDraft.id, { wallet: event.target.value || null })}><option value="">{uiText("Chọn ví")}</option>{state.wallets.filter((item) => !item.archived).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}</select></Field>
      <div className="r-two-options"><button type="button" className="r-secondary" onClick={() => setEditingDraftId(null)}>{uiText("Đóng")}</button><button type="button" className="r-primary" onClick={() => setEditingDraftId(null)}>{uiText("Xong, quay lại xem trước")}</button></div>
    </div></Modal>}
  </div>;
}
export function RecurringPage({ navigate }: { navigate: (screen: string) => void }) {
  const uiText = useAppUiText();
  const state = useAppState();
  const [adding, setAdding] = useState(false);
  return <div className="r-tool-page"><PageHeader title={uiText("Giao dịch định kỳ theo lịch trình")} close onBack={() => navigate("addTransactionChatMode")} />{state.recurring.length === 0 ? <EmptyState title={uiText("Chưa có giao dịch định kỳ nào được lên lịch.")} text={uiText("Bắt đầu thêm các giao dịch định kỳ của bạn ngay bây giờ!")} className="r-tool-empty" /> : state.recurring.map((t) => <div className="r-setting-row" key={t.id}><span>{t.title}<small>{t.date} · {t.category}</small></span><b>{money(t.amount)}</b><button aria-label={uiText("Xóa lịch")} className="r-icon-button" onClick={() => updateState((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== t.id) }))}><X /></button></div>)}<button className="r-fab r-fab-wide r-fab-no-nav" onClick={() => setAdding(true)}><Plus size={20} />{uiText("Thêm Định Kỳ")}</button>{adding && <Modal title={uiText("Thêm Giao Dịch Định Kỳ")} onClose={() => setAdding(false)}><TransactionForm navigate={navigate} recurring onClose={() => setAdding(false)} /></Modal>}</div>;
}
function TransferForm({ onClose }: { onClose: () => void }) {
  const uiText = useAppUiText();
  const state = useAppState();
  const [targetType, setTargetType] = useState("Chuyển khoản");
  const [wallet, setWallet] = useState(state.wallets[0].id);
  const [target, setTarget] = useState(state.wallets[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("2026-10-12");
  const [error, setError] = useState("");
  return <Modal title={uiText("Di chuyển Quỹ")} sheet onClose={onClose}><p>{uiText("Chuyển tiền đến ví khác")}</p><div className="r-type-pills r-align-left">{["Chuyển khoản", "Tiết kiệm", "Món nợ", "Lend/Borrow", "Thử thách"].map((type) => <button type="button" key={type} className={type === targetType ? "active" : ""} onClick={() => { setTargetType(type); setTarget(""); }}>{type}</button>)}</div><form className="r-form" onSubmit={(e) => { e.preventDefault(); const parsedAmount = parseCurrencyInput(amount); if (targetType === "Chuyển khoản" && (!target || wallet === target)) { setError("Vui lòng chọn hai ví khác nhau."); return; } if (!target) { setError("Vui lòng tạo mục tiêu trước khi chuyển tiền."); return; } updateState((s) => ({ ...s, transactions: [...s.transactions, { id: crypto.randomUUID(), type: "transfer", title, amount: parsedAmount, category: targetType, date, wallet, targetWallet: targetType === "Chuyển khoản" ? target : undefined, note }], goals: targetType === "Chuyển khoản" ? s.goals : s.goals.map((g) => g.id === target ? { ...g, saved: g.saved + parsedAmount } : g) })); onClose(); }}><Field label={uiText("Chọn ví")}><select value={wallet} onChange={(e) => setWallet(e.target.value)}>{state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field><Field label={uiText("Đến ví")}><select value={target} onChange={(e) => setTarget(e.target.value)} required><option value="">{uiText("Chọn")}</option>{targetType === "Chuyển khoản" ? state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>) : state.goals.filter((g) => g.kind === tools.find((t) => t.name === targetType || (targetType === "Lend/Borrow" && t.path === "loanList"))?.path).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field><input aria-label={uiText("Mục")} placeholder={uiText("Mục")} value={title} onChange={(e) => setTitle(e.target.value)} /><input aria-label={uiText("Số tiền")} placeholder={"Số tiền (" + currencySymbol(state.wallets.find((w) => w.id === wallet)?.currency || "USD") + ")"} required type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} onBlur={() => setAmount(formatCurrencyInput(amount))} /><Field label={uiText("Ngày")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><textarea aria-label={uiText("Ghi chú")} placeholder={uiText("Ghi chú")} value={note} onChange={(e) => setNote(e.target.value)} />{error && <p className="r-expense" role="alert">{error}</p>}<button className="r-primary">{uiText("Lưu")}</button></form></Modal>;
}
