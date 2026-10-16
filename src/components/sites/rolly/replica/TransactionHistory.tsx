"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowDownRight, ArrowRightLeft, ArrowUpRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus, ReceiptText, RotateCcw, Search, X } from "lucide-react";
import { DASHBOARD_SAMPLE } from "./Dashboard";
import { localDateKey } from "./chartWeek";
import { HistoryPeriodPicker, matchesHistoryPeriod, type HistoryPeriod } from "./HistoryPeriodPicker";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { useAppState } from "./store";
import * as storeModule from "./store";
import { FinBridgeHeader } from "./FinBridgeHeader";
import type { AppLanguage } from "@/lib/i18n";

let _i18n: any = null;
try {
  _i18n = require("@/lib/i18n");
} catch {
  // Test runners without @/ path alias
}

export const resolveLanguage = (lang: unknown): AppLanguage => {
  if (_i18n?.resolveLanguage) return _i18n.resolveLanguage(lang);
  if (typeof lang !== "string") return "vi";
  const normalized = lang.trim().toLowerCase();
  if (normalized === "en" || normalized.startsWith("en") || normalized.includes("english") || normalized.includes("anh")) return "en";
  if (normalized === "zh" || normalized.startsWith("zh") || normalized.includes("chinese") || normalized.includes("trung") || normalized.includes("中文")) return "zh";
  return "vi";
};

export const resolveWalletDisplayName = (name: string | null | undefined, lang: unknown): string => {
  if (_i18n?.resolveWalletDisplayName) return _i18n.resolveWalletDisplayName(name, lang);
  const trimmed = name?.trim();
  if (!trimmed || trimmed === "." || trimmed === "Ví chính" || trimmed === "Main wallet" || trimmed === "主钱包") {
    const l = resolveLanguage(lang);
    return l === "vi" ? "Ví chính" : l === "zh" ? "主钱包" : "Main wallet";
  }
  return name!;
};

export const resolveCategoryDisplayName = (category: string | null | undefined, lang: unknown, fallbackLabel = ""): string => {
  if (_i18n?.resolveCategoryDisplayName) return _i18n.resolveCategoryDisplayName(category, lang, fallbackLabel);
  if (!category || !category.trim()) return fallbackLabel;
  const l = resolveLanguage(lang);
  const trimmed = category.trim();
  const SYSTEM: Record<string, Record<string, string>> = {
    "Chưa được phân loại": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
    "Uncategorized": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
    "未分类": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
    "Thức ăn & Đồ uống": { vi: "Thức ăn & Đồ uống", en: "Food & Dining", zh: "餐饮" },
    "Ăn uống": { vi: "Ăn uống", en: "Food & Dining", zh: "餐饮" },
    "Nhà": { vi: "Nhà", en: "Housing", zh: "住房" },
    "Nhà ở": { vi: "Nhà ở", en: "Housing", zh: "住房" },
    "Mua sắm": { vi: "Mua sắm", en: "Shopping", zh: "购物" },
    "Thu nhập": { vi: "Thu nhập", en: "Income", zh: "收入" },
    "Lương": { vi: "Lương", en: "Salary", zh: "工资" },
    "Quà tặng": { vi: "Quà tặng", en: "Gifts", zh: "礼物" },
    "Hóa đơn & Tiện ích": { vi: "Hóa đơn & Tiện ích", en: "Bills & Utilities", zh: "账单与公共事业" },
    "Di chuyển": { vi: "Di chuyển", en: "Transportation", zh: "交通出行" },
    "Giải trí": { vi: "Giải trí", en: "Entertainment", zh: "娱乐" },
    "Chuyển khoản nội bộ": { vi: "Chuyển khoản nội bộ", en: "Internal Transfer", zh: "内部转账" },
    "Chuyển khoản": { vi: "Chuyển khoản", en: "Transfer", zh: "转账" },
    "Điều chỉnh số dư": { vi: "Điều chỉnh số dư", en: "Balance Adjustment", zh: "余额调整" },
  };
  return SYSTEM[trimmed]?.[l] || trimmed;
};

