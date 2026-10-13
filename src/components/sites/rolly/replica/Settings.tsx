"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOutGoogle } from "@/lib/sign-out";
import { useAuthenticatedUser } from "@/components/auth/AuthenticatedUser";
import {
  Bell,
  Coins,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Moon,
  Pencil,
  Sun,
  Trash2,
  UserCheck,
  UserRound,
  Users,
} from "lucide-react";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { SettingsOverview, settingsLanguage } from "./SettingsOverview";
import { Field, Icon, Modal, Toggle } from "./Ui";
import { CurrencySelect } from "./Tools";
import { setSetting, money, updateState, useAppState, type Wallet } from "./store";

export const settingRows = [
  { name: "Cài đặt tài khoản", sub: "Tên người dùng, email, ngôn ngữ, định dạng tiền tệ & bảo mật", code: "f013", path: "accountSettings" },
];

export function SettingsMenu({ navigate }: { navigate: (screen: string) => void }) {
  return <SettingsOverview navigate={navigate} />;
}

const COPY_ACCOUNT = {
  vi: {
    emailManaged: "Email được lấy từ tài khoản đăng nhập và không thể đổi tại đây.",
    currentAccount: "Tài khoản đang đăng nhập",
    switchAccountNote: "Bạn sẽ đăng xuất, sau đó đăng nhập bằng tài khoản khác. Dữ liệu của mỗi tài khoản được giữ riêng trên trình duyệt này.",
    eyebrow: "THIẾT LẬP TÀI KHOẢN",
    title: "Cài đặt tài khoản",
    intro: "Tùy chỉnh thông tin cá nhân, định dạng tiền tệ và bảo mật tài khoản FinBridge.",
    back: "Quay lại cài đặt",
    profile: "Hồ sơ cá nhân",
    editProfile: "Chỉnh sửa hồ sơ cá nhân",
    nameLabel: "Tên hiển thị",
    emailLabel: "Email tài khoản",
    format: "Định dạng số tiền",
    formatSub: "Dấu phân cách hàng nghìn, vị trí ký hiệu tiền tệ",
    notification: "Nhắc nhở thông báo",
    notificationSub: "Thời gian nhận thông báo nhắc nhở ghi chép chi tiêu",
    switchAccount: "Đổi tài khoản",
    switchAccountSub: "Chuyển đổi sang tài khoản khác hoặc đăng nhập mới",
    delete: "Xóa tài khoản",
    deleteSub: "Xóa vĩnh viễn dữ liệu tài khoản và thiết lập trên thiết bị này",
    save: "Lưu thay đổi",
    cancel: "Hủy",
    langLabel: "Ngôn ngữ hiển thị",
    logout: "Đăng xuất",
    logoutHint: "Thoát khỏi phiên làm việc hiện tại",
    logoutSub: "Thoát khỏi phiên làm việc hiện tại",
    logoutTitle: "Đăng xuất?",
    logoutNote: "Bạn sẽ quay lại màn hình chào mừng.",
    logoutBusy: "Đang đăng xuất…",
    logoutError: "Không thể đăng xuất. Vui lòng thử lại.",
  },
  en: {
    emailManaged: "Email comes from your sign-in account and cannot be changed here.",
    currentAccount: "Signed-in account",
    switchAccountNote: "You will sign out, then sign in with another account. Each account's data stays separate in this browser.",
    eyebrow: "ACCOUNT SETTINGS",
    title: "Account settings",
    intro: "Customize user profile, currency format and FinBridge account security.",
    back: "Back to settings",
    profile: "User profile",
    editProfile: "Edit user profile",
    nameLabel: "Display name",
    emailLabel: "Account email",
    format: "Currency formatting",
    formatSub: "Thousand separator, currency symbol placement",
    notification: "Notification reminders",
    notificationSub: "Daily reminder time for recording expenses",
    switchAccount: "Switch account",
    switchAccountSub: "Switch to another account or sign in",
    delete: "Delete account",
    deleteSub: "Permanently erase account data and settings on this device",
    save: "Save changes",
    cancel: "Cancel",
    langLabel: "Display language",
    logout: "Sign out",
    logoutHint: "End your current session",
    logoutSub: "End current session on this device",
    logoutTitle: "Sign out?",
    logoutNote: "You will return to the welcome screen.",
    logoutBusy: "Signing out…",
    logoutError: "Could not sign out. Please try again.",
  },
  zh: {
    emailManaged: "邮箱来自您的登录账户，无法在此更改。",
    currentAccount: "当前登录账户",
    switchAccountNote: "您将退出登录，然后使用其他账户登录。每个账户的数据在此浏览器中分别保存。",
    eyebrow: "账户设置",
    title: "账户设置",
    intro: "自定义个人资料、货币格式及 FinBridge 账户安全。",
    back: "返回设置",
    profile: "个人资料",
    editProfile: "编辑个人资料",
    nameLabel: "显示名称",
    emailLabel: "账户邮箱",
    format: "货币数字格式",
    formatSub: "千位分隔符、货币符号位置",
    notification: "通知提醒",
    notificationSub: "每日记账提醒时间",
    switchAccount: "切换账户",
    switchAccountSub: "切换至其他账户或登录新账户",
    delete: "注销账户",
    deleteSub: "永久清除此设备上的账户数据和偏好设置",
    save: "保存更改",
    cancel: "取消",
    langLabel: "显示语言",
    logout: "退出登录",
    logoutHint: "结束当前会话",
    logoutSub: "退出此设备上的当前会话",
    logoutTitle: "退出登录？",
    logoutNote: "您将返回欢迎页面。",
    logoutBusy: "正在退出登录…",
    logoutError: "无法退出登录。请重试。",
  },
};

