"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { Modal } from "./Ui";
import { setSetting, useAppState, type AppState } from "./store";

const COPY = {
  vi: {
    eyebrow: "TÀI KHOẢN & CÀI ĐẶT",
    title: "Tài khoản & cài đặt",
    intro: "Quản lý hồ sơ cá nhân, các ví và tùy chọn sử dụng FinBridge.",
    profile: "Hồ sơ cá nhân",
    editProfileHint: "Chỉnh sửa tên hiển thị",
    editProfileTitle: "Chỉnh sửa hồ sơ cá nhân",
    nameLabel: "Tên hiển thị",
    namePlaceholder: "Nhập tên hiển thị của bạn...",
    save: "Lưu thay đổi",
    edit: "Sửa",
    wallets: "Cài đặt ví và danh mục",
    walletHint: "Tên ví, loại ví, tiền tệ, số dư và danh mục thu chi.",
    account: "Cài đặt tài khoản",
    accountHint: "Ngôn ngữ, giao diện, tùy chọn FinBridge và tài khoản.",
    theme: "Chọn chủ đề",
    manage: "Quản lý ví",
    manageWallet: "Quản lý ví & danh mục",
    back: "Quay lại cài đặt",
    active: "Đang hoạt động",
    archived: "Đã lưu trữ",
    main: "Ví chính",
    empty: "Chưa có ví",
    source: "Dùng chung dữ liệu và thao tác quản lý ví với trang chủ.",
    cash: "Tiền mặt",
    creditCard: "Thẻ tín dụng",
    currentBalance: "Số dư hiện tại",
    addWallet: "Thêm ví mới",
    calendar: "Lịch thu chi",
  },
  en: {
    eyebrow: "ACCOUNT & SETTINGS",
    title: "Account & settings",
    intro: "Manage your personal profile, wallets and FinBridge preferences.",
    profile: "Personal profile",
    editProfileHint: "Edit display name",
    editProfileTitle: "Edit personal profile",
    nameLabel: "Display name",
    namePlaceholder: "Enter your display name...",
    save: "Save changes",
    edit: "Edit",
    wallets: "Wallets & categories",
    walletHint: "Wallet names, types, currencies, balances and spending categories.",
    account: "Account settings",
    accountHint: "Language, appearance, FinBridge preferences and account.",
    theme: "Choose theme",
    manage: "Manage wallet",
    manageWallet: "Manage wallet & categories",
    back: "Back to settings",
    active: "Active",
    archived: "Archived",
    main: "Main wallet",
    empty: "No wallets",
    source: "Uses the same wallet data and management controls as Home.",
    cash: "Cash",
    creditCard: "Credit Card",
    currentBalance: "Current balance",
    addWallet: "Add wallet",
    calendar: "Calendar",
  },
  zh: {
    eyebrow: "账户与设置",
    title: "账户与设置",
    intro: "管理个人资料、钱包及 FinBridge 使用偏好。",
    profile: "个人资料",
    editProfileHint: "编辑显示名称",
    editProfileTitle: "编辑个人资料",
    nameLabel: "显示名称",
    namePlaceholder: "输入您的显示名称...",
    save: "保存更改",
    edit: "编辑",
    wallets: "钱包与类别设置",
    walletHint: "钱包名称、类型、币种、余额及收支类别。",
    account: "账户设置",
    accountHint: "语言、界面、FinBridge 偏好及账户。",
    theme: "选择主题",
    manage: "管理钱包",
    manageWallet: "管理钱包与类别",
    back: "返回设置",
    active: "启用中",
    archived: "已归档",
    main: "主钱包",
    empty: "尚无钱包",
    source: "与首页共用钱包数据和管理功能。",
    cash: "现金",
    creditCard: "信用卡",
    currentBalance: "当前余额",
    addWallet: "添加钱包",
    calendar: "日历",
  },
};

export function settingsLanguage(value: unknown): "vi" | "en" | "zh" {
  const text = String(value || "").toLowerCase();
  return /zh|chinese|trung|中文/.test(text) ? "zh" : /english|en|anh/.test(text) ? "en" : "vi";
}

