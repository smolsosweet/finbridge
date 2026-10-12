"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  MessageSquare,
  ListOrdered,
  Wallet as WalletIcon,
  PieChart,
  Send,
  Mic,
  Camera,
  Flame,
  Sparkles,
  LogOut,
} from "lucide-react";
import { Transaction, Wallet, ChatMessage } from "@/types/rolly";
import { ReceiptScannerModal } from "./ReceiptScannerModal";
import { VoiceInputModal } from "./VoiceInputModal";

interface MainDashboardProps {
  onLogout: () => void;
}

const INITIAL_WALLETS: Wallet[] = [
  { id: "w1", name: "My Wallet", balance: 23174.92, currency: "$", icon: "👛" },
  { id: "w2", name: "Work", balance: 5493.61, currency: "£", icon: "💼" },
  { id: "w3", name: "Jun Travel", balance: -1270.52, currency: "$", icon: "🧳" },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    amount: 23.0,
    currency: "$",
    title: "dinner with friends",
    category: "Food & Drinks",
    categoryEmoji: "🍔",
    date: "Today, 7:30 PM",
    walletName: "My Wallet",
    isExpense: true,
  },
  {
    id: "t2",
    amount: 13.6,
    currency: "$",
    title: "Paper towels 6pk",
    category: "Grocery",
    categoryEmoji: "🛒",
    date: "Yesterday, 3:15 PM",
    walletName: "My Wallet",
    isExpense: true,
  },
  {
    id: "t3",
    amount: 13.0,
    currency: "$",
    title: "Olive oil 500ml",
    category: "Grocery",
    categoryEmoji: "🛒",
    date: "Yesterday, 3:15 PM",
    walletName: "My Wallet",
    isExpense: true,
  },
  {
    id: "t4",
    amount: 35.0,
    currency: "$",
    title: "tea time matcha",
    category: "Food & Drinks",
    categoryEmoji: "☕",
    date: "Jun 13, 2026",
    walletName: "My Wallet",
    isExpense: true,
    user: "Valerie",
  },
  {
    id: "t5",
    amount: 143.88,
    currency: "$",
    title: "team seafood dinner",
    category: "Food & Drinks",
    categoryEmoji: "🦞",
    date: "Jun 13, 2026",
    walletName: "My Wallet",
    isExpense: true,
    user: "Jeff",
  },
  {
    id: "t6",
    amount: 3500.0,
    currency: "$",
    title: "Salary Monthly Deposit",
    category: "Income",
    categoryEmoji: "💰",
    date: "Jun 01, 2026",
    walletName: "My Wallet",
    isExpense: false,
  },
];

const INITIAL_CHAT: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content:
      "Hello there! I'm Rolly, your AI money tracker. Type or say what you spent (e.g. 'Coffee 5.50', 'Taxi 22'), and I'll log and categorize it automatically!",
    timestamp: "10:00 AM",
  },
];

let idCounter = 100;