export function AccountSettings({
  navigate,
  initialOption = "",
}: {
  navigate: (screen: string) => void;
  initialOption?: string;
}) {
  const state = useAppState();
  const authenticatedUser = useAuthenticatedUser();
  const lang = settingsLanguage(state.settings.language);
  const t = COPY_ACCOUNT[lang];
  const router = useRouter();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  const [option, setOption] = useState(initialOption);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [switchAccountModalOpen, setSwitchAccountModalOpen] = useState(false);

  const rawName = String(state.settings.name || "").trim();
  const displayName = rawName && rawName !== "." ? rawName : "cincin";
  const email = authenticatedUser?.email || "";

  const [nameInput, setNameInput] = useState(displayName);

  const close = () => {
    setOption("");
    setLogoutError(false);
  };

  function openEditProfile() {
    setNameInput(displayName);
    setProfileModalOpen(true);
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    setLogoutError(false);
    try {
      await signOutGoogle();
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError(true);
      setLogoutBusy(false);
    }
  }

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (nameInput.trim()) setSetting("name", nameInput.trim());
    setProfileModalOpen(false);
  }

  async function handleSwitchAccount(e: FormEvent) {
    e.preventDefault();
    await logout();
  }

  const accountRows = [
    {
      id: "format",
      name: t.format,
      sub: t.formatSub,
      icon: <Coins size={20} />,
      onClick: () => setOption("format"),
      danger: false,
    },
    {
      id: "notification",
      name: t.notification,
      sub: t.notificationSub,
      icon: <Bell size={20} />,
      onClick: () => setOption("notification"),
      danger: false,
    },
    {
      id: "switchAccount",
      name: t.switchAccount,
      sub: t.switchAccountSub,
      icon: <Users size={20} />,
      onClick: () => setSwitchAccountModalOpen(true),
      danger: false,
    },
    {
      id: "logout",
      name: t.logout,
      sub: t.logoutHint || t.logoutSub,
      icon: <LogOut size={20} />,
      onClick: () => setOption("logout"),
      danger: false,
    },
    {
      id: "delete",
      name: t.delete,
      sub: t.deleteSub,
      icon: <Trash2 size={20} />,
      onClick: () => setOption("delete"),
      danger: true,
    },
  ];

  return (
    <main className="r-dashboard fb-home fb-settings fb-account-settings-page">
      <FinBridgeHeader
        lang={lang}
        theme={String(state.settings.theme || "light")}
        currentLanguage={String(state.settings.language || "Tiếng Việt")}
        onOpenCalendar={() => navigate("calendar")}
        onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")}
      >
        <select
          aria-label={t.langLabel}
          className="fb-header-lang-select"
          value={String(state.settings.language)}
          onChange={(e) => setSetting("language", e.target.value)}
        >
          {["Tiếng Việt", "English", "中文", "Bahasa Indonesia", "Español", "Français"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </FinBridgeHeader>


      <div className="fb-home-intro fb-account-settings-intro">
        <div>
          <p className="fb-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
      </div>

      {/* Profile Card matching Image 2 */}
      <div className="fb-account-profile-card">
          <div className="fb-account-avatar">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="fb-account-profile-details">
            <b>{displayName}</b>
            <span>{email}</span>
          </div>
          <button
            type="button"
            className="fb-account-profile-edit-btn"
            onClick={openEditProfile}
            aria-label={t.editProfile}
            title={t.editProfile}
          >
            <Pencil size={18} />
          </button>
        </div>

        {/* Settings options list matching Image 2 */}
        <div className="fb-account-options-list">
          {accountRows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`fb-account-opt-row ${row.danger ? "is-danger" : ""}`}
              onClick={row.onClick}
            >
              <span className="fb-account-opt-icon">{row.icon}</span>
              <span className="fb-account-opt-text">
                <b>{row.name}</b>
                <small>{row.sub}</small>
              </span>
              <ChevronRight size={18} className="fb-account-opt-chevron" />
            </button>
          ))}
        </div>

      {/* Modal: Chỉnh sửa hồ sơ cá nhân */}
      {profileModalOpen && (
        <Modal title={t.editProfile} wide onClose={() => setProfileModalOpen(false)}>
          <form className="r-form" onSubmit={handleSaveProfile}>
            <label>
              {t.nameLabel}
              <input
                aria-label={t.nameLabel}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Nhập tên hiển thị..."
                required
                autoFocus
              />
            </label>
            <label>
              {t.emailLabel}
              <input
                aria-label={t.emailLabel}
                type="email"
                value={email}
                readOnly
              />
              <small>{t.emailManaged}</small>
            </label>
            <div className="fb-modal-actions">
              <button type="button" className="r-button" onClick={() => setProfileModalOpen(false)}>
                {t.cancel}
              </button>
              <button type="submit" className="r-primary">
                {t.save}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Đổi tài khoản / Đăng nhập khác */}
      {switchAccountModalOpen && (
        <Modal title={t.switchAccount} wide onClose={() => setSwitchAccountModalOpen(false)}>
          <div className="fb-switch-account-modal">
            <div className="fb-current-account-badge">
              <UserCheck size={18} />
              <div>
                <small>{t.currentAccount}</small>
                <b>{displayName} ({email})</b>
              </div>
            </div>

            <form className="r-form" onSubmit={handleSwitchAccount}>
              <p className="r-dialog-note">
                {t.switchAccountNote}
              </p>
              {logoutError && <p role="alert">{t.logoutError}</p>}
              <div className="fb-modal-actions">
                <button type="button" className="r-button" onClick={() => setSwitchAccountModalOpen(false)}>
                  {t.cancel}
                </button>
                <button type="submit" className="r-primary" disabled={logoutBusy}>
                  {logoutBusy ? t.logoutBusy : t.switchAccount}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Modal: Tùy chọn cài đặt */}
      {option && (
        <Modal
          title={option === "format" ? t.format : option === "notification" ? t.notification : undefined}
          onClose={close}
          wide
        >
          {option === "format" && (
            <>
              <div className="r-format-options">
                {[
                  ["separator", "Kiểu phân tách hàng nghìn", 'Sử dụng dấu "." làm dấu phân cách hàng nghìn (ví dụ: 1.000.000).'],
                  ["symbolAfter", "Vị trí ký hiệu tiền tệ", "Hiển thị loại tiền tệ sau số tiền (ví dụ: 100.000 ₫)."],
                  ["compact", "Định dạng rút gọn", "Hiển thị số tiền theo kiểu rút gọn (K, M, B)."],
                ].map(([key, title, desc]) => (
                  <div key={key}>
                    <span>
                      {title}
                      <small>{desc}</small>
                    </span>
                    <Toggle
                      label={title}
                      checked={Boolean(state.settings[key])}
                      onChange={(v) => setSetting(key, v)}
                    />
                  </div>
                ))}
              </div>
              <p>Xem trước hiển thị số tiền:</p>
              <h2 className="r-center" style={{ color: "var(--r-teal)", margin: "14px 0" }}>
                {money(1234567.89)}
              </h2>
              <div className="fb-modal-actions">
                <button type="button" className="r-primary" onClick={close}>
                  Hoàn tất
                </button>
              </div>
            </>
          )}

          {option === "notification" && (
            <div className="r-form">
              <p className="fb-modal-subheading">
                Cài đặt giờ nhận thông báo để FinBridge nhắc nhở bạn ghi chép các khoản chi tiêu phát sinh trong ngày.
              </p>
              <div className="r-toggle-row" style={{ marginBottom: 14 }}>
                <p>Bật thông báo nhắc nhở hàng ngày</p>
                <Toggle
                  label="Nhắc nhở thông báo"
                  checked={Boolean(state.settings.notification ?? true)}
                  onChange={(v) => setSetting("notification", v)}
                />
              </div>
              <label>
                Thời gian nhắc nhở trong ngày
                <input
                  aria-label="Thời gian nhắc nhở"
                  type="time"
                  defaultValue={String(state.settings.reminderTime || "20:00")}
                  onChange={(e) => setSetting("reminderTime", e.target.value)}
                />
              </label>
              <div className="fb-modal-actions">
                <button type="button" className="r-primary" onClick={close}>
                  Lưu cài đặt
                </button>
              </div>
            </div>
          )}

          {option === "logout" && (
            <div className="fb-dialog-confirm">
              <h2>{t.logoutTitle || "Đăng xuất tài khoản?"}</h2>
              <p className="r-dialog-note">
                {t.logoutNote || `Bạn có chắc chắn muốn đăng xuất khỏi tài khoản ${email} trên thiết bị này?`}
              </p>
              {logoutError && <p role="alert" style={{ color: "#ef4444" }}>{t.logoutError}</p>}
              <div className="fb-modal-actions">
                <button type="button" className="r-button" disabled={logoutBusy} onClick={close}>
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="r-primary"
                  disabled={logoutBusy}
                  onClick={() => void logout()}
                >
                  {logoutBusy ? t.logoutBusy : t.logout}
                </button>
              </div>
            </div>
          )}

          {option === "delete" && (
            <div className="fb-dialog-confirm">
              <h2 style={{ color: "#ef4444" }}>Xóa vĩnh viễn tài khoản?</h2>
              <p className="r-dialog-note" style={{ color: "#b91c1c" }}>
                CẢNH BÁO: Thao tác này sẽ xóa toàn bộ số dư, ví, giao dịch, mục tiêu và dữ liệu đã lưu của bạn trên thiết bị này.
                Hành động này không thể hoàn tác!
              </p>
              <div className="fb-modal-actions">
                <button type="button" className="r-button" onClick={close}>
                  {t.cancel}
                </button>
                <button
                  type="button"
                  className="r-danger"
                  onClick={() => {
                    updateState((s) => ({
                      ...s,
                      wallets: [{ id: "default", name: "Ví chính", currency: "VND", initial: 0, type: "cash" }],
                      transactions: [],
                      goals: [],
                      recurring: [],
                      rules: [],
                      settings: {
                        ...s.settings,
                        name: "cincin",
                        email: "",
                      },
                    }));
                    close();
                  }}
                >
                  Xác nhận xóa tài khoản
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </main>
  );
}

export function HomepageConfiguration({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);

  return (
    <main className="r-dashboard fb-home fb-settings fb-account-settings-page">
      <FinBridgeHeader lang={lang} />
      <div className="fb-settings-container">
        <div className="fb-settings-back-row">
          <button type="button" className="fb-settings-back" onClick={() => navigate("accountSettings")}>
            <ChevronLeft size={18} />
            <span>Quay lại</span>
          </button>
        </div>
        <div className="r-config-list">
          {[
            ["chart", "Biểu đồ dòng tiền", "Hiển thị biểu đồ phân tích thu nhập và chi tiêu."],
            ["totalBalance", "Tổng số dư", "Hiển thị tổng số dư các ví trên đầu trang chủ."],
            ["savings", "Tiết kiệm & Mục tiêu", "Hiển thị tiến độ các mục tiêu tài chính."],
          ].map(([key, title, desc]) => (
            <div key={key} className="r-config-row">
              <div>
                <b>{title}</b>
                <small>{desc}</small>
              </div>
              <Toggle
                label={title}
                checked={Boolean(state.settings[key])}
                onChange={(v) => setSetting(key, v)}
              />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function WalletScreen({
  screen,
  walletId,
  navigate,
}: {
  screen: string;
  walletId?: string;
  navigate: (screen: string) => void;
}) {
  const state = useAppState();
  const wallet = state.wallets.find((w) => w.id === walletId) || state.wallets[0];
  const [name, setName] = useState(wallet?.name || "");
  const [currency, setCurrency] = useState(wallet?.currency || "VND");
  const [initial, setInitial] = useState(String(wallet?.initial || 0));

  function handleSave(e: FormEvent) {
    e.preventDefault();
    if (walletId) {
      updateState((s) => ({
        ...s,
        wallets: s.wallets.map((w) =>
          w.id === walletId ? { ...w, name, currency, initial: Number(initial) || 0 } : w
        ),
      }));
    } else {
      const id = "wallet_" + Date.now();
      updateState((s) => ({
        ...s,
        wallets: [...s.wallets, { id, name: name || "Ví mới", currency, initial: Number(initial) || 0, type: "cash" }],
      }));
    }
    navigate("?tab=home");
  }

  return (
    <main className="r-dashboard fb-home fb-settings">
      <FinBridgeHeader />
      <div className="fb-settings-container">
        <div className="fb-settings-back-row">
          <button type="button" className="fb-settings-back" onClick={() => navigate("?tab=home")}>
            <ChevronLeft size={18} />
            <span>Quay lại</span>
          </button>
        </div>
        <form className="r-form" onSubmit={handleSave}>
          <h2>{walletId ? "Chỉnh sửa ví" : "Thêm ví mới"}</h2>
          <label>
            Tên ví
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Tiền tệ
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["VND", "USD", "EUR", "CNY", "JPY"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số dư ban đầu
            <input type="number" value={initial} onChange={(e) => setInitial(e.target.value)} />
          </label>
          <button type="submit" className="r-primary">
            Lưu ví
          </button>
        </form>
      </div>
    </main>
  );
}
