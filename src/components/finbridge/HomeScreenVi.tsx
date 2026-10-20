"use client";

import React, { useState } from "react";
import {
  Pencil,
  Plus,
  Calendar,
  ChevronDown,
  Info,
  Home as HomeIcon,
  Wallet as WalletIcon,
  Coins,
  Settings as SettingsIcon,
  Mic,
  Camera,
  X,
  Check,
} from "lucide-react";
import { CheerleaderMascot } from "./CheerleaderMascot";
import { ReceiptScannerModal } from "./ReceiptScannerModal";
import { VoiceInputModal } from "./VoiceInputModal";
import { MilestonesModal } from "./MilestonesModal";
import { TransactionsTab, TransactionItem } from "./TransactionsTab";
import { MoneyToolsTab } from "./MoneyToolsTab";
import { SettingsTab } from "./SettingsTab";

interface HomeScreenViProps {
  onOpenLanding?: () => void;
  defaultTab?: "home" | "transactions" | "tools" | "settings";
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    title: "Ăn tối cùng bạn bè",
    amount: 23.0,
    category: "Ăn uống",
    categoryIcon: "/finbridge/category_icons/current/food-drinks--restaurant.png",
    emoji: "🍔",
    date: "Hôm nay, 19:30",
    wallet: "Ví chính",
    isExpense: true,
  },
  {
    id: "tx-2",
    title: "Khăn giấy 6 cuộn siêu thị",
    amount: 13.6,
    category: "Đi chợ siêu thị",
    categoryIcon: "/finbridge/category_icons/current/food-drinks--grocery.png",
    emoji: "🛒",
    date: "Hôm qua, 15:15",
    wallet: "Ví chính",
    isExpense: true,
  },
  {
    id: "tx-3",
    title: "Dầu ô liu 500ml",
    amount: 13.0,
    category: "Đi chợ siêu thị",
    categoryIcon: "/finbridge/category_icons/current/food-drinks--grocery.png",
    emoji: "🛒",
    date: "Hôm qua, 15:15",
    wallet: "Ví chính",
    isExpense: true,
  },
  {
    id: "tx-4",
    title: "Cà phê Highland sáng",
    amount: 2.5,
    category: "Cà phê & Đồ uống",
    categoryIcon: "/finbridge/category_icons/current/food-drinks--coffee.png",
    emoji: "☕",
    date: "10 Tháng 10",
    wallet: "Ví chính",
    isExpense: true,
  },
  {
    id: "tx-5",
    title: "Lương tháng chuyển khoản",
    amount: 2500.0,
    category: "Thu nhập",
    categoryIcon: "/finbridge/category_icons/current/money-work--salary.png",
    emoji: "💰",
    date: "01 Tháng 10",
    wallet: "Vietcombank",
    isExpense: false,
  },
];

