"use client";

import React from "react";
import Image from "next/image";
import { X, Flame, CheckCircle2 } from "lucide-react";

interface MilestonesModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakCount?: number;
}

export function MilestonesModal({ isOpen, onClose, streakCount = 7 }: MilestonesModalProps) {
  if (!isOpen) return null;

  const milestones = [
    {
      title: "Chuỗi liên tục 7 ngày",
      desc: "Nhập giao dịch hàng ngày để duy trì chuỗi thói quen!",
      badgeImg: "/sites/rolly/images/highest-streak-cropped.png",
      unlocked: true,
      reward: "Đã mở khoá 🔥",
    },
    {
      title: "Tuần đầu tiên hoàn hảo",
      desc: "Chi tiêu trong phạm vi ngân sách đề ra cả tuần.",
      badgeImg: "/sites/rolly/images/budget-badge.png",
      unlocked: true,
      reward: "Đã nhận huy hiệu 🏅",
    },
    {
      title: "Mục tiêu Tiết kiệm",
      desc: "Tích luỹ thành công khoản tiết kiệm đầu tiên.",
      badgeImg: "/sites/rolly/images/savings-badge-cropped.png",
      unlocked: true,
      reward: "Đã đạt 💰✨",
    },
    {
      title: "Tháng hoàn hảo",
      desc: "Hoàn thành toàn bộ tháng mà không vượt ngân sách.",
      badgeImg: "/sites/rolly/images/debt-badge-right-cropped.png",
      unlocked: false,
      reward: "Tiến độ 22/30 ngày",
    },
    {
      title: "Chuỗi 365 ngày cùng Rolly",
      desc: "Chinh phục 1 năm quản lý tài chính thông minh.",
      badgeImg: "/sites/rolly/images/Rolly-365-streak-removebg-preview.png",
      unlocked: false,
      reward: "Đang chinh phục 🌟",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs">
            🏆
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">Những cột mốc & Huy hiệu</h3>
            <p className="text-xs text-slate-500">Kỷ niệm từng bước tiến bộ tài chính của bạn</p>
          </div>
        </div>

        {/* Streak Highlight Card */}
        <div className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white shadow-md mb-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-100">Chuỗi hiện tại</span>
            <p className="text-2xl font-black">{streakCount} ngày liên tiếp 🔥</p>
            <p className="text-xs text-orange-100 mt-0.5">Tiếp tục ghi chép hôm nay để không bị gián đoạn!</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Flame className="w-7 h-7 text-white fill-white" />
          </div>
        </div>

        {/* Milestones List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Huy hiệu đạt được</h4>
          {milestones.map((m, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border flex items-center gap-3.5 transition-all ${
                m.unlocked
                  ? "bg-slate-50/70 border-slate-200/80 shadow-2xs"
                  : "bg-slate-50/30 border-slate-100 opacity-60"
              }`}
            >
              <div className="w-12 h-12 relative shrink-0 flex items-center justify-center bg-white rounded-xl shadow-2xs p-1">
                <Image
                  src={m.badgeImg}
                  alt={m.title}
                  width={40}
                  height={40}
                  className="object-contain max-h-10"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-bold text-slate-900 truncate">{m.title}</p>
                  {m.unlocked && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-snug line-clamp-1">{m.desc}</p>
                <span className={`text-[10px] font-bold mt-0.5 inline-block ${m.unlocked ? "text-teal-700" : "text-slate-400"}`}>
                  {m.reward}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Close CTA */}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-2xl bg-[#00bebc] hover:bg-[#00abaa] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
