"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Globe,
  Tag,
  Download,
  Upload,
  Crown,
  HelpCircle,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface SettingsTabProps {
  onLogout?: () => void;
}

export function SettingsTab({ onLogout }: SettingsTabProps) {
  const [currentLang, setCurrentLang] = useState("vi");

  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 animate-in fade-in duration-200">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Cài đặt</h2>
        <p className="text-xs text-slate-500">Quản lý tài khoản, ngôn ngữ và tuỳ chọn ứng dụng</p>
      </div>

      {/* User Profile Card */}
      <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center relative overflow-hidden">
            <Image
              src="/finbridge/images/user.png"
              alt="User Avatar"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900">Người dùng Rolly</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">user@rollyapp.ai</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1 p-2 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>

      {/* Premium Upgrade Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-teal-500 to-emerald-500 p-5 text-white shadow-md flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-300 fill-amber-300" />
            <span className="font-bold text-sm">Tận hưởng Rolly Premium</span>
          </div>
          <p className="text-xs text-teal-100 max-w-sm">
            Quét hoá đơn không giới hạn, Nhập giọng nói AI không gián đoạn và gợi ý tiết kiệm thông minh.
          </p>
        </div>
        <button
          type="button"
          onClick={() => alert("Gói Premium đang hoạt động!")}
          className="px-4 py-2 rounded-2xl bg-white text-teal-800 font-bold text-xs shadow-sm hover:bg-teal-50 transition-all shrink-0 cursor-pointer"
        >
          Nâng cấp ngay
        </button>
      </div>

      {/* Settings Options List */}
      <div className="rounded-3xl bg-white border border-slate-100 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {/* Ngôn ngữ */}
        <div className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Ngôn ngữ hiển thị</p>
              <p className="text-[11px] text-slate-400">Tiếng Việt (Mặc định)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentLang(currentLang === "vi" ? "en" : "vi")}
              className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200"
            >
              {currentLang === "vi" ? "VI 🇻🇳" : "EN 🇺🇸"}
            </button>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </div>
        </div>

        {/* Danh mục */}
        <div
          onClick={() => alert("Mở trình quản lý danh mục")}
          className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Cài đặt ví và danh mục</p>
              <p className="text-[11px] text-slate-400">Thêm, sửa và tuỳ biến icon chi tiêu</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Xuất dữ liệu */}
        <div
          onClick={() => alert("Đang xuất file CSV dữ liệu giao dịch...")}
          className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Xuất báo cáo CSV</p>
              <p className="text-[11px] text-slate-400">Tải xuống toàn bộ lịch sử chi tiêu</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Nhập khẩu dữ liệu */}
        <div
          onClick={() => alert("Chọn file CSV để nhập dữ liệu giao dịch")}
          className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Nhập khẩu giao dịch</p>
              <p className="text-[11px] text-slate-400">Đồng bộ từ Excel hoặc sao kê ngân hàng</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>

        {/* Bảo mật */}
        <div className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Bảo mật & Mã hoá cấp ngân hàng</p>
              <p className="text-[11px] text-slate-400">Dữ liệu tài chính luôn được bảo vệ an toàn</p>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            Đã bật
          </span>
        </div>

        {/* Trợ giúp */}
        <div
          onClick={() => alert("Trung tâm trợ giúp Rolly Support")}
          className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Hỗ trợ & Trợ giúp</p>
              <p className="text-[11px] text-slate-400">Câu hỏi thường gặp và liên hệ đội ngũ</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    </div>
  );
}
