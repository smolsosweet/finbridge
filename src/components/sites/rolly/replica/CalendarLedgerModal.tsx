"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { Modal } from "./Ui";
import { DASHBOARD_SAMPLE, formatHomeMoney } from "./Dashboard";
import { categoryIcon } from "./Categories";
import { useAppState } from "./store";
import { resolveLanguage, resolveWalletDisplayName } from "@/lib/i18n";

interface CalendarLedgerModalProps {
  onClose: () => void;
  navigate: (screen: string) => void;
  initialDate?: string;
}

const COPY = {
  vi: {
    title: "Lịch thu chi",
    subtitle: "Theo dõi dòng tiền thu & chi theo từng ngày",
    today: "Hôm nay",
    prevMonth: "Tháng trước",
    nextMonth: "Tháng sau",
    currency: "Tiền tệ",
    totalMonth: "Tổng tháng",
    income: "Thu",
    expense: "Chi",
    net: "Chênh lệch",
    transactions: "giao dịch",
    noTransactions: "Không có giao dịch nào trong ngày này.",
    noTransactionsInCurrency: "Không có giao dịch nào bằng tiền tệ này trong ngày.",
    otherCurrencyNotice: "Ngày này có thêm giao dịch:",
    addForDay: "Thêm giao dịch ngày này",
    weekDays: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    close: "Đóng",
  },
  en: {
    title: "Calendar Ledger",
    subtitle: "Daily income and expense tracking",
    today: "Today",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    currency: "Currency",
    totalMonth: "Month totals",
    income: "Income",
    expense: "Expense",
    net: "Net",
    transactions: "transactions",
    noTransactions: "No transactions on this day.",
    noTransactionsInCurrency: "No transactions in this currency on this day.",
    otherCurrencyNotice: "This date also has records in:",
    addForDay: "Add transaction for this date",
    weekDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    close: "Close",
  },
  zh: {
    title: "收支日历",
    subtitle: "按日追踪收入与支出流水",
    today: "今天",
    prevMonth: "上个月",
    nextMonth: "下个月",
    currency: "货币",
    totalMonth: "月度汇总",
    income: "收入",
    expense: "支出",
    net: "结余",
    transactions: "笔交易",
    noTransactions: "当日暂无交易记录。",
    noTransactionsInCurrency: "当日暂无此币种的交易记录。",
    otherCurrencyNotice: "当日还有其他币种流水：",
    addForDay: "为此日期添加交易",
    weekDays: ["一", "二", "三", "四", "五", "六", "日"],
    close: "关闭",
  },
};

