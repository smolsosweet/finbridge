"use client";

import { useAppUiText } from "./useAppUiText";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signOutGoogle } from "@/lib/sign-out";
import { deactivateAccount } from "@/lib/deactivate-account";
import { useAuthenticatedUser } from "@/components/auth/AuthenticatedUser";
import {
  Bell,
  Coins,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Pencil,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { SettingsOverview, settingsLanguage } from "./SettingsOverview";
import { Modal, Toggle } from "./Ui";
import { setSetting, money, updateState, useAppState } from "./store";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency-format";

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
    deactivate: "Đóng tài khoản",
    deactivateSub: "Dừng tài khoản và đăng xuất khỏi mọi thiết bị",
    deactivateTitle: "Đóng tài khoản?",
    deactivateNote: "Tài khoản sẽ dừng hoạt động ngay và mọi phiên đăng nhập sẽ kết thúc. Dữ liệu được giữ lại an toàn để kiểm toán; bạn vẫn có thể tạo tài khoản mới bằng email này.",
    deactivateSecurity: "Để bảo vệ tài khoản, hãy đăng nhập lại trong vòng 5 phút trước khi xác nhận.",
    deactivateReauth: "Phiên đăng nhập đã cũ. Hãy đăng xuất rồi đăng nhập lại để tiếp tục.",
    deactivateSignInAgain: "Đăng xuất để đăng nhập lại",
    deactivateConfirm: "Đóng tài khoản",
    deactivateBusy: "Đang đóng tài khoản…",
    deactivateError: "Chưa thể đóng tài khoản. Vui lòng thử lại.",
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
    deactivate: "Close account",
    deactivateSub: "Deactivate your account and sign out on every device",
    deactivateTitle: "Close your account?",
    deactivateNote: "Your account stops working immediately and every sign-in session ends. Data is securely retained for audit; you can still create a new account with this email.",
    deactivateSecurity: "To protect your account, sign in again within five minutes before confirming.",
    deactivateReauth: "Your sign-in is no longer recent. Sign out and sign in again to continue.",
    deactivateSignInAgain: "Sign out to sign in again",
    deactivateConfirm: "Close account",
    deactivateBusy: "Closing account…",
    deactivateError: "We couldn't close your account. Please try again.",
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
    deactivate: "关闭账户",
    deactivateSub: "停用账户并退出所有设备",
    deactivateTitle: "关闭账户？",
    deactivateNote: "账户将立即停止使用，所有登录会话都会结束。数据会被安全保留以供审计；你仍可用此邮箱创建新账户。",
    deactivateSecurity: "为保护账户，请在五分钟内重新登录后再确认。",
    deactivateReauth: "当前登录已不再有效。请退出后重新登录以继续。",
    deactivateSignInAgain: "退出后重新登录",
    deactivateConfirm: "关闭账户",
    deactivateBusy: "正在关闭账户…",
    deactivateError: "暂时无法关闭账户，请重试。",
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
  const uiText = useAppUiText();
  const state = useAppState();
  const authenticatedUser = useAuthenticatedUser();
  const lang = settingsLanguage(state.settings.language);
  const t = COPY_ACCOUNT[lang];
  const router = useRouter();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const [deactivationBusy, setDeactivationBusy] = useState(false);
  const [deactivationError, setDeactivationError] = useState<"deactivateError" | "deactivateReauth" | "">("");
  const deactivating = useRef(false);

  const [option, setOption] = useState(initialOption);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [switchAccountModalOpen, setSwitchAccountModalOpen] = useState(false);

  const rawName = String(state.settings.name || "").trim();
  const displayName = rawName && rawName !== "." ? rawName : "cincin";
  const email = authenticatedUser?.email || "";

  const [nameInput, setNameInput] = useState(displayName);

  const close = () => {
    if (deactivating.current) return;
    setOption("");
    setLogoutError(false);
    setDeactivationError("");
  };

  async function closeAccount(event: FormEvent) {
    event.preventDefault();
    if (deactivating.current || !authenticatedUser) return;
    deactivating.current = true; setDeactivationBusy(true); setDeactivationError("");
    try {
      await deactivateAccount(authenticatedUser.id);
      router.replace("/?lang=" + lang); router.refresh();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setDeactivationError(code === "RECENT_LOGIN_REQUIRED" || code === "UNAUTHORIZED" ? "deactivateReauth" : "deactivateError");
    } finally { deactivating.current = false; setDeactivationBusy(false); }
  }

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
      id: "deactivate",
      name: t.deactivate,
      sub: t.deactivateSub,
      icon: <Trash2 size={20} />,
      onClick: () => setOption("deactivate"),
      danger: true,
    },
  ];

  return (
    <main className="r-dashboard fb-home fb-settings fb-account-settings-page">
      <FinBridgeHeader
        lang={lang}
        navigate={navigate}
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.intro}
        theme={String(state.settings.theme || "light")}
        currentLanguage={lang === "vi" ? "Tiếng Việt" : lang === "zh" ? "中文" : "English"}
        onOpenCalendar={() => navigate("calendar")}
        onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")}
        onSelectLanguage={value => setSetting("language", value)}
      />

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
                placeholder={uiText("Nhập tên hiển thị...")}
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
                  ["symbolAfter", "Vị trí ký hiệu tiền tệ", "Hiển thị loại tiền tệ sau số tiền (ví dụ: 100,000 ₫)."],
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
              <p>{uiText("Xem trước hiển thị số tiền:")}</p>
              <h2 className="r-center" style={{ color: "var(--r-teal)", margin: "14px 0" }}>
                {money(1234567.89)}
              </h2>
              <div className="fb-modal-actions">
                <button type="button" className="r-primary" onClick={close}>
                  {uiText("Hoàn tất")}</button>
              </div>
            </>
          )}

          {option === "notification" && (
            <div className="r-form">
              <p className="fb-modal-subheading">
                {uiText("Cài đặt giờ nhận thông báo để FinBridge nhắc nhở bạn ghi chép các khoản chi tiêu phát sinh trong ngày.")}</p>
              <div className="r-toggle-row" style={{ marginBottom: 14 }}>
                <p>{uiText("Bật thông báo nhắc nhở hàng ngày")}</p>
                <Toggle
                  label={uiText("Nhắc nhở thông báo")}
                  checked={Boolean(state.settings.notification ?? true)}
                  onChange={(v) => setSetting("notification", v)}
                />
              </div>
              <label>
                {uiText("Thời gian nhắc nhở trong ngày")}<input
                  aria-label={uiText("Thời gian nhắc nhở")}
                  type="time"
                  defaultValue={String(state.settings.reminderTime || "20:00")}
                  onChange={(e) => setSetting("reminderTime", e.target.value)}
                />
              </label>
              <div className="fb-modal-actions">
                <button type="button" className="r-primary" onClick={close}>
                  {uiText("Lưu cài đặt")}</button>
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

          {option === "deactivate" && (
            <form className="fb-dialog-confirm r-form" onSubmit={closeAccount}>
              <h2 style={{ color: "#ef4444" }}>{t.deactivateTitle}</h2>
              <p className="r-dialog-note" style={{ color: "#b91c1c" }}>
                {t.deactivateNote}
              </p>
              {deactivationError === "deactivateReauth" ? <><p role="alert">{t.deactivateReauth}</p><button type="button" className="r-button" disabled={deactivationBusy || logoutBusy} onClick={() => void logout()}>{t.deactivateSignInAgain}</button></> : <p className="r-dialog-note">{t.deactivateSecurity}</p>}
              {deactivationError === "deactivateError" && <p role="alert">{t.deactivateError}</p>}
              <div className="fb-modal-actions">
                <button type="button" className="r-button" disabled={deactivationBusy} onClick={close}>
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="r-danger"
                  disabled={deactivationBusy || !authenticatedUser}
                  aria-busy={deactivationBusy}
                >
                  {deactivationBusy ? t.deactivateBusy : t.deactivateConfirm}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </main>
  );
}

export function HomepageConfiguration({ navigate }: { navigate: (screen: string) => void }) {
  const uiText = useAppUiText();
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);

  return (
    <main className="r-dashboard fb-home fb-settings fb-account-settings-page">
      <FinBridgeHeader lang={lang} navigate={navigate} />
      <div className="fb-settings-container">
        <div className="fb-settings-back-row">
          <button type="button" className="fb-settings-back" onClick={() => navigate("accountSettings")}>
            <ChevronLeft size={18} />
            <span>{uiText("Quay lại")}</span>
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

function isSentinelWalletName(name: string | null | undefined): boolean {
  if (name === null || name === undefined) return true;
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return !trimmed || trimmed === "." || trimmed === "Ví chính" || trimmed === "Main wallet" || trimmed === "主钱包";
}

const COPY_WALLET_SCREEN = {
  vi: {
    back: "Quay lại",
    backAria: "Quay lại",
    editTitle: "Chỉnh sửa ví",
    addTitle: "Thêm ví mới",
    defaultWalletName: "Ví mới",
    mainWallet: "Ví chính",
    walletNameLabel: "Tên ví",
    currencyLabel: "Tiền tệ",
    initialBalanceLabel: "Số dư ban đầu",
    saveWallet: "Lưu ví",
    currencyNames: {
      VND: "VND (Việt Nam Đồng)",
      CNY: "CNY (Nhân Dân Tệ)",
      USD: "USD (Đô la Mỹ)",
    },
  },
  en: {
    back: "Back",
    backAria: "Back",
    editTitle: "Edit Wallet",
    addTitle: "Add New Wallet",
    defaultWalletName: "New wallet",
    mainWallet: "Main wallet",
    walletNameLabel: "Wallet name",
    currencyLabel: "Currency",
    initialBalanceLabel: "Initial balance",
    saveWallet: "Save wallet",
    currencyNames: {
      VND: "VND (Vietnamese Dong)",
      CNY: "CNY (Chinese Yuan)",
      USD: "USD (US Dollar)",
    },
  },
  zh: {
    back: "返回",
    backAria: "返回",
    editTitle: "编辑钱包",
    addTitle: "添加新钱包",
    defaultWalletName: "新钱包",
    mainWallet: "主钱包",
    walletNameLabel: "钱包名称",
    currencyLabel: "货币",
    initialBalanceLabel: "初始余额",
    saveWallet: "保存钱包",
    currencyNames: {
      VND: "VND (越南盾)",
      CNY: "CNY (人民币)",
      USD: "USD (美元)",
    },
  },
};

export function WalletScreen({
  walletId,
  navigate,
}: {
  screen: string;
  walletId?: string;
  navigate: (screen: string) => void;
}) {
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);
  const t = COPY_WALLET_SCREEN[lang];
  const wallet = walletId ? (state.wallets.find((w) => w.id === walletId) || state.wallets[0]) : undefined;

  const isSentinel = Boolean(wallet && isSentinelWalletName(wallet.name));
  const [name, setName] = useState(isSentinel ? "" : (wallet?.name || ""));
  const [currency, setCurrency] = useState(wallet?.currency || "VND");
  const [initial, setInitial] = useState(wallet?.initial ? formatCurrencyInput(wallet.initial) : "0");

  function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const finalName = walletId
      ? (isSentinel
          ? (!trimmed || isSentinelWalletName(trimmed) ? "." : trimmed)
          : (trimmed || wallet?.name || "."))
      : (trimmed || t.defaultWalletName);

    const parsedInitial = parseCurrencyInput(initial);

    if (walletId) {
      updateState((s) => ({
        ...s,
        wallets: s.wallets.map((w) =>
          w.id === walletId ? { ...w, name: finalName, currency, initial: parsedInitial } : w
        ),
      }));
    } else {
      const id = "wallet_" + Date.now();
      updateState((s) => ({
        ...s,
        wallets: [...s.wallets, { id, name: finalName, currency, initial: parsedInitial, type: "cash" }],
      }));
    }
    navigate("?tab=home");
  }

  return (
    <main className="r-dashboard fb-home fb-settings">
      <FinBridgeHeader navigate={navigate} />
      <div className="fb-settings-container">
        <div className="fb-settings-back-row">
          <button
            type="button"
            className="fb-settings-back"
            onClick={() => navigate("?tab=home")}
            aria-label={t.backAria}
          >
            <ChevronLeft size={18} />
            <span>{t.back}</span>
          </button>
        </div>
        <form className="r-form" onSubmit={handleSave}>
          <h2>{walletId ? t.editTitle : t.addTitle}</h2>
          <label>
            {t.walletNameLabel}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isSentinel ? t.mainWallet : t.defaultWalletName}
              required={!isSentinel && !walletId}
            />
          </label>
          <label>
            {t.currencyLabel}
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {(["VND", "CNY", "USD"] as const).map((c) => (
                <option key={c} value={c}>
                  {t.currencyNames[c] || c}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.initialBalanceLabel}
            <input
              type="text"
              inputMode="decimal"
              value={initial}
              onChange={(e) => setInitial(e.target.value)}
              onBlur={() => setInitial(formatCurrencyInput(initial))}
            />
          </label>
          <button type="submit" className="r-primary">
            {t.saveWallet}
          </button>
        </form>
      </div>
    </main>
  );
}