export function SettingsOverview({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");

  const lang = settingsLanguage(state.settings.language);
  const t = COPY[lang];
  const name = String(state.settings.name || "").trim();
  const displayName = name && name !== "." ? name : t.profile;

  function openEditProfile() {
    setProfileNameInput(name === "." ? "" : name);
    setProfileModalOpen(true);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSetting("name", profileNameInput.trim());
    setProfileModalOpen(false);
  }

  return (
    <main className="r-dashboard fb-home fb-settings">
      <FinBridgeHeader lang={lang}>
        <div className="fb-header-actions">
          <button
            type="button"
            className="fb-header-calendar-btn"
            onClick={() => setCalendarLedgerOpen(true)}
            aria-label={t.calendar}
            title={t.calendar}
          >
            <CalendarDays size={18} />
            <span className="fb-header-btn-text">{t.calendar}</span>
          </button>
          <button
            type="button"
            className="fb-settings-theme"
            aria-label={t.theme}
            title={t.theme}
            onClick={() => navigate("accountSettings?option=theme")}
          >
            {state.settings.theme === "dark" ? <Moon size={19} /> : <Sun size={19} />}
          </button>
        </div>
      </FinBridgeHeader>

      <div className="fb-home-intro fb-settings-header">
        <div>
          <p className="fb-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
      </div>

      <button
        type="button"
        className="fb-settings-profile fb-settings-profile-btn"
        onClick={openEditProfile}
        aria-label={t.profile}
      >
        <span className="fb-settings-avatar">
          {name && name !== "." ? displayName.charAt(0).toLocaleUpperCase() : <UserRound size={24} />}
        </span>
        <div className="fb-settings-profile-info">
          <b>{displayName}</b>
          <span>{t.editProfileHint}</span>
        </div>
        <span className="fb-profile-edit-badge">
          <Pencil size={15} />
          <span>{t.edit}</span>
        </span>
      </button>

      <div className="fb-settings-cards">
        <button type="button" className="fb-settings-card" onClick={() => navigate("walletSettings")}>
          <span className="fb-settings-card-icon"><Wallet size={22} /></span>
          <span><b>{t.wallets}</b><small>{t.walletHint}</small></span>
          <ChevronRight size={20} />
        </button>
        <button type="button" className="fb-settings-card" onClick={() => navigate("accountSettings")}>
          <span className="fb-settings-card-icon"><Settings size={22} /></span>
          <span><b>{t.account}</b><small>{t.accountHint}</small></span>
          <ChevronRight size={20} />
        </button>
      </div>

      {profileModalOpen && (
        <Modal title={t.editProfileTitle} onClose={() => setProfileModalOpen(false)}>
          <form className="r-form" onSubmit={handleSaveProfile}>
            <label>
              {t.nameLabel}
              <input
                aria-label={t.nameLabel}
                placeholder={t.namePlaceholder}
                value={profileNameInput}
                onChange={(e) => setProfileNameInput(e.target.value)}
                autoFocus
              />
            </label>
            <button type="submit" className="r-primary">
              {t.save}
            </button>
          </form>
        </Modal>
      )}

      {calendarLedgerOpen && (
        <CalendarLedgerModal onClose={() => setCalendarLedgerOpen(false)} navigate={navigate} />
      )}
    </main>
  );
}

export function WalletSettingsDirectory({
  state,
  navigate,
  onManage,
  onAddWallet,
}: {
  state: AppState;
  navigate: (screen: string) => void;
  onManage: (walletId: string) => void;
  onAddWallet?: () => void;
}) {
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const lang = settingsLanguage(state.settings.language);
  const t = COPY[lang];

  return (
    <main className="r-dashboard fb-home fb-settings fb-wallet-directory">
      <FinBridgeHeader lang={lang}>
        <div className="fb-header-actions">
          <button
            type="button"
            className="fb-header-calendar-btn"
            onClick={() => setCalendarLedgerOpen(true)}
            aria-label={t.calendar}
            title={t.calendar}
          >
            <CalendarDays size={18} />
            <span className="fb-header-btn-text">{t.calendar}</span>
          </button>
        </div>
      </FinBridgeHeader>

      <div className="fb-wallet-dir-topbar">
        <button type="button" className="fb-settings-back" onClick={() => navigate("?tab=settings")}>
          <ChevronLeft size={18} />
          <span>{t.back}</span>
        </button>
        <button
          type="button"
          className="fb-wallet-add-btn"
          onClick={() => (onAddWallet ? onAddWallet() : navigate("createWallet1"))}
        >
          <Plus size={16} />
          <span>{t.addWallet}</span>
        </button>
      </div>

      <div className="fb-home-intro fb-wallet-directory-header">
        <div>
          <p className="fb-eyebrow">{lang === "vi" ? "VÍ VÀ DANH MỤC" : lang === "zh" ? "钱包与类别" : "WALLETS & CATEGORIES"}</p>
          <h1>{t.wallets}</h1>
          <p>{t.walletHint}</p>
        </div>
      </div>

      <div className="fb-wallet-directory-list">
        {state.wallets.map((wallet) => {
          const balance = wallet.initial + state.transactions.reduce((sum, record) => sum + (record.wallet === wallet.id ? record.type === "income" ? record.amount : -record.amount : record.targetWallet === wallet.id ? record.amount : 0), 0);
          const walletName = wallet.name === "." ? t.main : wallet.name;
          const formattedBalance = new Intl.NumberFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { maximumFractionDigits: 2 }).format(balance);
          const isCredit = wallet.type === "credit";

          return (
            <div key={wallet.id} className="fb-wallet-dir-card">
              <div className="fb-wallet-dir-header">
                <div className="fb-wallet-dir-info">
                  <span className="fb-settings-card-icon">
                    {isCredit ? <CreditCard size={22} /> : <Wallet size={22} />}
                  </span>
                  <div>
                    <b>{walletName}</b>
                    <div className="fb-wallet-dir-badges">
                      <span className="fb-badge fb-badge-type">{isCredit ? t.creditCard : t.cash}</span>
                      <span className="fb-badge fb-badge-currency">{wallet.currency}</span>
                      <span className={`fb-badge fb-badge-status ${wallet.archived ? "is-archived" : "is-active"}`}>
                        {wallet.archived ? t.archived : t.active}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="fb-wallet-dir-balance-wrap">
                  <small>{t.currentBalance}</small>
                  <span className="fb-wallet-directory-balance">
                    {formattedBalance} {wallet.currency}
                  </span>
                </div>
              </div>

              <div className="fb-wallet-dir-actions">
                <button
                  type="button"
                  className="fb-wallet-action-manage"
                  aria-label={t.manage + " " + walletName}
                  onClick={() => onManage(wallet.id)}
                >
                  <Settings size={15} />
                  <span>{t.manageWallet}</span>
                </button>
              </div>
            </div>
          );
        })}
        {!state.wallets.length && <p className="fb-settings-empty">{t.empty}</p>}
      </div>

      <p className="fb-settings-note">{t.source}</p>

      {calendarLedgerOpen && (
        <CalendarLedgerModal onClose={() => setCalendarLedgerOpen(false)} navigate={navigate} />
      )}
    </main>
  );
}
