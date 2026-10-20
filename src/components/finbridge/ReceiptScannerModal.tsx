"use client";

import React from "react";
import { X, Camera, Check, Sparkles } from "lucide-react";

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransactions: (items: Array<{ title: string; amount: number; category: string; emoji: string }>) => void;
}

const SAMPLE_RECEIPT_ITEMS = [
  { title: "Paper towels 6pk", amount: 13.6, category: "Grocery", emoji: "🛒" },
  { title: "Olive oil 500ml", amount: 13.0, category: "Grocery", emoji: "🛒" },
];

export function ReceiptScannerModal({ isOpen, onClose, onAddTransactions }: ReceiptScannerModalProps) {
  if (!isOpen) return null;

  const handleApply = () => {
    onAddTransactions(SAMPLE_RECEIPT_ITEMS);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-tight">AI Receipt Scanner</h3>
            <p className="text-[11px] text-slate-500">Auto-extract line items & taxes</p>
          </div>
        </div>

        {/* Paper Receipt Visual */}
        <div className="relative rounded-2xl bg-slate-50 p-3 mb-4">
          <div className="mx-auto w-[90%] bg-white px-4 py-3 font-mono rounded-lg shadow-sm border border-slate-100 text-[11px]">
            <p className="text-center font-bold tracking-widest text-slate-800 text-xs">FRESH MART</p>
            <p className="text-center text-[9px] text-slate-400">24 Market Street, Store #08</p>
            <div className="my-2 border-t border-dashed border-slate-200" />
            <div className="flex justify-between text-[8px] font-bold text-slate-400 tracking-wider">
              <span>ITEM</span>
              <span>USD</span>
            </div>
            <div className="mt-1 space-y-1 text-[10px] text-slate-700">
              <div className="flex justify-between">
                <span>PAPER TOWELS 6PK</span>
                <span>$13.60</span>
              </div>
              <div className="flex justify-between">
                <span>OLIVE OIL 500ML</span>
                <span>$13.00</span>
              </div>
            </div>
            <div className="my-2 border-t border-dashed border-slate-200" />
            <div className="flex justify-between items-baseline font-bold text-slate-900">
              <span className="text-[9px]">TOTAL</span>
              <span className="text-sm">$26.60</span>
            </div>
            <div className="flex justify-between text-[8px] text-slate-400">
              <span>INCL. TAX (10%)</span>
              <span>$2.42</span>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-teal-700 bg-teal-100/70 py-1 px-3 rounded-full w-fit mx-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>2 line items recognized by Vision AI</span>
          </div>
        </div>

        {/* Extracted preview items */}
        <div className="space-y-2 mb-5">
          {SAMPLE_RECEIPT_ITEMS.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-base">{item.emoji}</span>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight">{item.title}</p>
                  <p className="text-[10px] text-slate-400">{item.category}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-900">${item.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleApply}
          className="w-full py-3 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] active:scale-[0.99] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Add Recognized Expenses ($26.60)</span>
        </button>
      </div>
    </div>
  );
}