export function MainDashboard({ onLogout }: MainDashboardProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "transactions" | "wallets" | "analytics">("chat");
  const [wallets, setWallets] = useState<Wallet[]>(INITIAL_WALLETS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT);
  const [inputText, setInputText] = useState("");
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [streakDays, setStreakDays] = useState(7);

  // Helper to parse natural text into transactions
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    idCounter++;
    const currentId = `msg-${idCounter}`;
    const userMsg: ChatMessage = {
      id: currentId,
      role: "user",
      content: text,
      timestamp: "Just now",
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputText("");

    // Simulate AI parsing
    setTimeout(() => {
      idCounter++;
      const replyId = `msg-${idCounter}`;
      const match = text.match(/([a-zA-Z\s]+)?\s*(\$?(\d+(\.\d+)?))/);
      const isQuestion = text.includes("?") || text.toLowerCase().includes("how") || text.toLowerCase().includes("what");

      let botReply: ChatMessage;

      if (isQuestion) {
        botReply = {
          id: replyId,
          role: "assistant",
          content:
            "Based on your recent transactions, your biggest expense category this month is Food & Drinks ($237.88), followed by Grocery ($26.60). You're on track with your $1,000 budget with $762 remaining!",
          timestamp: "Just now",
        };
      } else {
        const amount = match ? parseFloat(match[2].replace("$", "")) : 20.0;
        const item = match && match[1]?.trim() ? match[1].trim() : "Expense item";

        let category = "Food & Drinks";
        let emoji = "🍔";
        if (item.toLowerCase().includes("coffee") || item.toLowerCase().includes("tea")) {
          category = "Food & Drinks";
          emoji = "☕";
        } else if (item.toLowerCase().includes("grab") || item.toLowerCase().includes("taxi") || item.toLowerCase().includes("gas")) {
          category = "Transportation";
          emoji = "🚕";
        } else if (item.toLowerCase().includes("shirt") || item.toLowerCase().includes("shoes")) {
          category = "Shopping";
          emoji = "👕";
        }

        const newTx: Transaction = {
          id: `tx-${idCounter}`,
          amount,
          currency: "$",
          title: item,
          category,
          categoryEmoji: emoji,
          date: "Just now",
          walletName: "My Wallet",
          isExpense: true,
        };

        setTransactions((prev) => [newTx, ...prev]);
        setWallets((prev) =>
          prev.map((w) => (w.id === "w1" ? { ...w, balance: w.balance - amount } : w))
        );
        setStreakDays((prev) => prev + 1);

        const wittyComments = [
          `Recorded! Another ${item}?! Hope it was worth every penny! 🌟`,
          `Got it! Logged $${amount} for ${item}. Adding to your daily streak! 🔥`,
          `Sweet! Added $${amount} under ${category}. Your wallet is still looking healthy! 💪`,
        ];
        const randomComment = wittyComments[Math.floor(Math.random() * wittyComments.length)];

        botReply = {
          id: replyId,
          role: "assistant",
          content: randomComment,
          timestamp: "Just now",
          transaction: {
            type: "Expense",
            category,
            item,
            amount,
            currency: "$",
            date: "Today",
            emoji,
          },
          budgetRemaining: {
            remaining: 959 - amount,
            total: 1000,
            category,
            currency: "$",
          },
        };
      }

      setChatMessages((prev) => [...prev, botReply]);
    }, 500);
  };

  const handleAddReceiptTransactions = (items: Array<{ title: string; amount: number; category: string; emoji: string }>) => {
    const newItems: Transaction[] = items.map((it, idx) => ({
      id: `rcpt-${Date.now()}-${idx}`,
      amount: it.amount,
      currency: "$",
      title: it.title,
      category: it.category,
      categoryEmoji: it.emoji,
      date: "Just now (Receipt)",
      walletName: "My Wallet",
      isExpense: true,
    }));

    setTransactions((prev) => [...newItems, ...prev]);

    idCounter++;
    const receiptMsg: ChatMessage = {
      id: `msg-${idCounter}`,
      role: "assistant",
      content: `I scanned your Fresh Mart receipt and successfully recorded ${items.length} line items totaling $26.60 into Grocery! 🛒`,
      timestamp: "Just now",
    };
    setChatMessages((prev) => [...prev, receiptMsg]);
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#f5f8f8] text-slate-800">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-teal-50 flex items-center justify-center p-0.5">
              <Image
                src="/sites/rolly/images/Welcome_Icon.png"
                alt="Rolly Mascot"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base text-slate-900">Rolly Assistant</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                  AI Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Total: ${wallets[0].balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Streak Badge */}
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200/60 px-2.5 py-1 rounded-full text-orange-600 text-xs font-bold shadow-2xs">
              <Flame className="w-3.5 h-3.5 fill-orange-500 text-orange-500" />
              <span>{streakDays}d Streak</span>
            </div>

            {/* Logout / Exit */}
            <button
              type="button"
              onClick={onLogout}
              title="Return to Welcome"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-24">
        {/* TAB 1: ASK ROLLY AI CHAT */}
        {activeTab === "chat" && (
          <div className="flex flex-col h-[calc(100vh-180px)] max-h-[700px] bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Chat Messages Scroll */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-2xs ${
                      msg.role === "user"
                        ? "bg-[#d9f5f1] text-slate-800 font-semibold rounded-tr-xs"
                        : "bg-white border border-slate-100 text-slate-700 rounded-tl-xs shadow-xs"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* If assistant attached a recorded transaction badge */}
                  {msg.transaction && (
                    <div className="mt-2 w-full max-w-xs rounded-2xl bg-white border border-slate-100 p-3 shadow-xs">
                      <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>Recorded: {msg.transaction.type}</span>
                        <span>{msg.transaction.date}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <span className="flex items-center justify-center rounded-full w-8 h-8 text-base bg-[#d6f3f0]">
                          {msg.transaction.emoji}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {msg.transaction.category}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{msg.transaction.item}</p>
                        </div>
                        <p className="text-xs font-extrabold text-slate-900">
                          ${msg.transaction.amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* If assistant attached budget remaining */}
                  {msg.budgetRemaining && (
                    <div className="mt-1.5 w-full max-w-xs rounded-2xl bg-white border border-slate-100 px-3 py-2 text-[11px] text-slate-600 shadow-2xs">
                      <span className="font-bold text-teal-600">
                        ${msg.budgetRemaining.remaining.toFixed(2)}
                      </span>{" "}
                      remaining from the budget of{" "}
                      <span className="font-bold text-slate-800">
                        ${msg.budgetRemaining.total.toLocaleString()}
                      </span>{" "}
                      for {msg.budgetRemaining.category}.
                    </div>
                  )}

                  <span className="text-[9px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="px-4 py-2 border-t border-slate-50 bg-slate-50/50 flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 shrink-0 uppercase tracking-wider">
                Try:
              </span>
              {[
                "Dinner 23",
                "Coffee 6.50",
                "Taxi 18 to office",
                "What are my biggest expenses?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSendMessage(suggestion)}
                  className="shrink-0 px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-teal-400 text-[11px] font-medium text-slate-600 transition-colors shadow-2xs cursor-pointer"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsVoiceOpen(true)}
                title="Voice Input"
                className="w-10 h-10 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsReceiptOpen(true)}
                title="Scan Receipt"
                className="w-10 h-10 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendMessage(inputText);
                }}
                placeholder="Log expense e.g. Lunch 12, or ask Rolly..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200"
              />

              <button
                type="button"
                onClick={() => handleSendMessage(inputText)}
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-full bg-[#00bebc] hover:bg-[#00abaa] disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS */}
        {activeTab === "transactions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
                <p className="text-xs text-slate-500">{transactions.length} records in My Wallet</p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Scan Receipt
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-50 overflow-hidden">
              {transactions.map((tx) => (
                <div key={tx.id} className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#d6f3f0] text-lg shrink-0">
                      {tx.categoryEmoji}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{tx.category}</p>
                      <p className="text-xs text-slate-400 capitalize">{tx.title}</p>
                      <span className="text-[10px] text-slate-400">{tx.date}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm font-extrabold ${
                        tx.isExpense ? "text-[#f2557d]" : "text-emerald-600"
                      }`}
                    >
                      {tx.isExpense ? "-" : "+"}${tx.amount.toFixed(2)}
                    </p>
                    {tx.user && (
                      <span className="text-[10px] text-slate-400 font-medium">👤 {tx.user}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: WALLETS */}
        {activeTab === "wallets" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your Wallets</h2>
              <p className="text-xs text-slate-500">Multi-currency accounts & balances</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-3.5">
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm relative overflow-hidden group hover:border-teal-300 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{w.icon}</span>
                    <span className="text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      {w.currency}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500">{w.name}</p>
                  <p
                    className={`text-xl font-extrabold mt-1 tracking-tight ${
                      w.balance < 0 ? "text-[#f2557d]" : "text-slate-900"
                    }`}
                  >
                    {w.currency}
                    {Math.abs(w.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>

            {/* Connected Vietnamese Banking Partners */}
            <div className="rounded-3xl bg-white p-5 border border-slate-100 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 mb-1">Supported Bank Connectors</h3>
              <p className="text-xs text-slate-400 mb-4">Auto-sync transactions and statements securely</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                {[
                  { name: "VCB", logo: "/sites/rolly/bank_logos/vcb.png" },
                  { name: "TCB", logo: "/sites/rolly/bank_logos/tcb.png" },
                  { name: "MB", logo: "/sites/rolly/bank_logos/mb.png" },
                  { name: "BIDV", logo: "/sites/rolly/bank_logos/bidv.png" },
                  { name: "ACB", logo: "/sites/rolly/bank_logos/acb.png" },
                  { name: "TPB", logo: "/sites/rolly/bank_logos/tpb.png" },
                  { name: "VPB", logo: "/sites/rolly/bank_logos/vpb.png" },
                ].map((b) => (
                  <div
                    key={b.name}
                    className="flex flex-col items-center justify-center p-2 rounded-2xl border border-slate-100 hover:border-slate-300 transition-colors bg-slate-50/50"
                  >
                    <div className="w-10 h-7 relative flex items-center justify-center">
                      <Image
                        src={b.logo}
                        alt={b.name}
                        width={36}
                        height={24}
                        className="object-contain max-h-6"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 mt-1">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ANALYTICS & BUDGETS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Spending & Budgets</h2>
              <p className="text-xs text-slate-500">Visual breakdowns & monthly plans</p>
            </div>

            {/* Donut & Breakdown Card */}
            <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-sm grid md:grid-cols-2 gap-6 items-center">
              <div className="flex flex-col items-center">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="none"
                      stroke="#22c3ce"
                      strokeWidth="35"
                      strokeDasharray="91 66"
                      strokeDashoffset="0"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="none"
                      stroke="#ef5350"
                      strokeWidth="35"
                      strokeDasharray="35 122"
                      strokeDashoffset="-91"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="25"
                      fill="none"
                      stroke="#f5a25d"
                      strokeWidth="35"
                      strokeDasharray="31 126"
                      strokeDashoffset="-126"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-[11px] font-semibold text-slate-400">Total Spent</span>
                    <span className="text-base font-extrabold text-slate-900">$2,227</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#22c3ce]" />
                    <span>Rent & Home</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">$1,600 (58%)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#ef5350]" />
                    <span>Dining Out</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">$500 (22%)</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#f5a25d]" />
                    <span>Utilities</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">$127 (20%)</span>
                </div>
              </div>
            </div>

            {/* AI Insights Suggestion Card */}
            <div className="rounded-3xl bg-[#e6f8f7] p-5 border border-teal-200/60 shadow-2xs">
              <div className="flex items-center gap-2 text-teal-800 font-bold text-sm mb-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Rolly Smart Insights</span>
              </div>
              <p className="text-xs text-teal-950/80 leading-relaxed">
                You spent 18% less on food deliveries this week compared to last week! If you keep cooking at home, you are projected to save <strong>$240</strong> by the end of the month.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 py-2 px-6">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "chat" ? "text-teal-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-[10px]">Ask Rolly</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("transactions")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "transactions" ? "text-teal-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <ListOrdered className="w-5 h-5" />
            <span className="text-[10px]">Records</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wallets")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "wallets" ? "text-teal-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <WalletIcon className="w-5 h-5" />
            <span className="text-[10px]">Wallets</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-colors cursor-pointer ${
              activeTab === "analytics" ? "text-teal-600 font-bold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <PieChart className="w-5 h-5" />
            <span className="text-[10px]">Budgets</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <ReceiptScannerModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onAddTransactions={handleAddReceiptTransactions}
      />

      <VoiceInputModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onSubmitVoice={(transcript) => handleSendMessage(transcript)}
      />
    </div>
  );
}