const PAGE_SIZE = 5;
type Kind = "all" | "expense" | "income" | "transfer";
type HistoryRecord = {
  id: string;
  title?: string;
  date: string;
  amount: number;
  type: "expense" | "income" | "transfer";
  category: string;
  subcategory?: string;
  wallet?: string;
  targetWallet?: string;
  note?: string;
  currency?: string;
  occurredAt?: string;
  sourceLabel?: string;
  classification?: { confidence?: number; method?: "automatic" | "manual"; reason?: string };
};

const COPY = {
  vi: {
    title: "Lịch sử giao dịch",
    subtitle: "Tra cứu các khoản thu, chi và chuyển tiền đã ghi nhận.",
    eyebrow: "LỊCH SỬ GIAO DỊCH",
    add: "Thêm qua chat",
    addTransaction: "Thêm giao dịch",
    search: "Tìm giao dịch",
    placeholder: "Tên giao dịch, danh mục hoặc ví",
    clearSearch: "Xóa tìm kiếm",
    wallet: "Ví nguồn",
    allWallets: "Tất cả ví",
    allWalletsInPeriod: "Từ mọi ví trong kỳ",
    archived: "Đã lưu trữ",
    kind: "Loại giao dịch",
    all: "Tất cả",
    expense: "Chi",
    income: "Thu",
    transfer: "Chuyển nội bộ",
    category: "Danh mục",
    allCategories: "Tất cả danh mục",
    period: "Khoảng thời gian",
    allTime: "Mọi thời gian",
    month: "Tháng hiện tại",
    week: "Tuần hiện tại",
    custom: "Chọn ngày",
    from: "Từ ngày",
    to: "Đến ngày",
    clear: "Xóa bộ lọc",
    totalIncome: "Tổng thu",
    totalExpense: "Tổng chi",
    count: "giao dịch",
    recorded: "Đã ghi nhận",
    sample: "Dữ liệu mô phỏng",
    syntheticData: "Dữ liệu mô phỏng",
    saved: "Dữ liệu đã lưu",
    source: "Tài khoản nguồn",
    target: "Tài khoản nhận",
    missingWallet: "Ví không còn trong danh sách",
    why: "Vì sao chọn danh mục này?",
    reason: "Giao dịch được lưu trong danh mục",
    noCategory: "Chưa có danh mục",
    auto: "Tự động phân loại",
    manual: "Phân loại thủ công",
    detail: "Thông tin giao dịch",
    reference: "Mã giao dịch",
    note: "Ghi chú",
    empty: "Chưa có giao dịch phù hợp",
    emptyHint: "Thử đổi khoảng thời gian, ví hoặc từ khóa tìm kiếm.",
    previous: "Trang trước",
    next: "Trang sau",
    page: "Trang",
    of: "/",
    showing: "Hiển thị",
    unknownDate: "Chưa có ngày",
    ranges: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
  },
  en: {
    title: "Transaction history",
    subtitle: "Find recorded income, expenses and transfers.",
    eyebrow: "TRANSACTION HISTORY",
    add: "Add in chat",
    addTransaction: "Add transaction",
    search: "Search transactions",
    placeholder: "Transaction name, category or wallet",
    clearSearch: "Clear search",
    wallet: "Source wallet",
    allWallets: "All wallets",
    allWalletsInPeriod: "All wallets in the selected period",
    archived: "Archived",
    kind: "Transaction type",
    all: "All",
    expense: "Expense",
    income: "Income",
    transfer: "Internal transfer",
    category: "Category",
    allCategories: "All categories",
    period: "Time period",
    allTime: "All time",
    month: "This month",
    week: "This week",
    custom: "Choose dates",
    from: "From",
    to: "To",
    clear: "Clear filters",
    totalIncome: "Total income",
    totalExpense: "Total expenses",
    count: "transactions",
    recorded: "Recorded",
    sample: "Simulated data",
    syntheticData: "Synthetic Data",
    saved: "Saved data",
    source: "Source account",
    target: "Destination account",
    missingWallet: "Wallet no longer listed",
    why: "Why this category?",
    reason: "This transaction is saved under",
    noCategory: "No category",
    auto: "Automatically categorized",
    manual: "Manually categorized",
    detail: "Transaction details",
    reference: "Transaction ID",
    note: "Note",
    empty: "No matching transactions",
    emptyHint: "Try another date range, wallet or search term.",
    previous: "Previous page",
    next: "Next page",
    page: "Page",
    of: "/",
    showing: "Showing",
    unknownDate: "No date recorded",
    ranges: "Start date must be on or before end date.",
  },
  zh: {
    title: "交易记录",
    subtitle: "查看已记录的收入、支出和转账。",
    eyebrow: "交易记录",
    add: "通过聊天添加",
    addTransaction: "添加交易",
    search: "搜索交易",
    placeholder: "交易名称、类别或钱包",
    clearSearch: "清除搜索",
    wallet: "来源钱包",
    allWallets: "全部钱包",
    allWalletsInPeriod: "所选期间的全部钱包",
    archived: "已归档",
    kind: "交易类型",
    all: "全部",
    expense: "支出",
    income: "收入",
    transfer: "内部转账",
    category: "类别",
    allCategories: "全部类别",
    period: "时间范围",
    allTime: "全部时间",
    month: "本月",
    week: "本周",
    custom: "选择日期",
    from: "开始日期",
    to: "结束日期",
    clear: "清除筛选",
    totalIncome: "总收入",
    totalExpense: "总支出",
    count: "笔交易",
    recorded: "已记录",
    sample: "模拟数据",
    syntheticData: "演示数据",
    saved: "已保存数据",
    source: "来源账户",
    target: "收款账户",
    missingWallet: "钱包已不在列表中",
    why: "为什么选择此类别？",
    reason: "此交易已保存至类别",
    noCategory: "未分类",
    auto: "自动分类",
    manual: "手动分类",
    detail: "交易详情",
    reference: "交易编号",
    note: "备注",
    empty: "没有符合条件的交易",
    emptyHint: "请尝试其他日期范围、钱包或搜索词。",
    previous: "上一页",
    next: "下一页",
    page: "第",
    of: "/",
    showing: "显示",
    unknownDate: "未记录日期",
    ranges: "开始日期不能晚于结束日期。",
  },
};