export function HomeScreenVi({ onOpenLanding, defaultTab = "home" }: HomeScreenViProps) {
  const [activeTab, setActiveTab] = useState<"home" | "transactions" | "tools" | "settings">(defaultTab);
  const [typeFilter, setTypeFilter] = useState<"expense" | "income">("expense");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isMilestonesOpen, setIsMilestonesOpen] = useState(false);

  // Financial state
  const [transactions, setTransactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS);
  const [inputTitle, setInputTitle] = useState("");
  const [inputAmount, setInputAmount] = useState("");

  // Calculate totals from transactions
  const totalExpense = transactions
    .filter((t) => t.isExpense)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = transactions
    .filter((t) => !t.isExpense)
    .reduce((sum, t) => sum + t.amount, 0);

  const walletBalance = totalIncome - totalExpense;

  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(inputAmount);
    if (isNaN(amt) || amt <= 0) return;

    const isExp = typeFilter === "expense";
    const newTx: TransactionItem = {
      id: `tx-${Date.now()}`,
      title: inputTitle || (isExp ? "Chi phí tiêu vặt" : "Khoản thu nhập"),
      amount: amt,
      category: isExp ? "Ăn uống" : "Lương & Thưởng",
      categoryIcon: isExp
        ? "/finbridge/category_icons/current/food-drinks--restaurant.png"
        : "/finbridge/category_icons/current/money-work--salary.png",
      emoji: isExp ? "🍔" : "💰",
      date: "Vừa xong",
      wallet: "Ví chính",
      isExpense: isExp,
    };

    setTransactions((prev) => [newTx, ...prev]);
    setInputTitle("");
    setInputAmount("");
    setIsAddModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleAddReceiptTransactions = (
    items: Array<{ title: string; amount: number; category: string; emoji: string }>
  ) => {
    const newItems: TransactionItem[] = items.map((it, idx) => ({
      id: `rcpt-${Date.now()}-${idx}`,
      title: it.title,
      amount: it.amount,
      category: it.category,
      categoryIcon: "/finbridge/category_icons/current/food-drinks--grocery.png",
      emoji: it.emoji,
      date: "Vừa xong (Hoá đơn Fresh Mart)",
      wallet: "Ví chính",
      isExpense: true,
    }));

    setTransactions((prev) => [...newItems, ...prev]);
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-white text-slate-800 relative select-none">
      {/* Top Header / View Content */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-4 pb-28">
        {/* ========================================================= */}
        {/* TAB 1: TRANG CHỦ (CHÍNH XÁC NHƯ HÌNH 2)                     */}
        {/* ========================================================= */}
        {activeTab === "home" && (
          <div className="animate-in fade-in duration-200">
            {/* Row 1: Những cột mốc Button & Landing Switcher */}
            <div className="flex items-center justify-between w-full">
              {/* Trophy Milestones Pill */}
              <button
                type="button"
                onClick={() => setIsMilestonesOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200/80 text-amber-900 text-xs font-bold shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                <span className="text-sm">🏆</span>
                <span>Những cột mốc</span>
              </button>

              {onOpenLanding && (
                <button
                  type="button"
                  onClick={onOpenLanding}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200/60 transition-colors cursor-pointer"
                >
                  Về trang giới thiệu →
                </button>
              )}
            </div>

            {/* Row 2: Mascot in Center with "Chào 👋" Speech Bubble */}
            <div className="pt-6 pb-2 flex justify-center">
              <CheerleaderMascot greetingText="Chào 👋" />
            </div>

            {/* Row 3: Horizontal Wallets Cards */}
            <div className="flex items-center gap-3.5 my-3 overflow-x-auto no-scrollbar">
              {/* Wallet 1: Active Mint Card */}
              <div className="w-36 h-24 rounded-2xl bg-[#e3f7f5] border border-[#9de8e0] p-3 flex flex-col justify-between shadow-xs shrink-0 relative">
                <div className="flex items-center justify-between">
                  {/* Wallet outline icon */}
                  <div className="w-5 h-5 flex items-center justify-center text-slate-700">
                    <WalletIcon className="w-4 h-4" />
                  </div>
                  {/* Circle edit icon */}
                  <button
                    type="button"
                    onClick={() => alert("Chỉnh sửa tên và số dư ví")}
                    className="w-5 h-5 rounded-full border border-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-500">.</p>
                  <p className="text-base font-extrabold text-slate-900 leading-tight">
                    ${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 0 })}
                  </p>
                </div>
              </div>

              {/* Wallet 2: New Wallet Gray Card */}
              <button
                type="button"
                onClick={() => alert("Tính năng tạo ví mới")}
                className="w-36 h-24 rounded-2xl bg-[#dbe0e7] hover:bg-[#d1d7df] p-3 flex flex-col items-center justify-center text-slate-500 gap-1 shadow-xs shrink-0 transition-colors cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-bold text-slate-600">Ví mới</span>
              </button>
            </div>

            {/* Row 4: Date Filter Dropdowns */}
            <div className="flex flex-col gap-2 my-3">
              {/* Tháng 📅 ⌄ */}
              <button
                type="button"
                className="w-fit flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>Tháng</span>
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* tháng 10 năm 2026 ⌄ */}
              <button
                type="button"
                className="w-fit flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>tháng 10 năm 2026</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>

            {/* Row 5: Financial Summary Container (The large teal card from Image 2) */}
            <div className="rounded-3xl bg-[#c2f3ed] border border-[#a6ece3] p-4 sm:p-5 shadow-xs relative my-3">
              {/* Top of container: Thay đổi ròng */}
              <div className="flex items-start justify-between mb-3.5">
                <div>
                  <p className="text-xs font-bold text-slate-700">Thay đổi ròng</p>
                  <p className="text-base sm:text-lg font-black text-slate-900 mt-0.5">
                    ${(totalIncome - totalExpense).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => alert("Thay đổi ròng = Tổng thu nhập trừ đi Tổng chi phí trong kỳ")}
                  className="text-slate-500 hover:text-slate-800 p-1 cursor-pointer"
                  title="Thông tin chi tiết"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>

              {/* Inside two white cards */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Chi phí (Expense) Card */}
                <div
                  onClick={() => setTypeFilter("expense")}
                  className="rounded-2xl bg-white p-3.5 sm:p-4 text-center shadow-xs border border-white cursor-pointer hover:border-pink-200 transition-colors"
                >
                  <p className="text-xs font-bold text-[#f2557d]">Chi phí</p>
                  <p className="text-xs sm:text-sm font-extrabold text-[#f2557d] mt-1 flex items-center justify-center gap-1">
                    <span>🔻</span>
                    <span>${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                  </p>
                </div>

                {/* Thu nhập (Income) Card */}
                <div
                  onClick={() => setTypeFilter("income")}
                  className="rounded-2xl bg-white p-3.5 sm:p-4 text-center shadow-xs border border-white cursor-pointer hover:border-teal-200 transition-colors"
                >
                  <p className="text-xs font-bold text-[#00bebc]">Thu nhập</p>
                  <p className="text-xs sm:text-sm font-extrabold text-[#00bebc] mt-1 flex items-center justify-center gap-1">
                    <span>🔺</span>
                    <span>${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Row 6: Toggle Pills (Chi phí / Thu nhập) */}
            <div className="flex items-center justify-center gap-2 my-4">
              <button
                type="button"
                onClick={() => setTypeFilter("expense")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === "expense"
                    ? "bg-[#00bebc] text-white shadow-xs"
                    : "bg-[#dbe0e7] text-slate-600 hover:bg-slate-300"
                }`}
              >
                Chi phí
              </button>

              <button
                type="button"
                onClick={() => setTypeFilter("income")}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  typeFilter === "income"
                    ? "bg-[#00bebc] text-white shadow-xs"
                    : "bg-[#dbe0e7] text-slate-600 hover:bg-slate-300"
                }`}
              >
                Thu nhập
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GIAO DỊCH (TRANSACTIONS)                           */}
        {/* ========================================================= */}
        {activeTab === "transactions" && (
          <TransactionsTab
            transactions={transactions}
            onDeleteTransaction={handleDeleteTransaction}
            onOpenAdd={() => setIsAddModalOpen(true)}
          />
        )}

        {/* ========================================================= */}
        {/* TAB 3: CÔNG CỤ TIỀN TỆ (MONEY & CURRENCY TOOLS)           */}
        {/* ========================================================= */}
        {activeTab === "tools" && (
          <MoneyToolsTab onAddSavings={() => setIsAddModalOpen(true)} />
        )}

        {/* ========================================================= */}
        {/* TAB 4: CÀI ĐẶT (SETTINGS)                                 */}
        {/* ========================================================= */}
        {activeTab === "settings" && (
          <SettingsTab onLogout={onOpenLanding} />
        )}
      </div>

      {/* ========================================================= */}
      {/* FLOATING ACTION BUTTON (FAB +) TẠI GÓC DƯỚI PHẢI           */}
      {/* ========================================================= */}
      <div className="fixed bottom-20 right-6 sm:right-12 z-30">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-14 h-14 rounded-full bg-[#234b5e] hover:bg-[#1a3848] active:scale-95 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-all cursor-pointer"
          aria-label="Thêm giao dịch"
        >
          <Plus className="w-7 h-7" />
        </button>
      </div>

      {/* ========================================================= */}
      {/* THANH ĐIỀU HƯỚNG 4 TAB DƯỚI ĐÁY (EXACT NHƯ HÌNH BẠN GỬI)   */}
      {/* ========================================================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2.5 px-6">
        <div className="max-w-md mx-auto flex items-center justify-between">
          {/* Tab 1: Trang chủ */}
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "home" ? "text-[#00bebc] font-bold" : "text-[#8a929d] hover:text-slate-600"
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span className="text-[11px]">Trang chủ</span>
          </button>

          {/* Tab 2: Giao dịch */}
          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "transactions" ? "text-[#00bebc] font-bold" : "text-[#8a929d] hover:text-slate-600"
            }`}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[11px]">Giao dịch</span>
          </button>

          {/* Tab 3: Công cụ tiền tệ */}
          <button
            type="button"
            onClick={() => setActiveTab("tools")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "tools" ? "text-[#00bebc] font-bold" : "text-[#8a929d] hover:text-slate-600"
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[11px]">Công cụ tiền tệ</span>
          </button>

          {/* Tab 4: Cài đặt */}
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`flex flex-col items-center gap-1 transition-colors cursor-pointer ${
              activeTab === "settings" ? "text-[#00bebc] font-bold" : "text-[#8a929d] hover:text-slate-600"
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[11px]">Cài đặt</span>
          </button>
        </div>
      </nav>

      {/* ========================================================= */}
      {/* MODAL THÊM GIAO DỊCH (BẤM VÀO FAB +)                      */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-4">
              Thêm {typeFilter === "expense" ? "Chi phí" : "Thu nhập"}
            </h3>

            {/* AI Assistant Quick Actions */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsVoiceOpen(true);
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <Mic className="w-4 h-4 text-teal-600" />
                <span>Giọng nói AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIsReceiptOpen(true);
                }}
                className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-teal-50 border border-teal-100 text-teal-800 text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Quét hoá đơn</span>
              </button>
            </div>

            <form onSubmit={handleAddTransaction} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Mô tả giao dịch</label>
                <input
                  type="text"
                  required
                  value={inputTitle}
                  onChange={(e) => setInputTitle(e.target.value)}
                  placeholder="Ví dụ: Ăn trưa, Cà phê, Mua sách..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Số tiền ($)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={inputAmount}
                  onChange={(e) => setInputAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <Check className="w-4 h-4" />
                <span>Lưu giao dịch</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS PHỤ                                                */}
      {/* ========================================================= */}
      <ReceiptScannerModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onAddTransactions={handleAddReceiptTransactions}
      />

      <VoiceInputModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSubmitVoice={(transcript) => {
          setInputTitle(transcript);
          setInputAmount("15");
          setIsAddModalOpen(true);
        }}
      />

      <MilestonesModal
        isOpen={isMilestonesOpen}
        onClose={() => setIsMilestonesOpen(false)}
        streakCount={7}
      />
    </div>
  );
}
