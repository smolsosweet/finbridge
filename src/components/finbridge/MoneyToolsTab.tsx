"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Plus, PiggyBank, CreditCard, PieChart, Wallet as WalletIcon } from "lucide-react";

interface MoneyToolsTabProps {
  onAddSavings?: () => void;
}

export function MoneyToolsTab({ onAddSavings }: MoneyToolsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"savings" | "debt" | "budgets" | "wallets">("savings");

  const savingsGoals = [
    { title: "Quỹ khẩn cấp (Emergency Fund)", target: 5000, current: 3250, icon: "🛡️", color: "#00bebc" },
    { title: "Mua Laptop mới", target: 1500, current: 900, icon: "💻", color: "#6366f1" },
    { title: "Chuyến du lịch mùa hè", target: 800, current: 800, icon: "✈️", color: "#10b981" },
  ];

  const debts = [
    { title: "Thẻ tín dụng VCB", total: 1200, paid: 450, interest: "1.5%/tháng", dueDate: "25 Hàng tháng" },
    { title: "Vay mua xe máy", total: 3000, paid: 2100, interest: "0.8%/tháng", dueDate: "10 Hàng tháng" },
  ];

  const budgets = [
    { category: "Ăn uống & Cà phê", limit: 600, spent: 345, emoji: "🍔", color: "#22c3ce" },
    { category: "Đi lại & Xăng xe", limit: 150, spent: 85, emoji: "🚕", color: "#f59e0b" },
    { category: "Mua sắm & Tiêu vặt", limit: 300, spent: 280, emoji: "👕", color: "#ec4899" },
    { category: "Hoá đơn & Nhà cửa", limit: 1200, spent: 1200, emoji: "🏠", color: "#8b5cf6" },
  ];

  const vietnameseBanks = [
    { name: "Vietcombank (VCB)", logo: "/finbridge/bank_logos/vcb.png", balance: "$4,250.00" },
    { name: "Techcombank (TCB)", logo: "/finbridge/bank_logos/tcb.png", balance: "$1,820.50" },
    { name: "MB Bank", logo: "/finbridge/bank_logos/mb.png", balance: "$960.00" },
    { name: "BIDV", logo: "/finbridge/bank_logos/bidv.png", balance: "$640.20" },
    { name: "ACB", logo: "/finbridge/bank_logos/acb.png", balance: "$350.00" },
    { name: "TPBank", logo: "/finbridge/bank_logos/tpb.png", balance: "$1,120.00" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Công cụ tiền tệ</h2>
        <p className="text-xs text-slate-500">Bộ công cụ toàn diện giúp tối ưu hoá và làm chủ tài chính của bạn</p>
      </div>

      {/* 4 Tool Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { key: "savings", label: "Tiết kiệm", icon: PiggyBank },
          { key: "debt", label: "Xử lý nợ", icon: CreditCard },
          { key: "budgets", label: "Ngân sách", icon: PieChart },
          { key: "wallets", label: "Ví & Ngân hàng", icon: WalletIcon },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeSubTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveSubTab(item.key as typeof activeSubTab)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-20 ${
                active
                  ? "bg-[#e5f8f7] border-[#00bebc] text-slate-900 shadow-2xs"
                  : "bg-white border-slate-200/80 text-slate-600 hover:border-slate-300"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-teal-600" : "text-slate-400"}`} />
              <span className={`text-xs font-bold ${active ? "text-teal-900 font-extrabold" : "text-slate-700"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* SUB-VIEW 1: TIẾT KIỆM (SAVINGS) */}
      {activeSubTab === "savings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Mục tiêu tiết kiệm của bạn</h3>
            <button
              type="button"
              onClick={onAddSavings || (() => alert("Tạo mục tiêu tiết kiệm mới"))}
              className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo mục tiêu</span>
            </button>
          </div>

          <div className="space-y-3">
            {savingsGoals.map((g, i) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <div key={i} className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{g.icon}</span>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{g.title}</p>
                        <p className="text-[11px] text-slate-400">
                          ${g.current.toLocaleString()} / ${g.target.toLocaleString()} ({pct}%)
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-teal-600">
                      {pct === 100 ? "🎉 Hoàn thành" : `Còn thiếu $${(g.target - g.current).toLocaleString()}`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-[#00bebc]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: NỢ (DEBT CRUSHER) */}
      {activeSubTab === "debt" && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-amber-50/70 border border-amber-200/80 p-4 flex items-center gap-3">
            <span className="text-2xl">🔨</span>
            <div>
              <p className="text-xs font-bold text-amber-900">Kẻ Nghiền Nát Nợ (Debt Crusher)</p>
              <p className="text-[11px] text-amber-800/80">Theo dõi các khoản nợ của bạn và nỗ lực trả hết chúng đúng hạn!</p>
            </div>
          </div>

          <div className="space-y-3">
            {debts.map((d, i) => {
              const remaining = d.total - d.paid;
              const pct = Math.round((d.paid / d.total) * 100);
              return (
                <div key={i} className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{d.title}</p>
                      <p className="text-[11px] text-slate-400">Hạn trả: {d.dueDate} • Lãi: {d.interest}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-[#f2557d]">Còn nợ: ${remaining.toLocaleString()}</p>
                      <span className="text-[10px] text-slate-400">Đã trả ${d.paid} ({pct}%)</span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: NGÂN SÁCH (BUDGETS) */}
      {activeSubTab === "budgets" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Hạn mức chi tiêu tháng này</h3>
          <div className="space-y-3">
            {budgets.map((b, i) => {
              const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
              const isOver = b.spent >= b.limit;
              return (
                <div key={i} className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{b.emoji}</span>
                      <span className="text-xs font-bold text-slate-900">{b.category}</span>
                    </div>
                    <span className={`text-xs font-black ${isOver ? "text-red-500" : "text-slate-700"}`}>
                      ${b.spent} / ${b.limit}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver ? "bg-red-500" : "bg-[#00bebc]"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-VIEW 4: VÍ & NGÂN HÀNG (WALLETS) */}
      {activeSubTab === "wallets" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Tài khoản & Ngân hàng liên kết</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {vietnameseBanks.map((bank, i) => (
              <div key={i} className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-7 relative flex items-center justify-center">
                    <Image
                      src={bank.logo}
                      alt={bank.name}
                      width={36}
                      height={24}
                      className="object-contain max-h-6"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{bank.name}</p>
                    <p className="text-[10px] text-teal-600 font-semibold">Đã đồng bộ</p>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-900">{bank.balance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