function formatCompactValue(amount: number, currency: string): string {
  const curr = (currency || "VND").toUpperCase();
  const abs = Math.abs(amount);
  if (abs === 0) return "0";
  if (curr === "VND") {
    if (abs >= 1_000_000_000) return (abs / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
    if (abs >= 1_000_000) return (abs / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
    if (abs >= 1_000) return Math.round(abs / 1e3) + "k";
    return String(Math.round(abs));
  }
  // USD, CNY, EUR, etc.
  if (abs >= 1_000_000) return (abs / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000) return (abs / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(Math.round(abs));
}

function toLocalDateString(d: Date): string {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}

export function CalendarLedgerModal({ onClose, navigate, initialDate }: CalendarLedgerModalProps) {
  const state = useAppState();
  const lang = resolveLanguage(state.settings.language);
  const t = COPY[lang];
  const locale = lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US";

  const todayStr = useMemo(() => toLocalDateString(new Date()), []);
  const initial = initialDate || todayStr;
  const initialYear = Number(initial.slice(0, 4)) || 2026;
  const initialMonth = (Number(initial.slice(5, 7)) || 10) - 1;

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-indexed
  const [selectedDate, setSelectedDate] = useState(initial);

  // Wallets map & records pool
  const walletMap = useMemo(() => new Map(state.wallets.map((w) => [w.id, w])), [state.wallets]);
  const primaryCurrency = (state.wallets[0]?.currency || "VND").toUpperCase();

  type AnyRecord = {
    id: string;
    title?: string;
    amount: number;
    type: "expense" | "income" | "transfer";
    category: string;
    subcategory?: string;
    date: string;
    wallet?: string;
    targetWallet?: string;
    note?: string;
    currency?: string;
  };

  const allRecords = useMemo((): AnyRecord[] => {
    if (state.transactions && state.transactions.length > 0) {
      return state.transactions;
    }
    return DASHBOARD_SAMPLE.map((s) => ({
      ...s,
      wallet: s.wallet || state.wallets.find((w) => w.currency === s.currency)?.id || "default",
    }));
  }, [state.transactions, state.wallets]);

  // Detected unique currencies
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    state.wallets.forEach((w) => { if (w.currency) set.add(w.currency.toUpperCase()); });
    allRecords.forEach((r) => {
      const c = r.currency || (r.wallet ? walletMap.get(r.wallet)?.currency : undefined);
      if (c) set.add(c.toUpperCase());
    });
    if (set.size === 0) set.add("VND");
    return Array.from(set).sort();
  }, [state.wallets, allRecords, walletMap]);

  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    return availableCurrencies.includes(primaryCurrency) ? primaryCurrency : (availableCurrencies[0] || "VND");
  });

  const activeCurrency = useMemo(() => {
    if (availableCurrencies.includes(selectedCurrency)) return selectedCurrency;
    return availableCurrencies[0] || primaryCurrency;
  }, [availableCurrencies, selectedCurrency, primaryCurrency]);

  const currencyOf = useCallback(
    (r: AnyRecord) => (r.currency || (r.wallet ? walletMap.get(r.wallet)?.currency : undefined) || primaryCurrency).toUpperCase(),
    [walletMap, primaryCurrency]
  );

  // Navigation handlers
  const changeMonth = (delta: number) => {
    const nextDate = new Date(year, month + delta, 1);
    const nextY = nextDate.getFullYear();
    const nextM = nextDate.getMonth();
    setYear(nextY);
    setMonth(nextM);
    // Align selected date to the same day number or 1st of next month
    const curDay = Number(selectedDate.slice(8, 10)) || 1;
    const maxDay = new Date(nextY, nextM + 1, 0).getDate();
    const targetDay = Math.min(curDay, maxDay);
    setSelectedDate([nextY, String(nextM + 1).padStart(2, "0"), String(targetDay).padStart(2, "0")].join("-"));
  };

  const jumpToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(todayStr);
  };

  // Month stats calculation
  const monthKeyPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthRecords = useMemo(() => {
    return allRecords.filter((r) => r.date.startsWith(monthKeyPrefix));
  }, [allRecords, monthKeyPrefix]);

  const monthTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthRecords.forEach((r) => {
      if (currencyOf(r) === activeCurrency) {
        if (r.type === "income") income += r.amount;
        else if (r.type === "expense") expense += r.amount;
      }
    });
    return { income, expense, net: income - expense, currency: activeCurrency };
  }, [monthRecords, activeCurrency, currencyOf]);

  // Calendar cells matrix: Monday to Sunday
  const calendarCells = useMemo(() => {
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // 0 for Mon, 6 for Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const cellDate = new Date(year, month, i - firstDayIndex + 1);
      const cellDateStr = toLocalDateString(cellDate);
      const isCurrentMonth = cellDate.getMonth() === month;
      const isToday = cellDateStr === todayStr;
      const isSelected = cellDateStr === selectedDate;

      const dayTxs = allRecords.filter((r) => r.date === cellDateStr);

      let dayIncome = 0;
      let dayExpense = 0;
      let hasOtherCurrency = false;

      dayTxs.forEach((r) => {
        const c = currencyOf(r);
        if (c === activeCurrency) {
          if (r.type === "income") dayIncome += r.amount;
          else if (r.type === "expense") dayExpense += r.amount;
        } else {
          hasOtherCurrency = true;
        }
      });

      return {
        dateStr: cellDateStr,
        dayNumber: cellDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        income: dayIncome,
        expense: dayExpense,
        hasOtherCurrency,
        txCount: dayTxs.length,
        displayCurrency: activeCurrency,
      };
    });
  }, [year, month, todayStr, selectedDate, allRecords, activeCurrency, currencyOf]);

  // Selected Day records
  const selectedDayAllRecords = useMemo(() => {
    return allRecords.filter((r) => r.date === selectedDate);
  }, [allRecords, selectedDate]);

  const selectedDayRecords = useMemo(() => {
    return selectedDayAllRecords.filter((r) => currencyOf(r) === activeCurrency);
  }, [selectedDayAllRecords, activeCurrency, currencyOf]);

  const otherCurrenciesOnDate = useMemo(() => {
    const set = new Set<string>();
    selectedDayAllRecords.forEach((r) => {
      const c = currencyOf(r);
      if (c !== activeCurrency) set.add(c);
    });
    return Array.from(set).sort();
  }, [selectedDayAllRecords, activeCurrency, currencyOf]);

  // Selected Day Totals for active currency
  const selectedDayTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    selectedDayRecords.forEach((r) => {
      if (r.type === "income") income += r.amount;
      else if (r.type === "expense") expense += r.amount;
    });
    return { income, expense };
  }, [selectedDayRecords]);

  // Format full date header: e.g. "Thứ Tư, 08/10/2026"
  const formattedSelectedDateHeader = useMemo(() => {
    const parts = selectedDate.split("-").map(Number);
    if (parts.length !== 3) return selectedDate;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (isNaN(d.getTime())) return selectedDate;
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }, [selectedDate, locale]);

  const monthLabel = useMemo(() => {
    const d = new Date(year, month, 1);
    return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(d);
  }, [year, month, locale]);

  return (
    <Modal title={t.title} wide onClose={onClose}>
      <div className="fb-calendar-ledger-modal">
        {/* Month Stepper & Currency Selector */}
        <div className="fb-cal-controls-row">
          <div className="fb-cal-month-stepper">
            <button
              type="button"
              className="fb-cal-nav-btn"
              aria-label={t.prevMonth}
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="fb-cal-month-heading">{monthLabel}</span>
            <button
              type="button"
              className="fb-cal-nav-btn"
              aria-label={t.nextMonth}
              onClick={() => changeMonth(1)}
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              className="fb-cal-today-pill"
              onClick={jumpToToday}
              title={t.today}
            >
              <RotateCcw size={13} />
              <span>{t.today}</span>
            </button>
          </div>

          {availableCurrencies.length > 1 ? (
            <div className="fb-cal-currency-selector-box">
              <label htmlFor="fb-cal-currency-dropdown" className="fb-cal-curr-label">
                {t.currency}:
              </label>
              <select
                id="fb-cal-currency-dropdown"
                className="fb-cal-currency-select"
                value={activeCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                aria-label={t.currency}
              >
                {availableCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="fb-cal-currency-single-badge" title={t.currency}>
              <span className="fb-cal-curr-label">{t.currency}:</span>
              <b className="fb-cal-curr-val">{activeCurrency}</b>
            </div>
          )}
        </div>

        {/* Month Summary Bar */}
        <div className="fb-cal-month-summary-bar">
          <div className="fb-cal-summary-item inc">
            <span>{t.income} ({monthTotals.currency})</span>
            <b>+{formatHomeMoney(monthTotals.income, monthTotals.currency)}</b>
          </div>
          <div className="fb-cal-summary-item exp">
            <span>{t.expense} ({monthTotals.currency})</span>
            <b>−{formatHomeMoney(monthTotals.expense, monthTotals.currency)}</b>
          </div>
          <div className="fb-cal-summary-item net">
            <span>{t.net} ({monthTotals.currency})</span>
            <b className={monthTotals.net >= 0 ? "r-income" : "r-expense"}>
              {monthTotals.net >= 0 ? "+" : "−"}
              {formatHomeMoney(Math.abs(monthTotals.net), monthTotals.currency)}
            </b>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="fb-cal-grid-wrapper">
          <div className="fb-cal-weekdays-row">
            {t.weekDays.map((dayName) => (
              <span key={dayName} className="fb-cal-weekday-label">
                {dayName}
              </span>
            ))}
          </div>

          <div className="fb-cal-days-grid" role="grid">
            {calendarCells.map((cell) => {
              const hasIncome = cell.income > 0;
              const hasExpense = cell.expense > 0;
              return (
                <button
                  type="button"
                  key={cell.dateStr}
                  className={[
                    "fb-cal-day-cell",
                    cell.isCurrentMonth ? "" : "is-other-month",
                    cell.isToday ? "is-today" : "",
                    cell.isSelected ? "is-selected" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => setSelectedDate(cell.dateStr)}
                  aria-label={`${cell.dateStr}: +${cell.income} -${cell.expense}`}
                >
                  <span className="fb-cal-day-num">{cell.dayNumber}</span>
                  <div className="fb-cal-cell-totals">
                    {hasIncome && (
                      <span className="fb-cal-cell-tag inc">
                        +{formatCompactValue(cell.income, cell.displayCurrency)}
                      </span>
                    )}
                    {hasExpense && (
                      <span className="fb-cal-cell-tag exp">
                        −{formatCompactValue(cell.expense, cell.displayCurrency)}
                      </span>
                    )}
                  </div>
                  {cell.hasOtherCurrency && (
                    <span className="fb-cal-multi-dot" title="Có giao dịch ngoại tệ khác">•</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Section */}
        <div className="fb-cal-selected-day-section">
          <div className="fb-cal-selected-header">
            <div>
              <h3 className="fb-cal-selected-title">{formattedSelectedDateHeader}</h3>
              <p className="fb-cal-selected-meta">
                {selectedDayRecords.length} {t.transactions} ({activeCurrency})
              </p>
            </div>
            {(selectedDayTotals.income > 0 || selectedDayTotals.expense > 0) && (
              <div className="fb-cal-selected-totals">
                <div className="fb-cal-selected-tot-row">
                  {selectedDayTotals.income > 0 && (
                    <span className="r-income">+{formatHomeMoney(selectedDayTotals.income, activeCurrency)}</span>
                  )}
                  {selectedDayTotals.expense > 0 && (
                    <span className="r-expense">−{formatHomeMoney(selectedDayTotals.expense, activeCurrency)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {otherCurrenciesOnDate.length > 0 && (
            <div className="fb-cal-other-currs-banner">
              <span>{t.otherCurrencyNotice}</span>
              <div className="fb-cal-other-currs-actions">
                {otherCurrenciesOnDate.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="fb-cal-switch-curr-btn"
                    onClick={() => setSelectedCurrency(c)}
                  >
                    {c} ➔
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedDayRecords.length === 0 ? (
            <div className="fb-cal-empty-card">
              <CalendarDays size={26} />
              <p>
                {selectedDayAllRecords.length > 0
                  ? `${t.noTransactionsInCurrency} (${activeCurrency})`
                  : t.noTransactions}
              </p>
            </div>
          ) : (
            <div className="fb-cal-tx-list">
              {selectedDayRecords.map((record) => {
                const w = record.wallet ? walletMap.get(record.wallet) : undefined;
                const wName = w ? resolveWalletDisplayName(w.name, lang) : (record.wallet || "");
                const isInc = record.type === "income";
                const isExp = record.type === "expense";
                const sign = isInc ? "+" : isExp ? "−" : "";
                return (
                  <div key={record.id} className={`fb-cal-tx-card ${record.type}`}>
                    <span className="fb-cal-tx-icon" aria-hidden="true">
                      {categoryIcon(record.category, state.categoryMeta)}
                    </span>
                    <div className="fb-cal-tx-info">
                      <b>{record.title || record.category || "Giao dịch"}</b>
                      <small>
                        {record.category}
                        {record.subcategory ? ` / ${record.subcategory}` : ""}
                        {" · "}
                        {wName}
                        {record.note ? ` · ${record.note}` : ""}
                      </small>
                    </div>
                    <b className={`fb-cal-tx-amount ${isInc ? "r-income" : isExp ? "r-expense" : ""}`}>
                      {sign}{formatHomeMoney(record.amount, activeCurrency)}
                    </b>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className="fb-cal-add-tx-btn"
            onClick={() => {
              onClose();
              navigate("addTransactionChatMode");
            }}
          >
            <Plus size={16} />
            <span>{t.addForDay} ({selectedDate})</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