export function TransactionHistory({ navigate, defaultSearch = "" }: { navigate: (screen: string) => void; defaultSearch?: string }) {
  const state = useAppState();
  const params = useSearchParams();
  const lang = resolveLanguage(state.settings.language);
  const text = COPY[lang];
  const locale = lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB";
  const sample = params.get("source") === "sample";
  const today = localDateKey(new Date());
  const queryKind = params.get("type");
  const [kind, setKind] = useState<Kind>(["expense", "income", "transfer"].includes(queryKind || "") ? queryKind as Kind : "all");
  const [walletId, setWalletId] = useState(params.get("wallet") || "all");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [period, setPeriod] = useState<HistoryPeriod>({
    kind: params.get("from") || params.get("to") ? "custom" : "month",
    day: today, month: Number(today.slice(5, 7)) - 1, year: Number(today.slice(0, 4)),
    from: params.get("from") || today.slice(0, 7) + "-01", to: params.get("to") || today,
  });
  const [search, setSearch] = useState(defaultSearch || params.get("q") || params.get("search") || "");
  const [page, setPage] = useState(1);
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const nameOfWallet = (id?: string) => {
    const item = state.wallets.find((wallet) => wallet.id === id);
    return item ? resolveWalletDisplayName(item.name, lang) : text.missingWallet;
  };
  const base: HistoryRecord[] = sample ? DASHBOARD_SAMPLE.map((record) => ({ ...record, wallet: record.wallet || state.wallets.find((wallet) => wallet.currency === record.currency)?.id })) : state.transactions;
  const categoryKey = (name: string) => name.trim().normalize("NFC").toLocaleLowerCase(locale);
  const categoryNames = new Map<string, string>();
  const categoryRecords = base.filter((record) => {
    const matchesWallet = walletId === "all" || record.wallet === walletId || record.targetWallet === walletId;
    const matchesKind = kind === "all" || record.type === kind;
    return matchesWallet && matchesKind;
  });
  categoryRecords.forEach((record) => {
    if (record.category && record.category.trim() && !categoryNames.has(categoryKey(record.category))) {
      categoryNames.set(categoryKey(record.category), record.category.trim());
    }
  });
  if (Array.isArray(state.categories)) {
    state.categories.forEach((cat) => {
      const trimmed = cat.trim();
      const meta = state.categoryMeta?.[trimmed];
      if (!trimmed || meta?.archived) return;
      const catType = meta?.type || "expense";
      const matchesKind = kind === "all" || catType === kind;
      if (matchesKind && !categoryNames.has(categoryKey(trimmed))) {
        categoryNames.set(categoryKey(trimmed), trimmed);
      }
    });
  }
  const availableCategories = Array.from(categoryNames.values()).sort((a, b) => a.localeCompare(b, locale));
  const invalidRange = period.kind === "custom" && !!period.from && !!period.to && period.from > period.to;
  const records = base.filter((record) => {
    if (invalidRange) return false;
    if (walletId !== "all" && record.wallet !== walletId && record.targetWallet !== walletId) return false;
    if (kind !== "all" && record.type !== kind) return false;
    if (category !== "all" && categoryKey(record.category) !== categoryKey(category)) return false;
    if (!matchesHistoryPeriod(record.date, period)) return false;
    const categoryDisplay = resolveCategoryDisplayName(record.category, lang, text.noCategory);
    return [record.title, record.category, categoryDisplay, record.note, nameOfWallet(record.wallet)].join(" ").toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale));
  }).sort((a, b) => (b.occurredAt || b.date).localeCompare(a.occurredAt || a.date) || a.id.localeCompare(b.id));
  const currencyOf = (record: HistoryRecord) => record.currency || state.wallets.find((wallet) => wallet.id === record.wallet)?.currency;
  const amount = (value: number, currency?: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + (currency ? " " + currency : "");
  const totals = (type: "income" | "expense") => {
    const selectedWallets = state.wallets.filter((wallet) => walletId === "all" || wallet.id === walletId);
    const groups = new Map<string, number>(selectedWallets.map((wallet) => [wallet.currency, 0]));
    records.filter((record) => record.type === type).forEach((record) => {
      const currency = currencyOf(record) || "";
      groups.set(currency, (groups.get(currency) || 0) + Math.round(record.amount * 100));
    });
    return Array.from(groups, ([currency, minor]) => {
      const value = minor / 100;
      const signed = type === "income" ? value : -value;
      return { currency, label: (type === "income" ? signed >= 0 ? "+" : "−" : signed > 0 ? "+" : "−") + amount(Math.abs(value), currency) };
    });
  };
  const pages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const activePage = Math.min(page, pages);
  const visible = records.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const reset = () => { setKind("all"); setWalletId("all"); setCategory("all"); setPeriod({ ...period, kind: "month", month: Number(today.slice(5, 7)) - 1, year: Number(today.slice(0, 4)) }); setSearch(""); setPage(1); };
  const dateLabel = (record: HistoryRecord) => {
    const raw = record.occurredAt || record.date;
    const value = new Date(raw.length === 10 ? raw + "T12:00:00" : raw);
    if (!Number.isFinite(value.getTime())) return text.unknownDate;
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric", ...(raw.length > 10 ? { hour: "2-digit", minute: "2-digit", second: "2-digit" } as const : {}) }).format(value);
  };

  const handleToggleTheme = () => {
    if (typeof (storeModule as any).setSetting === "function") {
      (storeModule as any).setSetting("theme", state.settings?.theme === "dark" ? "light" : "dark");
    } else if (typeof (storeModule as any).updateState === "function") {
      (storeModule as any).updateState((s: any) => ({ ...s, settings: { ...s?.settings, theme: s?.settings?.theme === "dark" ? "light" : "dark" } }));
    }
  };
  const handleSelectLanguage = (val: string) => {
    if (typeof (storeModule as any).setSetting === "function") {
      (storeModule as any).setSetting("language", val);
    } else if (typeof (storeModule as any).updateState === "function") {
      (storeModule as any).updateState((s: any) => ({ ...s, settings: { ...s?.settings, language: val } }));
    }
  };

  return <main className="r-dashboard fb-home fb-history">
    <FinBridgeHeader
      lang={lang}
      navigate={navigate}
      theme={String(state.settings?.theme || "light")}
      currentLanguage={String(state.settings?.language || "Tiếng Việt")}
      onOpenCalendar={() => setCalendarLedgerOpen(true)}
      onToggleTheme={handleToggleTheme}
      onSelectLanguage={handleSelectLanguage}
    />

    <div className="fb-home-intro fb-history-header">
      <div>
        <p className="fb-eyebrow">{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p>{text.subtitle}</p>
      </div>
      <button
        type="button"
        className="fb-add-button"
        aria-label={text.addTransaction}
        onClick={() => navigate("addTransactionChatMode")}
      >
        <Plus size={18} />
        <span>{text.addTransaction}</span>
      </button>
    </div>

    <section className="fb-history-controls" aria-label={text.search}>
      <div className="fb-history-controls-top">
        <label className="fb-history-search">
          <span>{text.search}</span>
          <div className="fb-search-wrap">
            <Search size={16} className="fb-search-icon" aria-hidden="true" />
            <input
              type="search"
              placeholder={text.placeholder}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            />
            {search && (
              <button
                type="button"
                className="fb-search-clear-btn"
                aria-label={text.clearSearch}
                onClick={() => { setSearch(""); setPage(1); }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </label>
      </div>

      <div className="fb-history-controls-bottom">
        <label className="fb-history-field fb-field-wallet">
          <span>{text.wallet}</span>
          <div className="fb-select-wrap">
            <select
              value={walletId}
              onChange={(event) => { setWalletId(event.target.value); setCategory("all"); setPage(1); }}
            >
              <option value="all">{text.allWallets}</option>
              {state.wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {nameOfWallet(wallet.id)} · {wallet.currency}{wallet.archived ? " · " + text.archived : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="fb-select-chevron" aria-hidden="true" />
          </div>
        </label>

        <label className="fb-history-field fb-field-kind">
          <span>{text.kind}</span>
          <div className="fb-select-wrap">
            <select
              value={kind}
              onChange={(event) => { setKind(event.target.value as Kind); setCategory("all"); setPage(1); }}
            >
              <option value="all">{text.all}</option>
              <option value="expense">{text.expense}</option>
              <option value="income">{text.income}</option>
              <option value="transfer">{text.transfer}</option>
            </select>
            <ChevronDown size={14} className="fb-select-chevron" aria-hidden="true" />
          </div>
        </label>

        <label className="fb-history-field fb-field-category">
          <span>{text.category}</span>
          <div className="fb-select-wrap">
            <select
              value={category}
              onChange={(event) => { setCategory(event.target.value); setPage(1); }}
            >
              <option value="all">{text.allCategories}</option>
              {category !== "all" && !availableCategories.includes(category) && (
                <option value={category}>{resolveCategoryDisplayName(category, lang, text.noCategory)}</option>
              )}
              {availableCategories.map((value) => (
                <option key={value} value={value}>{resolveCategoryDisplayName(value, lang, text.noCategory)}</option>
              ))}
            </select>
            <ChevronDown size={14} className="fb-select-chevron" aria-hidden="true" />
          </div>
        </label>

        <div className="fb-history-period-field">
          <span>{text.period}</span>
          <HistoryPeriodPicker
            value={period}
            onChange={(value) => { setPeriod(value); setPage(1); }}
            lang={lang}
          />
        </div>

        <div className="fb-history-action-field">
          <button
            type="button"
            className="fb-history-clear"
            onClick={reset}
          >
            <RotateCcw size={14} />
            <span>{text.clear}</span>
          </button>
        </div>
      </div>

      {invalidRange && <p className="fb-history-range-error" role="alert">{text.ranges}</p>}
    </section>

    <div className="fb-history-summary">
      {(["income", "expense"] as const).map((type) => (
        <div key={type} className={"fb-history-flow " + type}>
          <div>
            <span>
              {type === "income" ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
              {type === "income" ? text.totalIncome : text.totalExpense}
            </span>
            <small>
              {walletId === "all"
                ? text.allWalletsInPeriod
                : nameOfWallet(walletId)}
            </small>
          </div>
          <div className="fb-history-flow-values">
            {totals(type).map((total) => (
              <b key={total.currency}>{total.label}</b>
            ))}
          </div>
        </div>
      ))}
    </div>

    <section className="fb-history-list" aria-label={text.title}>
      <div className="fb-history-list-heading">
        <h2>{text.title}</h2>
        <span>{records.length} {text.count} · {sample ? text.sample : text.saved}</span>
      </div>
      {visible.length === 0 ? (
        <div className="fb-history-empty">
          <ReceiptText size={30} />
          <h3>{text.empty}</h3>
          <p>{text.emptyHint}</p>
        </div>
      ) : (
        visible.map((record) => {
          const label = record.type === "income" ? text.income : record.type === "transfer" ? text.transfer : text.expense;
          const IconComponent = record.type === "income" ? ArrowDownLeft : record.type === "transfer" ? ArrowRightLeft : ArrowUpRight;
          const signed = record.type === "income" ? record.amount : record.type === "expense" ? -record.amount : record.amount;
          const sign = record.type === "transfer" ? "" : signed >= 0 ? "+" : "−";
          return (
            <article key={record.id} className={"fb-history-record " + record.type}>
              <div className="fb-history-record-heading">
                <span className="fb-history-record-icon"><IconComponent size={20} /></span>
                <div>
                  <h3>{record.title || resolveCategoryDisplayName(record.category, lang, text.noCategory)}</h3>
                  <p><time dateTime={record.occurredAt || record.date}>{dateLabel(record)}</time> · {record.sourceLabel || (sample ? text.syntheticData : text.saved)}</p>
                </div>
                <b className="fb-history-amount">{sign}{amount(Math.abs(record.amount), currencyOf(record))}</b>
              </div>
              <p className="fb-history-source">
                {text.source} · <b>{nameOfWallet(record.wallet)}</b>{record.type === "transfer" && record.targetWallet ? <span> → {nameOfWallet(record.targetWallet)}</span> : null}
              </p>
              <div className="fb-history-tags">
                <span className="fb-history-kind">{label}</span>
                <span>{resolveCategoryDisplayName(record.category, lang, text.noCategory)}{record.subcategory ? " / " + record.subcategory : ""}</span>
                {record.classification?.method && <span>{record.classification.method === "automatic" ? text.auto : text.manual}</span>}
                {typeof record.classification?.confidence === "number" && record.classification.confidence >= 0 && record.classification.confidence <= 1 && <span>{Math.round(record.classification.confidence * 100)}%</span>}
                <span className="fb-history-recorded">{text.recorded}</span>
              </div>
              <div className="fb-history-details">
                <details>
                  <summary>{text.why}</summary>
                  <p>{record.classification?.reason || text.reason + " “" + resolveCategoryDisplayName(record.category, lang, text.noCategory) + "”."}</p>
                </details>
                <details>
                  <summary>{text.detail}</summary>
                  <dl>
                    <div><dt>{text.reference}</dt><dd>{record.id}</dd></div>
                    <div><dt>{text.source}</dt><dd>{nameOfWallet(record.wallet)}</dd></div>
                    {record.targetWallet && <div><dt>{text.target}</dt><dd>{nameOfWallet(record.targetWallet)}</dd></div>}
                    {record.note && <div><dt>{text.note}</dt><dd>{record.note}</dd></div>}
                  </dl>
                </details>
              </div>
            </article>
          );
        })
      )}
      <footer className="fb-history-pagination">
        <span>{text.showing} {records.length ? (activePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(activePage * PAGE_SIZE, records.length)} / {records.length}</span>
        <div>
          <button type="button" aria-label={text.previous} disabled={activePage <= 1} onClick={() => setPage(activePage - 1)}><ChevronLeft size={18} /></button>
          <span>{text.page} {activePage} {text.of} {pages}</span>
          <button type="button" aria-label={text.next} disabled={activePage >= pages} onClick={() => setPage(activePage + 1)}><ChevronRight size={18} /></button>
        </div>
      </footer>
    </section>

    <button
      type="button"
      className="r-fab fb-history-add"
      aria-label={text.addTransaction}
      onClick={() => navigate("addTransactionChatMode")}
    >
      <Plus size={28} />
    </button>

    {calendarLedgerOpen && (
      <CalendarLedgerModal
        onClose={() => setCalendarLedgerOpen(false)}
        navigate={navigate}
      />
    )}
  </main>;
}
