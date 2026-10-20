"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Search, Calendar, ChevronDown, Trash2 } from "lucide-react";

export interface TransactionItem {
  id: string;
  title: string;
  amount: number;
  category: string;
  categoryIcon?: string;
  emoji: string;
  date: string;
  wallet: string;
  isExpense: boolean;
}

interface TransactionsTabProps {
  transactions: TransactionItem[];
  onDeleteTransaction?: (id: string) => void;
  onOpenAdd?: () => void;
}

export function TransactionsTab({
  transactions,
  onDeleteTransaction,
  onOpenAdd,
}: TransactionsTabProps) {
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = transactions.filter((tx) => {
    if (filterType === "expense" && !tx.isExpense) return false;
    if (filterType === "income" && tx.isExpense) return false;
    if (searchTerm && !tx.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 animate-in fade-in duration-200">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Giao dịch</h2>
          <p className="text-xs text-slate-500">Xem và quản lý tất cả các khoản chi tiêu và thu nhập</p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Tháng 10, 2026</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Tìm kiếm giao dịch theo tên..."
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-2xs"
        />
      </div>

      {/* Type Filter Pills */}
      <div className="flex items-center gap-2">
        {[
          { key: "all", label: "Tất cả" },
          { key: "expense", label: "Chi phí" },
          { key: "income", label: "Thu nhập" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilterType(t.key as "all" | "expense" | "income")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filterType === t.key
                ? "bg-[#00bebc] text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transactions List */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-3 text-3xl flex items-center justify-center rounded-2xl bg-teal-50 text-teal-600">
              👛
            </div>
            <p className="text-sm font-bold text-slate-800">Chưa có giao dịch nào</p>
            <p className="text-xs text-slate-400 mt-1">Bấm nút (+) hoặc thêm giao dịch mới để bắt đầu theo dõi!</p>
            {onOpenAdd && (
              <button
                type="button"
                onClick={onOpenAdd}
                className="mt-4 px-5 py-2.5 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] text-white text-xs font-bold shadow-sm transition-all"
              >
                + Thêm giao dịch đầu tiên
              </button>
            )}
          </div>
        ) : (
          filtered.map((tx) => (
            <div
              key={tx.id}
              className="p-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#d6f3f0] flex items-center justify-center text-xl shrink-0 relative overflow-hidden">
                  {tx.categoryIcon ? (
                    <Image
                      src={tx.categoryIcon}
                      alt={tx.category}
                      width={24}
                      height={24}
                      className="object-contain"
                    />
                  ) : (
                    <span>{tx.emoji}</span>
                  )}
                </div>

                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">{tx.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                    <span>{tx.category}</span>
                    <span>•</span>
                    <span>{tx.wallet}</span>
                    <span>•</span>
                    <span>{tx.date}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-sm sm:text-base font-black ${
                    tx.isExpense ? "text-[#f2557d]" : "text-emerald-600"
                  }`}
                >
                  {tx.isExpense ? "-" : "+"}${tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>

                {onDeleteTransaction && (
                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(tx.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                    title="Xoá giao dịch"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
