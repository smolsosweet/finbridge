"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ledgerDateKey } from "./calendarLedger";
import { Camera, Mic, Send, Settings, Plus, ArrowRightLeft, X, Trash2 } from "lucide-react";
import { EmptyState, Field, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { currencySymbol, money, today, updateState, useAppState, workspaceOwner, workspacePersistence, type AppState, type ChatMessage, type Transaction } from "./store";
import { createTimeoutTransactionDraft, editDraftById, inferDraftCategory, isNewTransactionMessage, matchDraftCategoryAnswer, normalizeVietnameseMessage, readyDrafts, removeDraftById, requestedDraftCategory, validateAndCommitDrafts, validateDraftForState, type TransactionDraft } from "@/lib/transaction-drafts";
import { resolveUniqueCurrencyWallet } from "@/lib/transaction-currency";
import { answerFinancialQuery, type FinancialAction } from "@/lib/financial-chat";
import { localPlanReply, modelHistory } from "@/lib/chat-local-plan";
import planStyles from "./FinancialOutlook.module.css";
import { tools } from "./Tools";
import { resolveLanguage, resolveWalletDisplayName, resolveCategoryDisplayName, type AppLanguage } from "@/lib/i18n";
import { findTransactionsForDeletion, type TransactionDeletionCriteria } from "@/lib/transaction-deletion";

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

function categoryNameFromReply(value: string) {
  const name = value.trim().replace(/^(?:danh mục|category)(?:\s+(?:là|mới|:))?\s*/i, "").replace(/[.!?]+$/, "").trim();
  if (/^(?:không biết|chưa rõ|i don'?t know|not sure)$/i.test(name)) return null;
  return name.length <= 60 && /^[\p{L}\p{N}][\p{L}\p{N}\s&'’().-]*$/u.test(name) ? name : null;
}

function getBalanceAnswer(message: string, state: AppState, selectedWalletId: string) {
  const question = normalizeVietnameseMessage(message);
  if (!/(con bao nhieu|so du|bao nhieu tien|balance|how much.*(wallet|account))/.test(question)) return null;
  const mentionedWallet = state.wallets.find((wallet) => wallet.name.trim() !== "." && question.includes(normalizeVietnameseMessage(wallet.name)));
  const selectedWallet = state.wallets.find((wallet) => wallet.id === selectedWalletId && !wallet.archived);
  const wallets = mentionedWallet ? [mentionedWallet] : selectedWallet ? [selectedWallet] : state.wallets.filter((wallet) => !wallet.archived);
  if (!wallets.length) return "Mình chưa thấy ví đang hoạt động để tính số dư.";
  return wallets.map((wallet) => {
    const income = state.transactions.filter((transaction) => transaction.wallet === wallet.id && transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
    const expense = state.transactions.filter((transaction) => transaction.wallet === wallet.id && transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
    const transferOut = state.transactions.filter((transaction) => transaction.wallet === wallet.id && transaction.type === "transfer").reduce((sum, transaction) => sum + transaction.amount, 0);
    const transferIn = state.transactions.filter((transaction) => transaction.targetWallet === wallet.id && transaction.type === "transfer").reduce((sum, transaction) => sum + transaction.amount, 0);
    const balance = wallet.initial + income - expense - transferOut + transferIn;
    return `${wallet.name === "." ? "Ví đang chọn" : `Ví ${wallet.name}`} hiện có ${money(balance, wallet.currency)}. Số dư đầu kỳ ${money(wallet.initial, wallet.currency)}, thu ${money(income, wallet.currency)}, chi ${money(expense, wallet.currency)}, chuyển vào ${money(transferIn, wallet.currency)} và chuyển ra ${money(transferOut, wallet.currency)}.`;
  }).join("\n");
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
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
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
    if (Number(amount) <= 0) return;
    const item: Transaction = {
      ...existing,
      id: existing?.id || crypto.randomUUID(),
      type,
      title,
      amount: Number(amount),
      date,
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
        min="0.01"
        step="any"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
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
  const state = useAppState();
  const chatKey = `finbridge:transaction-chat:${workspaceOwner() || "demo"}`;
  const [text, setText] = useState("");
  const [wallet, setWallet] = useState(state.wallets.find((item) => !item.archived)?.id || "");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Xin chào!👋 Hãy mô tả giao dịch; tôi sẽ tạo bản nháp để bạn kiểm tra trước khi lưu." }]);
  const [drafts, setDrafts] = useState<TransactionDraft[]>([]);
  const [clarifyingDraftId, setClarifyingDraftId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [modal, setModal] = useState("");
  const [rule, setRule] = useState("");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const recorderStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const receiptImages = useRef<Record<string, string>>({});
  const failedReceipt = useRef<File | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const commitLock = useRef(false);
  const aiRequestLock = useRef(false);
  const deletionLocks = useRef(new Set<string>());
  const close = () => { recorder.current?.stop(); setListening(false); setModal(""); };
  useEffect(() => () => {
    const activeRecorder = recorder.current;
    if (activeRecorder && activeRecorder.state !== "inactive") {
      activeRecorder.onstop = null;
      activeRecorder.stop();
    }
    recorderStream.current?.getTracks().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    try {
      const raw = state.transactionChat || workspacePersistence() === "database" ? null : localStorage.getItem(chatKey);
      const saved = state.transactionChat || (raw ? JSON.parse(raw) as { messages?: ChatMessage[]; drafts?: TransactionDraft[]; clarifyingDraftId?: string | null } : null);
      if (saved) {
        if (Array.isArray(saved.messages) && Array.isArray(saved.drafts)) {
          const restoredDrafts = saved.drafts.map((draft) => validateDraftForState(draft, state));
          const unresolved = restoredDrafts.filter((draft) => draft.needsReview.length > 0);
          const needsWalletChoice = new Set(restoredDrafts.filter((draft) => draft.needsReview.includes("wallet")).map((draft) => draft.id));
          const labels: Record<string, string> = { amount: "số tiền", type: "khoản thu hay chi", category: "danh mục", date: "ngày giao dịch", wallet: "ví hoặc tiền tệ" };
          const unresolvedLabels = [...new Set(unresolved.flatMap((draft) => draft.needsReview))].map((field) => labels[field] || field);
          const restoredMessages = saved.messages.map((message) => {
            const movedToWalletChoice = message.draftIds?.filter((id) => needsWalletChoice.has(id)) || [];
            if (message.role !== "assistant" || !movedToWalletChoice.length) return message.role === "assistant" && /chưa xác định được/i.test(message.text) ? { ...message, draftIds: undefined } : message;
            const remainingDraftIds = message.draftIds?.filter((id) => !needsWalletChoice.has(id));
            return { ...message, draftIds: remainingDraftIds?.length ? remainingDraftIds : undefined, walletChoiceDraftIds: [...new Set([...(message.walletChoiceDraftIds || []), ...movedToWalletChoice])], text: "Chọn ví để tiếp tục tạo bản nháp cho giao dịch này." };
          });
          const promptedWalletIds = new Set(restoredMessages.flatMap((message) => message.walletChoiceDraftIds || []));
          const unpromptedWalletIds = [...needsWalletChoice].filter((id) => !promptedWalletIds.has(id));
          if (unpromptedWalletIds.length) restoredMessages.push({ role: "assistant", text: "Bạn muốn ghi giao dịch này vào ví nào? Chọn ví bên dưới để tiếp tục.", walletChoiceDraftIds: unpromptedWalletIds });
          const alreadyAsked = restoredMessages.some((message) => message.role === "assistant" && /chưa xác định được/i.test(message.text) && unresolvedLabels.every((label) => message.text.includes(label)))
            || restoredMessages.some((message) => message.walletChoiceDraftIds?.some((id) => unresolved.some((draft) => draft.id === id)) || message.categoryChoiceDraftIds?.some((id) => unresolved.some((draft) => draft.id === id)));
          for (let index = 0; index < restoredMessages.length - 1; index++) {
            const question = restoredMessages[index];
            const oldError = restoredMessages[index + 1];
            if (question.role !== "user" || oldError.role !== "assistant" || !/AI trả về dữ liệu chưa hợp lệ/i.test(oldError.text)) continue;
            const recoveredAnswer = getBalanceAnswer(question.text, state, wallet);
            if (recoveredAnswer) restoredMessages[index + 1] = { ...oldError, text: recoveredAnswer };
          }
          setMessages(alreadyAsked || !unresolved.length ? restoredMessages : [...restoredMessages, {
            role: "assistant",
            text: clarificationQuestion([...new Set(unresolved.flatMap((draft) => draft.needsReview))]),
          }]);
          setDrafts(restoredDrafts);
          setClarifyingDraftId(needsWalletChoice.size ? null : saved.clarifyingDraftId && unresolved.some((draft) => draft.id === saved.clarifyingDraftId) ? saved.clarifyingDraftId : unresolved[0]?.id || null);
        }
      }
    } catch { /* Ignore a damaged chat snapshot; the financial workspace is stored separately. */ }
    setSessionLoaded(true);
  // Load once for the current signed-in workspace.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatKey]);
  useEffect(() => {
    if (!sessionLoaded) return;
    const transactionChat = { messages, drafts, clarifyingDraftId };
    try { updateState((current) => ({ ...current, transactionChat })); } catch { /* Chat remains usable if workspace storage is unavailable. */ }
  }, [sessionLoaded, messages, drafts, clarifyingDraftId]);
  useEffect(() => {
    if (!sessionLoaded) return;
    const container = messagesRef.current;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages.length, sessionLoaded]);
  useEffect(() => {
    if (!state.wallets.some((item) => item.id === wallet && !item.archived)) {
      setWallet(state.wallets.find((item) => !item.archived)?.id || "");
    }
  }, [state.wallets, wallet]);
  function resetConversation() {
    if (workspacePersistence() !== "database") localStorage.removeItem(chatKey);
    receiptImages.current = {};
    failedReceipt.current = null;
    setMessages([{ role: "assistant", text: "Xin chào!👋 Hãy mô tả giao dịch; tôi sẽ tạo bản nháp để bạn kiểm tra trước khi lưu." }]);
    setDrafts([]); setClarifyingDraftId(null); setModal(""); setText("");
  }
  function cancelTransactionDeletion(confirmationId: string) {
    if (deletionLocks.current.has(confirmationId)) return;
    deletionLocks.current.add(confirmationId);
    setMessages((previous) => previous.map((message) => message.transactionDeletion?.confirmationId === confirmationId
      ? { ...message, transactionDeletion: { ...message.transactionDeletion, status: "cancelled" } }
      : message));
  }
  function selectTransactionForDeletion(confirmationId: string, transactionId: string, selected: boolean) {
    if (deletionLocks.current.has(confirmationId)) return;
    setMessages((previous) => previous.map((message) => {
      const deletion = message.transactionDeletion;
      if (deletion?.confirmationId !== confirmationId || deletion.status !== "pending") return message;
      const selectedIds = new Set(deletion.selectedIds);
      if (selected) selectedIds.add(transactionId); else selectedIds.delete(transactionId);
      return { ...message, transactionDeletion: { ...deletion, selectedIds: [...selectedIds] } };
    }));
  }
  function confirmTransactionDeletion(confirmationId: string) {
    if (deletionLocks.current.has(confirmationId)) return;
    const confirmation = messages.find((message) => message.transactionDeletion?.confirmationId === confirmationId)?.transactionDeletion;
    if (!confirmation || confirmation.status !== "pending" || confirmation.selectedIds.length === 0) return;
    deletionLocks.current.add(confirmationId);
    let deletedCount = 0;
    try {
      const selectedIds = new Set(confirmation.selectedIds);
      updateState((current) => {
        deletedCount = current.transactions.filter((transaction) => selectedIds.has(transaction.id)).length;
        return { ...current, transactions: current.transactions.filter((transaction) => !selectedIds.has(transaction.id)) };
      });
      setMessages((previous) => [...previous.map((message) => message.transactionDeletion?.confirmationId === confirmationId
        ? { ...message, transactionDeletion: { ...message.transactionDeletion, status: "confirmed" as const, deletedCount } }
        : message), {
        role: "assistant",
        text: deletedCount ? `Đã xóa ${deletedCount} giao dịch theo yêu cầu. Số dư, lịch sử và ngân sách đã được cập nhật.` : "Các giao dịch này không còn trong dữ liệu nên không có giao dịch nào bị xóa.",
        localOnly: true,
      }]);
    } catch {
      deletionLocks.current.delete(confirmationId);
      setMessages((previous) => [...previous, { role: "assistant", text: "Chưa xóa được giao dịch do lỗi lưu dữ liệu. Giao dịch vẫn được giữ nguyên; hãy thử lại." }]);
    }
  }
  async function send(value: string) {
    const message = value.trim();
    if (!message || busy || aiRequestLock.current) return;
    const deletionRequest = /\b(?:xoa|delete|remove|clear)\b/.test(normalizeVietnameseMessage(message));
    const categoryPrompt = [...messages].reverse().find((item) => item.role === "assistant" && item.categoryChoiceDraftIds?.length);
    if (categoryPrompt?.categoryChoiceDraftIds?.length && !deletionRequest) {
      const draftId = categoryPrompt.categoryChoiceDraftIds[0];
      const draft = drafts.find((item) => item.id === draftId);
      const categoryName = categoryNameFromReply(message);
      setText("");
      setMessages((previous) => [...previous, { role: "user", text: message }]);
      if (!draft || !categoryName) {
        setMessages((previous) => [...previous, { role: "assistant", text: `Nhắn tên danh mục muốn dùng cho “${draft?.title || "giao dịch này"}”, ví dụ: “Giáo dục”.` }]);
        return;
      }
      const existed = state.categories.some((category) => category.toLocaleLowerCase("vi") === categoryName.toLocaleLowerCase("vi"));
      if (!assignNewCategory(draftId, categoryName)) return;
      const remaining = categoryPrompt.categoryChoiceDraftIds.slice(1);
      if (remaining.length) setClarifyingDraftId(null);
      setMessages((previous) => previous.map((item) => {
        if (item !== categoryPrompt) return item;
        return {
          ...item,
          categoryChoiceDraftIds: remaining.length ? remaining : undefined,
          draftIds: [...new Set([...(item.draftIds || []), draftId])],
          text: remaining.length
            ? `${existed ? "Đã gán" : "Đã thêm"} danh mục “${categoryName}”. Nhắn tên danh mục cho “${drafts.find((entry) => entry.id === remaining[0])?.title || "giao dịch tiếp theo"}”.`
            : item.walletChoiceDraftIds?.length
              ? `${existed ? "Đã gán" : "Đã thêm"} danh mục “${categoryName}”. Chọn ví cho các giao dịch còn lại.`
              : `${existed ? "Đã gán" : "Đã thêm"} danh mục “${categoryName}”. ${draft.needsReview.some((field) => field !== "category") ? `Bản nháp còn thiếu thông tin. ${clarificationQuestion(draft.needsReview.filter((field) => field !== "category"))}` : "Đây là bản nháp; kiểm tra rồi xác nhận để lưu."}`,
        };
      }));
      return;
    }
    const activeDraftId = clarifyingDraftId;
    const activeDraft = activeDraftId ? drafts.find((draft) => draft.id === activeDraftId) : undefined;
    const exactCategory = activeDraft ? matchDraftCategoryAnswer(message, activeDraft, state) : null;
    if (activeDraft && exactCategory && !deletionRequest) {
      const updatedDrafts = editDraftById(drafts, activeDraft.id, { category: exactCategory }, state);
      const updated = updatedDrafts.find((draft) => draft.id === activeDraft.id);
      setText(""); setDrafts(updatedDrafts);
      setClarifyingDraftId(updated && updated.needsReview.length ? updated.id : null);
      setMessages((previous) => [...previous, { role: "user", text: message }, { role: "assistant", text: `Đã chọn danh mục “${exactCategory}”. Bản nháp chưa được lưu; hãy kiểm tra rồi xác nhận.` }]);
      return;
    }
    const newCategoryRequest = activeDraft && activeDraft.needsReview.includes("category") ? requestedDraftCategory(message) || categoryNameFromReply(message) : null;
    if (activeDraft && newCategoryRequest && !deletionRequest) {
      setText("");
      setMessages((previous) => [...previous, { role: "user", text: message }]);
      if (assignNewCategory(activeDraft.id, newCategoryRequest)) {
        const otherMissing = activeDraft.needsReview.filter((field) => field !== "category");
        setMessages((previous) => [...previous, { role: "assistant", text: `Đã ${state.categories.some((category) => category.toLocaleLowerCase("vi") === newCategoryRequest.toLocaleLowerCase("vi")) ? "gán" : "thêm"} danh mục “${newCategoryRequest}”. ${otherMissing.length ? `Bản nháp còn thiếu thông tin. ${clarificationQuestion(otherMissing)}` : "Đây là bản nháp; kiểm tra rồi xác nhận để lưu nhé."}`, draftIds: [activeDraft.id] }]);
      }
      return;
    }
    setText(""); setBusy(true); aiRequestLock.current = true;
    if (clarifyingDraftId && (!activeDraftId || isNewTransactionMessage(message))) setClarifyingDraftId(null);
    setMessages((previous) => [...previous, { role: "user", text: message }]);
    const batchId = crypto.randomUUID();
    try {
      const response = await fetch("/api/ai/assistant", {
        signal: AbortSignal.timeout(30_000),
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          message,
          today: today(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          selectedWalletId: wallet,
          ...(activeDraft ? { pendingDraft: activeDraft } : {}),
          history: modelHistory([...messages, { role: "user" as const, text: message }]),
          wallets: state.wallets.filter((item) => !item.archived).map(({ id, name, currency }) => ({ id, name, currency })),
          categories: state.categories.filter((name) => !state.categoryMeta[name]?.archived).flatMap((name) => {
            const type = state.categoryMeta[name]?.type || "expense";
            return type === "income" || type === "expense" ? [{ name, type }] : [];
          }),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== "object" || !Array.isArray((result as { drafts?: unknown }).drafts) || typeof (result as { intent?: unknown }).intent !== "string") {
        const apiError = result && typeof result === "object" && typeof (result as { message?: unknown }).message === "string" ? (result as { message: string }).message : "Không thể phân tích nội dung. Vui lòng thử lại.";
        throw new Error(apiError);
      }
      const returned = (result as { drafts: unknown[] }).drafts;
      const validShape = returned.every((item) => item && typeof item === "object" && typeof (item as TransactionDraft).id === "string" && typeof (item as TransactionDraft).title === "string" && Array.isArray((item as TransactionDraft).needsReview));
      if (!validShape || returned.length > 20) throw new Error("AI trả về dữ liệu chưa hợp lệ. Vui lòng thử lại.");
      const ai = result as { intent: string; action?: string; walletId?: string | null; scope?: "selected" | "all"; periodStart?: string | null; periodEnd?: string | null; category?: string | null; searchTerm?: string | null; transactionType?: "expense" | "income" | null; reply?: string; deletion?: TransactionDeletionCriteria };
      if (ai.intent === "delete_transactions") {
        const deletion = ai.deletion;
        if (!deletion || deletion.scope === "none") {
          setMessages((previous) => [...previous, { role: "assistant", text: "Bạn muốn xóa giao dịch nào? Hãy cho biết tên, số tiền, ngày hoặc danh mục; dữ liệu chưa bị thay đổi." }]);
          return;
        }
        const matches = findTransactionsForDeletion(state.transactions, deletion);
        const fallbackCriteria = { ...deletion, searchTerm: null };
        const candidates = matches.length ? matches : findTransactionsForDeletion(state.transactions, fallbackCriteria);
        if (!candidates.length) {
          setMessages((previous) => [...previous, { role: "assistant", text: deletion.scope === "all" && !state.transactions.length
            ? "Hiện chưa có giao dịch nào để xóa."
            : "Mình chưa tìm thấy giao dịch khớp yêu cầu. Hãy nêu rõ tên, số tiền, ngày hoặc danh mục; chưa có dữ liệu nào bị xóa." }]);
          return;
        }
        const ids = candidates.map((transaction) => transaction.id);
        const all = deletion.scope === "all" && !deletion.amount && !deletion.walletId && !deletion.periodStart && !deletion.periodEnd && !deletion.category && !deletion.searchTerm && !deletion.type;
        const exactMatch = matches.length > 0;
        const selectByDefault = exactMatch && (deletion.scope === "all" || matches.length === 1);
        const text = all
          ? `Bạn yêu cầu xóa toàn bộ ${candidates.length} giao dịch. Hãy kiểm tra danh sách và xác nhận bên dưới; hiện chưa giao dịch nào bị xóa.`
          : exactMatch
            ? `Mình tìm thấy ${matches.length} giao dịch khớp yêu cầu. Hãy chọn đúng giao dịch cần xóa rồi xác nhận; hiện chưa giao dịch nào bị xóa.`
            : `Mình chưa khớp được tên giao dịch, nhưng có ${candidates.length} giao dịch trong khoảng ngày bạn nói. Hãy chọn đúng giao dịch; chưa có dữ liệu nào bị xóa.`;
        setMessages((previous) => [...previous, { role: "assistant", text, transactionDeletion: {
          confirmationId: crypto.randomUUID(), transactionIds: ids, selectedIds: selectByDefault ? ids : [], scope: all ? "all" : "matching", status: "pending",
        } }]);
        return;
      }
      if (ai.intent === "financial") {
        const allowedActions: FinancialAction[] = ["balance", "spending_summary", "top_category", "transactions", "budget_status", "explain", "unknown"];
        const answer = answerFinancialQuery({
          action: allowedActions.includes(ai.action as FinancialAction) ? ai.action as FinancialAction : "unknown",
          walletId: state.wallets.some((item) => item.id === ai.walletId && !item.archived) ? ai.walletId || null : null,
          scope: ai.scope === "all" ? "all" : "selected", periodStart: ai.periodStart || null, periodEnd: ai.periodEnd || null,
          category: state.categories.includes(ai.category || "") ? ai.category || null : null,
          searchTerm: ai.searchTerm || null, transactionType: ai.transactionType || null,
        }, state, wallet, today());
        setClarifyingDraftId(activeDraftId);
        setMessages((previous) => [...previous, { role: "assistant", text: answer, localOnly: true }]);
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
      let validated = returned.map((item) => {
        const draft = item as TransactionDraft;
        const category = draft.category || inferDraftCategory(`${message} ${draft.title}`, draft.type, state);
        return validateDraftForState(category ? { ...draft, category } : draft, state);
      });
      if (ai.intent === "clarification" && activeDraftId) {
        const prior = drafts.find((draft) => draft.id === activeDraftId);
        if (prior && validated[0]) validated = [{ ...validated[0], id: prior.id }];
        setDrafts((previous) => previous.map((draft) => draft.id === activeDraftId && validated[0] ? validated[0] : draft));
        const update = validated[0];
        const missing = update ? update.needsReview : [];
        setClarifyingDraftId(update && missing.length ? update.id : null);
        setMessages((previous) => [...previous, { role: "assistant", text: update && missing.length ? clarificationQuestion(missing) : "Cảm ơn bạn, mình đã cập nhật bản nháp. Hãy kiểm tra rồi xác nhận để lưu nhé." }]);
      } else if (validated.length) {
        setDrafts((previous) => [...previous, ...validated]);
        const walletChoiceDraftIds = validated.filter((draft) => draft.needsReview.includes("wallet")).map((draft) => draft.id);
        setClarifyingDraftId(validated.find((draft) => draft.needsReview.length > 0)?.id || null);
        const currencyMatch = ai.intent === "transaction"
          ? resolveUniqueCurrencyWallet(message, state.wallets.filter((item) => !item.archived))
          : null;
        const walletPrompt = walletChoiceDraftIds.length
          ? currencyMatch?.ambiguous && currencyMatch.currency
            ? `Có nhiều ví dùng ${currencyMatch.currency}; hãy chọn ví cho từng bản nháp.`
            : currencyMatch?.ambiguous
              ? "Tin nhắn có nhiều đơn vị tiền tệ. Hãy chọn ví phù hợp cho từng bản nháp."
            : currencyMatch?.currency
              ? `Mình nhận ra tiền tệ ${currencyMatch.currency}, nhưng chưa có ví phù hợp đang hoạt động. Hãy chọn ví hoặc tạo ví ${currencyMatch.currency}.`
              : "Mình chưa chắc nên dùng ví nào. Hãy chọn ví cho từng bản nháp."
          : "Mình đã tạo bản nháp. Hãy kiểm tra rồi xác nhận để lưu nhé.";
        setMessages((previous) => [...previous, {
          role: "assistant",
          text: walletPrompt,
          draftIds: validated.map((draft) => draft.id),
          ...(currencyMatch?.currency ? { requiredCurrency: currencyMatch.currency } : {}),
          ...(walletChoiceDraftIds.length ? { walletChoiceDraftIds } : {}),
        }]);
      }
      else setMessages((previous) => [...previous, { role: "assistant", text: "Chưa tìm thấy giao dịch nào có thể đưa vào bản nháp. Hãy thử mô tả lại." }]);
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError" || /chưa phản hồi kịp/i.test(error.message));
      const fallback = timedOut ? createTimeoutTransactionDraft(message, batchId, today(), state) : null;
      if (fallback) {
        const currencyWallet = resolveUniqueCurrencyWallet(message, state.wallets.filter((item) => !item.archived));
        const fallbackWallet = currencyWallet.walletId || (!currencyWallet.currency && !currencyWallet.ambiguous ? wallet : null);
        const selectedWallet = state.wallets.find((item) => item.id === fallbackWallet && !item.archived);
        const checked = validateDraftForState({ ...fallback, wallet: selectedWallet?.id || null, currency: selectedWallet?.currency || null }, state);
        setDrafts((previous) => [...previous, checked]);
        setClarifyingDraftId(checked.needsReview.length ? checked.id : null);
        const unresolvedWallet = checked.needsReview.includes("wallet");
        setMessages((previous) => [...previous, {
          role: "assistant",
          text: `Gemini đang phản hồi chậm. Mình đã tạo bản nháp tạm; hãy kiểm tra rồi xác nhận.${unresolvedWallet ? currencyWallet.ambiguous ? " Tin nhắn có nhiều đơn vị tiền tệ; chọn ví phù hợp bên dưới." : " Chọn ví phù hợp bên dưới." : ""}`,
          draftIds: [checked.id],
          ...(currencyWallet.currency ? { requiredCurrency: currencyWallet.currency } : {}),
          ...(unresolvedWallet ? { walletChoiceDraftIds: [checked.id] } : {}),
        }]);
      } else {
        const errorMessage = timedOut ? "AI phản hồi quá lâu. Tin nhắn vẫn còn trong hội thoại; hãy thử gửi lại." : error instanceof Error ? error.message : "Không thể phân tích nội dung. Vui lòng thử lại.";
        setText((current) => current.trim() ? current : message);
        setMessages((previous) => [...previous, { role: "assistant", text: errorMessage }]);
      }
    } finally { setBusy(false); aiRequestLock.current = false; }
  }
  async function readReceipt(file: File) {
    if (busy || aiRequestLock.current) return;
    if (!file.type.startsWith("image/")) {
      setMessages((previous) => [...previous, { role: "assistant", text: "Vui lòng chọn một tệp ảnh hóa đơn." }]);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessages((previous) => [...previous, { role: "assistant", text: "Ảnh quá lớn. Vui lòng chọn ảnh dưới 5 MB." }]);
      return;
    }
    setBusy(true); aiRequestLock.current = true; failedReceipt.current = file;
    setMessages((previous) => [...previous, { role: "user", text: "📷 Ảnh hóa đơn" }, { role: "assistant", text: "Đang đọc hóa đơn và kiểm tra thông tin…" }]);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được tệp ảnh."));
        reader.onerror = () => reject(new Error("Không đọc được tệp ảnh."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/ai/receipt-drafts", {
        signal: AbortSignal.timeout(65_000), method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl, today: today(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          defaultWalletId: wallet,
          wallets: state.wallets.filter((item) => !item.archived).map(({ id, name, currency }) => ({ id, name, currency })),
          categories: state.categories.filter((name) => !state.categoryMeta[name]?.archived).flatMap((name) => {
            const type = state.categoryMeta[name]?.type || "expense";
            return type === "income" || type === "expense" ? [{ name, type }] : [];
          }),
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      const draftValue = result && typeof result === "object" ? (result as { draft?: unknown }).draft : null;
      if (!response.ok || !draftValue || typeof draftValue !== "object" || typeof (draftValue as TransactionDraft).id !== "string" || typeof (draftValue as TransactionDraft).title !== "string") {
        const message = result && typeof result === "object" && typeof (result as { message?: unknown }).message === "string" ? (result as { message: string }).message : "Không thể đọc hóa đơn. Hãy chọn ảnh rõ hơn hoặc nhập giao dịch bằng chat.";
        throw new Error(message);
      }
      const parsedDraft = draftValue as TransactionDraft;
      const inferredCategory = parsedDraft.category || inferDraftCategory(parsedDraft.title, parsedDraft.type, state);
      const draft = validateDraftForState({ ...(inferredCategory ? { ...parsedDraft, category: inferredCategory } : parsedDraft), wallet: null, currency: null }, state);
      receiptImages.current[draft.id] = imageDataUrl;
      failedReceipt.current = null;
      setDrafts((previous) => [...previous, draft]);
      setClarifyingDraftId(null);
      setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", text: "Mình đã đọc hóa đơn. Bạn muốn ghi giao dịch này vào ví nào? Chọn ví bên dưới để tạo bản nháp.", walletChoiceDraftIds: [draft.id] }]);
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      const message = timedOut ? "Đọc hóa đơn quá thời gian chờ. Ảnh vẫn được giữ; bấm “Thử lại ảnh” hoặc chọn ảnh nhỏ hơn." : error instanceof Error ? error.message : "Không thể đọc hóa đơn. Vui lòng thử lại.";
      setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", text: message, retryReceipt: true }]);
    } finally {
      setBusy(false);
      aiRequestLock.current = false;
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function editDraft(id: string, patch: Partial<Omit<TransactionDraft, "id" | "needsReview">>) {
    setDrafts((previous) => editDraftById(previous, id, patch, state));
    if (clarifyingDraftId === id) setClarifyingDraftId(null);
  }
  function createDraftCategory() {
    const name = newCategoryName.trim();
    if (!name || !editingDraft?.type) return;
    if (state.categories.some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setCategoryError("Danh mục này đã tồn tại. Hãy chọn danh mục trong danh sách.");
      return;
    }
    const type = editingDraft.type;
    updateState((current) => ({
      ...current,
      categories: [...current.categories, name],
      categoryMeta: { ...current.categoryMeta, [name]: { type, icon: "❓", children: [] } },
    }));
    setDrafts((previous) => previous.map((draft) => draft.id === editingDraft.id ? { ...draft, category: name, needsReview: draft.needsReview.filter((field) => field !== "category") } : draft));
    setNewCategoryName(""); setCategoryError(""); setAddingCategory(false);
  }
  function confirmDrafts(ids: string[]) {
    if (commitLock.current || ids.length === 0) return;
    commitLock.current = true; setCommitting(true);
    let committed: string[] = [];
    let duplicateIds: string[] = [];
    try {
      const chosen = drafts.filter((draft) => ids.includes(draft.id));
      updateState((current) => {
        duplicateIds = chosen.filter((draft) => current.transactions.some((transaction) => transaction.id === draft.id)).map((draft) => draft.id);
        const result = validateAndCommitDrafts(current, chosen);
        committed = result.committed;
        const committedIds = new Set(result.committed);
        return { ...result.state, transactions: result.state.transactions.map((transaction) => committedIds.has(transaction.id) && receiptImages.current[transaction.id] ? { ...transaction, image: receiptImages.current[transaction.id] } : transaction) };
      });
      if (committed.length) {
        const byId = new Map(chosen.map((draft) => [draft.id, draft]));
        const transactions = committed.map((id) => {
          const draft = byId.get(id)!;
          const image = receiptImages.current[id];
          delete receiptImages.current[id];
          return { id, title: draft.title.trim(), amount: draft.amount!, type: draft.type!, category: draft.category!, date: draft.date!, wallet: draft.wallet!, note: "", ...(image ? { image } : {}) } satisfies Transaction;
        });
        setMessages((previous) => [...previous, ...transactions.map((transaction) => ({ role: "assistant" as const, text: `Đã lưu ${money(transaction.amount, state.wallets.find((item) => item.id === transaction.wallet)?.currency)} vào ${transaction.category}.`, transaction }))]);
      } else if (duplicateIds.length) {
        setMessages((previous) => [...previous, { role: "assistant", text: "Bản nháp này đã được lưu trước đó; không tạo bản ghi trùng." }]);
      }
      const processed = new Set([...committed, ...duplicateIds]);
      setDrafts((previous) => previous.filter((draft) => !processed.has(draft.id)));
      if (ids.includes(clarifyingDraftId || "")) setClarifyingDraftId(null);
    } finally { commitLock.current = false; setCommitting(false); }
  }
  function removeDraft(id: string) {
    delete receiptImages.current[id];
    setDrafts((previous) => removeDraftById(previous, id));
    if (clarifyingDraftId === id) setClarifyingDraftId(null);
    setEditingDraftId((current) => current === id ? null : current);
    setMessages((previous) => [...previous, { role: "assistant", text: "Đã bỏ bản nháp." }]);
  }
  function chooseDraftWallet(draftId: string, walletId: string) {
    const chosenWallet = state.wallets.find((item) => item.id === walletId && !item.archived);
    const draft = drafts.find((item) => item.id === draftId);
    if (!chosenWallet || !draft) return;
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
          ? `Đã chọn ví. Chưa có danh mục phù hợp cho “${updatedDraft.title}”. Nhắn tên danh mục muốn thêm.`
          : remaining.length ? "Đã chọn ví cho giao dịch này. Chọn ví cho các giao dịch còn lại để tạo bản nháp." : "Đã chọn ví. Hãy kiểm tra bản nháp rồi xác nhận để lưu nhé.",
      };
    }));
  }
  function assignNewCategory(draftId: string, requestedName: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft?.type) return false;
    const existing = state.categories.find((category) => category.toLocaleLowerCase("vi") === requestedName.toLocaleLowerCase("vi"));
    if (existing && (state.categoryMeta[existing]?.type || "expense") !== draft.type) {
      setMessages((previous) => [...previous, { role: "assistant", text: `Danh mục “${existing}” đã được dùng cho ${state.categoryMeta[existing]?.type === "income" ? "thu nhập" : "chi phí"}. Hãy nhắn một tên danh mục khác.` }]);
      return false;
    }
    const category = existing || requestedName;
    const categoryMeta = existing ? state.categoryMeta : { ...state.categoryMeta, [category]: { type: draft.type, icon: "❓", children: [] } };
    const nextState = existing ? state : { ...state, categories: [...state.categories, category], categoryMeta };
    if (!existing) updateState((current) => current.categories.some((item) => item.toLocaleLowerCase("vi") === category.toLocaleLowerCase("vi"))
      ? current
      : { ...current, categories: [...current.categories, category], categoryMeta: { ...current.categoryMeta, [category]: { type: draft.type!, icon: "❓", children: [] } } });
    const updated = validateDraftForState({ ...draft, category }, nextState);
    setDrafts((previous) => previous.map((item) => item.id === draftId ? updated : item));
    setClarifyingDraftId(updated.needsReview.length ? updated.id : null);
    return true;
  }
  async function transcribeVoice(blob: Blob) {
    if (aiRequestLock.current) return;
    aiRequestLock.current = true;
    setTranscribing(true);
    try {
      if (blob.size > 5 * 1024 * 1024) throw new Error("Bản ghi quá dài. Hãy nói ngắn hơn rồi thử lại.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      const response = await fetch("/api/ai/speech-transcription", { signal: AbortSignal.timeout(20_000), method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mimeType: blob.type || "audio/webm", audioBase64: btoa(binary) }) });
      const result = await response.json() as { text?: string; message?: string };
      if (!response.ok || !result.text?.trim()) throw new Error(result.message || "Chưa nhận diện được lời nói. Hãy thử lại.");
      setText(result.text.trim());
      setVoiceError("");
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      setVoiceError(timedOut ? "Gemini chuyển giọng nói quá lâu. Hãy nói đoạn ngắn hơn rồi thử lại." : error instanceof Error ? error.message : "Không thể chuyển giọng nói thành chữ. Hãy thử lại.");
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
      const activeRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.current = activeRecorder;
      activeRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.current.push(event.data); };
      activeRecorder.onerror = () => setVoiceError("Có lỗi khi ghi âm. Hãy kiểm tra micro rồi thử lại.");
      activeRecorder.onstop = () => {
        const audio = new Blob(audioChunks.current, { type: activeRecorder.mimeType });
        recorderStream.current?.getTracks().forEach((track) => track.stop());
        recorderStream.current = null;
        recorder.current = null;
        setListening(false);
        if (audio.size) void transcribeVoice(audio);
        else setVoiceError("Chưa ghi được âm thanh. Hãy thử nói lại.");
      };
      activeRecorder.start();
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
  return <div className="r-chat-page"><PageHeader onBack={() => navigate("?tab=transactions")}><button type="button" className="r-icon-button" aria-label="Xóa hội thoại" title="Xóa hội thoại" onClick={() => setModal("resetChat")}><Trash2 size={18} /></button><button type="button" className="r-icon-button" aria-label="Cài đặt chat" onClick={() => navigate("accountSettings")}><Settings size={20} /></button></PageHeader><Mascot greeting="Hôm nay bạn đã chi tiêu gì?" className="r-chat-mascot" /><div className="r-chat-messages" ref={messagesRef} role="log" aria-label="Lịch sử hội thoại" tabIndex={0}>
      <div className={planStyles.chatIntroduction}>
        <p>{String(state.settings.name || "")}, { /中文|zh/.test(String(state.settings.language)) ? "你好！我是 Finn。" : /Việt|vi/.test(String(state.settings.language)) ? "xin chào! Mình là Finn." : "hello! I'm Finn." }</p>
        <button type="button" disabled={busy} onClick={() => setMessages(previous => [...previous, { role: "assistant", text: localPlanReply(state, today()), localOnly: true }])}>{/中文|zh/.test(String(state.settings.language)) ? "查看支出计划" : /Việt|vi/.test(String(state.settings.language)) ? "Xem kế hoạch chi tiêu" : "View spending plan"}</button>
      </div>
      <span className="r-chat-date">Hôm nay</span>
      {messages.map((message, index) => <div key={index} className={"r-message " + message.role + (message.draftIds ? " r-ai-draft-message" : "")}>
        <p>{message.text}</p>
        {message.transactionDeletion && (() => {
          const deletion = message.transactionDeletion;
          const candidates = state.transactions.filter((transaction) => deletion.transactionIds.includes(transaction.id));
          const copy = {
            vi: { all: "Xóa toàn bộ giao dịch", matched: "Giao dịch khớp yêu cầu", selected: "Được chọn để xóa", cancel: "Hủy yêu cầu", confirm: "Xác nhận xóa", cancelled: "Đã hủy yêu cầu xóa. Dữ liệu vẫn được giữ.", confirmed: `Đã xóa ${deletion.deletedCount || 0} giao dịch.`, empty: "Các giao dịch này không còn tồn tại.", danger: "Thao tác này sẽ xóa giao dịch khỏi dữ liệu và cập nhật số dư, lịch sử, ngân sách." },
            en: { all: "Delete all transactions", matched: "Matching transactions", selected: "Selected for deletion", cancel: "Cancel request", confirm: "Confirm deletion", cancelled: "Deletion cancelled. Your data is unchanged.", confirmed: `Deleted ${deletion.deletedCount || 0} transactions.`, empty: "These transactions are no longer available.", danger: "This removes the transactions and updates balances, history and budgets." },
            zh: { all: "删除全部交易", matched: "符合条件的交易", selected: "已选择删除", cancel: "取消请求", confirm: "确认删除", cancelled: "已取消删除，数据保持不变。", confirmed: `已删除 ${deletion.deletedCount || 0} 笔交易。`, empty: "这些交易已不存在。", danger: "删除后将更新余额、历史记录和预算。" },
          }[resolveLanguage(state.settings.language)];
          return <section className="r-ai-delete-confirm" aria-label={copy.matched}>
            <strong>{deletion.status === "pending" ? deletion.scope === "all" ? copy.all : copy.matched : deletion.status === "confirmed" ? copy.confirmed : copy.cancelled}</strong>
            {deletion.status === "pending" && <>
              <p>{copy.danger}</p>
              {candidates.length ? <div className="r-ai-delete-list">{candidates.map((transaction) => {
                const transactionWallet = state.wallets.find((item) => item.id === transaction.wallet);
                return <label key={transaction.id}>
                  <input type="checkbox" checked={deletion.selectedIds.includes(transaction.id)} onChange={(event) => selectTransactionForDeletion(deletion.confirmationId, transaction.id, event.target.checked)} />
                  <span><b>{transaction.title}</b><small>{transaction.date.slice(0, 10)} · {transaction.category} · {transactionWallet?.name || "Ví"}</small></span>
                  <strong>{money(transaction.amount, transactionWallet?.currency)}</strong>
                </label>;
              })}</div> : <p>{copy.empty}</p>}
              <small>{deletion.selectedIds.length} {copy.selected.toLocaleLowerCase()}</small>
              <div className="r-two-options">
                <button type="button" className="r-secondary" onClick={() => cancelTransactionDeletion(deletion.confirmationId)}>{copy.cancel}</button>
                <button type="button" className="r-danger" disabled={!deletion.selectedIds.length || !candidates.length} onClick={() => confirmTransactionDeletion(deletion.confirmationId)}>{copy.confirm} ({deletion.selectedIds.length})</button>
              </div>
            </>}
          </section>;
        })()}
        {message.retryReceipt && failedReceipt.current && <button type="button" className="r-ai-clarify-button" disabled={busy} onClick={() => { const file = failedReceipt.current; if (file) void readReceipt(file); }}>Thử lại ảnh</button>}
        {message.transaction && <button type="button" className="r-chat-record" onClick={() => navigate("editTransaction?id=" + message.transaction?.id)}>
          <small>Đã ghi: {message.transaction.type === "income" ? "Thu nhập" : "Chi phí"}</small><b>{message.transaction.category}</b>
          <span>{money(message.transaction.amount, state.wallets.find((item) => item.id === message.transaction?.wallet)?.currency)}</span><small>{message.transaction.title}</small>
        </button>}
        {message.walletChoiceDraftIds?.map((id) => {
          const pending = drafts.find((draft) => draft.id === id);
          if (!pending) return null;
          const availableWallets = state.wallets.filter((item) => !item.archived && (!message.requiredCurrency || item.currency.toUpperCase() === message.requiredCurrency.toUpperCase()));
          return <section className="r-ai-wallet-choice" key={id} aria-label={`Chọn ví cho ${pending.title}`}>
            <b>{pending.title || "Giao dịch"}</b>
            <span>{pending.type === "income" ? "Thu nhập" : "Chi phí"}{pending.amount !== null ? ` · ${pending.amount.toLocaleString("vi-VN")}` : " · Chưa rõ số tiền"}</span>
            <div>{availableWallets.map((item) => <button type="button" key={item.id} onClick={() => chooseDraftWallet(id, item.id)}>{item.name === "." ? "Ví chính" : item.name} · {item.currency}</button>)}</div>
            {!availableWallets.length && <small>{message.requiredCurrency ? `Chưa có ví ${message.requiredCurrency} đang hoạt động. Hãy tạo ví cùng tiền tệ trước khi xác nhận.` : "Hiện chưa có ví đang hoạt động. Hãy tạo ví trước khi ghi giao dịch."}</small>}
          </section>;
        })}
        {message.draftIds?.map((id) => {
          const rawDraft = drafts.find((draft) => draft.id === id);
          if (!rawDraft) return null;
          const draft = validateDraftForState(rawDraft, state);
          const valid = readyDrafts([draft], state).length === 1;
          const draftWallet = state.wallets.find((item) => item.id === draft.wallet && !item.archived);
          const labels: Record<string, string> = { amount: "số tiền", type: "loại giao dịch", category: "danh mục", date: "ngày", wallet: "ví/tiền tệ" };
          const needsReview = draft.needsReview.map((field) => labels[field] || field);
          return <article key={id} className="r-chat-record r-ai-draft-card">
            <div className="r-ai-draft-heading"><small>Bản nháp · {draft.type === "income" ? "Thu nhập" : draft.type === "expense" ? "Chi phí" : "Chưa rõ loại"}</small><button type="button" className="r-icon-button" aria-label="Bỏ bản nháp" onClick={() => removeDraft(id)}><X size={16} /></button></div>
            {receiptImages.current[id] && <div className="r-ai-receipt-thumb" role="img" aria-label="Ảnh hóa đơn đính kèm bản nháp" style={{ backgroundImage: `url("${receiptImages.current[id]}")` }} />}
            <div className="r-ai-draft-summary"><b>{draft.title.trim() || "Chưa có mô tả"}</b><strong>{draft.amount !== null ? money(draft.amount, draft.currency || draftWallet?.currency) : "Chưa rõ số tiền"}</strong></div>
            <p className="r-ai-draft-details">{draft.category || "Chưa chọn danh mục"} · {draft.date || "Chưa rõ ngày"} · {draftWallet ? `${draftWallet.name} (${draftWallet.currency})` : "Chưa chọn ví"}</p>
            {needsReview.length > 0 && <small className="r-ai-draft-review">Cần xem lại: {needsReview.join(", ")}</small>}
            <div className="r-two-options"><button type="button" className="r-secondary" onClick={() => setEditingDraftId(id)}>Chỉnh sửa</button><button type="button" className="r-primary" disabled={!valid || committing} onClick={() => confirmDrafts([id])}>Xác nhận</button></div>
            {needsReview.length > 0 && <button type="button" className="r-ai-clarify-button" onClick={() => { setClarifyingDraftId(id); setText(""); }}>Trả lời để bổ sung thông tin</button>}
            {!valid && <small className="r-ai-draft-review">Hãy bổ sung các thông tin còn thiếu trước khi xác nhận.</small>}
          </article>;
        })}
      </div>)}
      {busy && <div className="r-chat-thinking" role="status" aria-label="Đang phân tích giao dịch"><span /><span /><span /></div>}
    </div><div className="r-chat-bottom"><div className="r-chat-actions"><button type="button" onClick={() => setModal("transfer")}><ArrowRightLeft size={14} />Di chuyển quỹ</button><button type="button" onClick={() => navigate("recurringTransaction")}><IconRepeat />Giao dịch định kỳ</button></div><input ref={fileInput} className="sr-only" type="file" aria-label="Chọn ảnh hóa đơn" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readReceipt(file); }} /><form className="r-chat-input" onSubmit={(e) => { e.preventDefault(); void send(text); }}><input aria-label="Nhập giao dịch" placeholder={clarifyingDraftId ? "Trả lời câu hỏi để bổ sung bản nháp…" : "ví dụ: hôm qua ăn sáng 30k, trưa 50k"} value={text} onChange={(e) => setText(e.target.value)} />{text.trim() ? <button disabled={busy || transcribing} aria-label="Gửi tin nhắn"><Send size={22} /></button> : <><button type="button" disabled={busy || transcribing} aria-label={listening ? "Dừng ghi âm" : "Ghi bằng giọng nói"} title={listening ? "Dừng ghi âm" : "Nói để chép lời vào ô chat"} onClick={() => { if (listening) recorder.current?.stop(); else { setVoiceError(""); void startVoice(); } }}><Mic size={22} /></button><button type="button" disabled={busy || transcribing} aria-label="Thêm ảnh hóa đơn" onClick={() => fileInput.current?.click()}><Camera size={22} /></button></>}</form>{(listening || transcribing || voiceError) && <p className="r-chat-voice-status" role="status">{listening ? "Đang nghe… bấm micro để dừng." : transcribing ? "Đang nhận diện lời nói…" : voiceError}</p>}<button type="button" className="r-memory-button" onClick={() => setModal("memory")}>Bộ nhớ của FinBridge</button></div>
    {modal === "resetChat" && <Modal title="Xóa hội thoại?" onClose={close}><div className="r-form"><p>Lịch sử chat và các bản nháp chưa xác nhận sẽ bị xóa. Giao dịch đã xác nhận vẫn được giữ.</p><div className="r-two-options"><button type="button" className="r-secondary" onClick={close}>Quay lại</button><button type="button" className="r-danger" onClick={resetConversation}>Xóa hội thoại</button></div></div></Modal>}
    {modal === "memory" && <Modal title="Bộ nhớ của FinBridge" sheet onClose={close}><p>Hãy dạy FinBridge quy tắc của bạn để FinBridge sắp xếp giao dịch theo cách bạn muốn.</p><form className="r-rule-input" onSubmit={(e) => { e.preventDefault(); if (rule.trim()) updateState((s) => ({ ...s, rules: [...s.rules, rule.trim()] })); setRule(""); }}><input placeholder="Nhập quy tắc của bạn vào đây..." aria-label="Quy tắc" value={rule} onChange={(e) => setRule(e.target.value)} /><button className="r-primary" aria-label="Thêm quy tắc"><Plus /></button></form><small>Ví dụ:<br />- ăn tối với bạn bè được phân loại là giải trí<br />- thể thao luôn được xếp vào danh mục sức khỏe<br />- cho thuê được xếp vào danh mục nhà ở</small>{state.rules.length ? state.rules.map((r, i) => <div key={i} className="r-toggle-row"><span>{r}</span><button className="r-icon-button" aria-label="Xóa quy tắc" onClick={() => updateState((s) => ({ ...s, rules: s.rules.filter((_, index) => i !== index) }))}><X size={18} /></button></div>) : <div className="r-no-rules"><b>Chưa có quy tắc nào</b><p>Thêm một quy tắc ở trên để dạy FinBridge cách phân loại giao dịch của bạn.</p></div>}<div className="r-toggle-row"><span>Tự động cập nhật bộ nhớ<small>FinBridge lưu quy tắc khi bạn sửa danh mục.</small></span><Toggle checked={Boolean(state.settings.autoMemory)} label="Tự động cập nhật bộ nhớ" onChange={(v) => updateState((s) => ({ ...s, settings: { ...s.settings, autoMemory: v } }))} /></div></Modal>}
    {modal === "transfer" && <TransferForm onClose={close} />}
    {editingDraft && <Modal title="Chỉnh sửa bản nháp" sheet onClose={() => setEditingDraftId(null)}><div className="r-form">
      <p>Những thay đổi này chỉ sửa bản nháp. Giao dịch chỉ được lưu khi bạn bấm “Xác nhận” trong câu trả lời.</p>
      <label>Mô tả<input aria-label="Mô tả bản nháp" maxLength={160} value={editingDraft.title} onChange={(event) => editDraft(editingDraft.id, { title: event.target.value })} /></label>
      <label>Số tiền<input aria-label="Số tiền bản nháp" type="number" min="0.01" step="any" value={editingDraft.amount ?? ""} onChange={(event) => editDraft(editingDraft.id, { amount: event.target.value ? Number(event.target.value) : null })} /></label>
      <Field label="Loại"><select aria-label="Loại bản nháp" value={editingDraft.type || ""} onChange={(event) => editDraft(editingDraft.id, { type: event.target.value ? event.target.value as "expense" | "income" : null, category: null })}><option value="">Chọn loại</option><option value="expense">Chi phí</option><option value="income">Thu nhập</option></select></Field>
      <Field label="Danh mục"><select aria-label="Danh mục bản nháp" value={editingDraft.category || ""} onChange={(event) => editDraft(editingDraft.id, { category: event.target.value || null })}><option value="">Chọn danh mục</option>{state.categories.filter((name) => !state.categoryMeta[name]?.archived && (state.categoryMeta[name]?.type || "expense") === editingDraft.type).map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
      {!addingCategory ? <button type="button" className="r-ai-clarify-button" onClick={() => { setAddingCategory(true); setCategoryError(""); }}>+ Thêm danh mục mới</button> : <div className="r-ai-new-category"><input aria-label="Tên danh mục mới" maxLength={100} placeholder="Ví dụ: Y tế, Đi lại" value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} /><button type="button" className="r-primary" disabled={!newCategoryName.trim()} onClick={createDraftCategory}>Tạo và chọn</button>{categoryError && <small role="alert">{categoryError}</small>}</div>}
      <Field label="Ngày"><input aria-label="Ngày bản nháp" type="date" value={editingDraft.date || ""} onChange={(event) => editDraft(editingDraft.id, { date: event.target.value || null })} /></Field>
      <Field label="Ví"><select aria-label="Ví bản nháp" value={editingDraft.wallet || ""} onChange={(event) => editDraft(editingDraft.id, { wallet: event.target.value || null })}><option value="">Chọn ví</option>{state.wallets.filter((item) => !item.archived).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.currency})</option>)}</select></Field>
      <div className="r-two-options"><button type="button" className="r-secondary" onClick={() => setEditingDraftId(null)}>Đóng</button><button type="button" className="r-primary" onClick={() => setEditingDraftId(null)}>Xong, quay lại xem trước</button></div>
    </div></Modal>}
  </div>;
}
function IconRepeat() { return <span aria-hidden="true">⟳</span>; }
export function RecurringPage({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [adding, setAdding] = useState(false);
  return <div className="r-tool-page"><PageHeader title="Giao dịch định kỳ theo lịch trình" close onBack={() => navigate("addTransactionChatMode")} />{state.recurring.length === 0 ? <EmptyState title="Chưa có giao dịch định kỳ nào được lên lịch." text="Bắt đầu thêm các giao dịch định kỳ của bạn ngay bây giờ!" className="r-tool-empty" /> : state.recurring.map((t) => <div className="r-setting-row" key={t.id}><span>{t.title}<small>{t.date} · {t.category}</small></span><b>{money(t.amount)}</b><button aria-label="Xóa lịch" className="r-icon-button" onClick={() => updateState((s) => ({ ...s, recurring: s.recurring.filter((r) => r.id !== t.id) }))}><X /></button></div>)}<button className="r-fab r-fab-wide r-fab-no-nav" onClick={() => setAdding(true)}><Plus size={20} />Thêm Định Kỳ</button>{adding && <Modal title="Thêm Giao Dịch Định Kỳ" onClose={() => setAdding(false)}><TransactionForm navigate={navigate} recurring onClose={() => setAdding(false)} /></Modal>}</div>;
}
function TransferForm({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const [targetType, setTargetType] = useState("Chuyển khoản");
  const [wallet, setWallet] = useState(state.wallets[0].id);
  const [target, setTarget] = useState(state.wallets[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("2026-10-12");
  const [error, setError] = useState("");
  return <Modal title="Di chuyển Quỹ" sheet onClose={onClose}><p>Chuyển tiền đến ví khác</p><div className="r-type-pills r-align-left">{["Chuyển khoản", "Tiết kiệm", "Món nợ", "Lend/Borrow", "Thử thách"].map((type) => <button type="button" key={type} className={type === targetType ? "active" : ""} onClick={() => { setTargetType(type); setTarget(""); }}>{type}</button>)}</div><form className="r-form" onSubmit={(e) => { e.preventDefault(); if (targetType === "Chuyển khoản" && (!target || wallet === target)) { setError("Vui lòng chọn hai ví khác nhau."); return; } if (!target) { setError("Vui lòng tạo mục tiêu trước khi chuyển tiền."); return; } updateState((s) => ({ ...s, transactions: [...s.transactions, { id: crypto.randomUUID(), type: "transfer", title, amount: Number(amount), category: targetType, date, wallet, targetWallet: targetType === "Chuyển khoản" ? target : undefined, note }], goals: targetType === "Chuyển khoản" ? s.goals : s.goals.map((g) => g.id === target ? { ...g, saved: g.saved + Number(amount) } : g) })); onClose(); }}><Field label="Chọn ví"><select value={wallet} onChange={(e) => setWallet(e.target.value)}>{state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field><Field label="Đến ví"><select value={target} onChange={(e) => setTarget(e.target.value)} required><option value="">Chọn</option>{targetType === "Chuyển khoản" ? state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>) : state.goals.filter((g) => g.kind === tools.find((t) => t.name === targetType || (targetType === "Lend/Borrow" && t.path === "loanList"))?.path).map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}</select></Field><input aria-label="Mục" placeholder="Mục" value={title} onChange={(e) => setTitle(e.target.value)} /><input aria-label="Số tiền" placeholder={"Số tiền (" + currencySymbol(state.wallets.find((w) => w.id === wallet)?.currency || "USD") + ")"} required type="number" min="0.01" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} /><Field label="Ngày"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field><textarea aria-label="Ghi chú" placeholder="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} />{error && <p className="r-expense" role="alert">{error}</p>}<button className="r-primary">Lưu</button></form></Modal>;
}
