"use client";

import { useState, type FormEvent } from "react";
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Coins,
  Languages,
  LayoutGrid,
  LogOut,
  Moon,
  Palette,
  Pencil,
  PlusCircle,
  Sparkles,
  Sun,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { SettingsOverview, settingsLanguage } from "./SettingsOverview";
import { Field, Icon, Modal, Toggle } from "./Ui";
import { CurrencySelect } from "./Tools";
import { setSetting, money, updateState, useAppState, type Wallet } from "./store";

export const settingRows = [
  { name: "Cài đặt ví và danh mục", sub: "Thể loại, Tiền tệ, Số dư ban đầu", code: "f555", path: "walletSettings" },
  { name: "Cài đặt tài khoản", sub: "Ngôn ngữ, Cài đặt FinBridge, Xuất/Nhập CSV", code: "f013", path: "accountSettings" },
];

export function SettingsMenu({ navigate }: { navigate: (screen: string) => void }) {
  return <SettingsOverview navigate={navigate} />;
}

const COPY_ACCOUNT = {
  vi: {
    eyebrow: "THIẾT LẬP TÀI KHOẢN",
    title: "Cài đặt tài khoản",
    intro: "Tùy chỉnh trợ lý AI FinBridge, giao diện hiển thị và thiết lập tài khoản.",
    back: "Quay lại cài đặt",
    profile: "Hồ sơ cá nhân",
    editProfileHint: "Chỉnh sửa tên hiển thị",
    edit: "Sửa",
    assistantGroup: "Trợ lý FinBridge",
    displayGroup: "Giao diện & Hiển thị",
    accountGroup: "Tài khoản & Thiết bị",
    langLabel: "Ngôn ngữ hiển thị",
  },
  en: {
    eyebrow: "ACCOUNT SETTINGS",
    title: "Account settings",
    intro: "Customize FinBridge AI assistant, appearance and account preferences.",
    back: "Back to settings",
    profile: "Personal profile",
    editProfileHint: "Edit display name",
    edit: "Edit",
    assistantGroup: "FinBridge Assistant",
    displayGroup: "Interface & Display",
    accountGroup: "Account & Device",
    langLabel: "Display language",
  },
  zh: {
    eyebrow: "账户设置",
    title: "账户设置",
    intro: "自定义 FinBridge AI 智能助手、界面显示及账户偏好。",
    back: "返回设置",
    profile: "个人资料",
    editProfileHint: "编辑显示名称",
    edit: "编辑",
    assistantGroup: "FinBridge 智能助理",
    displayGroup: "界面与显示",
    accountGroup: "账户与设备",
    langLabel: "显示语言",
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
  const lang = settingsLanguage(state.settings.language);
  const t = COPY_ACCOUNT[lang];

  const [option, setOption] = useState(initialOption);
  const [selection, setSelection] = useState(String(state.settings.personality));
  const [value, setValue] = useState("");
  const [extra, setExtra] = useState("");

  const close = () => setOption("");

  function open(name: string) {
    if (name === "homepageConfiguration") {
      navigate(name);
      return;
    }
    setOption(name);
    setSelection(String(state.settings.personality));
    setValue(
      name === "goals"
        ? String(state.settings.goal)
        : name === "profile"
        ? String(state.settings.name)
        : String(state.settings[name] || "")
    );
    setExtra(String(state.settings.less));
  }

  const name = String(state.settings.name || "").trim();
  const displayName = name && name !== "." ? name : t.profile;

  const assistantGroup = [
    {
      id: "personality",
      name: "Tính cách của FinBridge",
      sub: "Tùy chỉnh phong cách trò chuyện và động viên",
      icon: <Sparkles size={18} />,
    },
    {
      id: "reply",
      name: "Ngôn ngữ phản hồi của FinBridge",
      sub: "Ngôn ngữ FinBridge ưu tiên dùng khi trò chuyện",
      icon: <Languages size={18} />,
    },
    {
      id: "goals",
      name: "Mục tiêu tài chính",
      sub: "Mục tiêu tích lũy và động lực quản lý tài chính",
      icon: <Target size={18} />,
    },
  ];

  const displayGroup = [
    {
      id: "theme",
      name: "Chủ đề màu sắc",
      sub: "Chế độ Sáng, Tối hoặc tự động theo hệ thống",
      icon: <Palette size={18} />,
    },
    {
      id: "homepageConfiguration",
      name: "Cấu hình trang chủ",
      sub: "Tùy biến hiển thị biểu đồ, tổng số dư và tiết kiệm",
      icon: <LayoutGrid size={18} />,
    },
    {
      id: "format",
      name: "Định dạng số tiền",
      sub: "Dấu phân cách hàng nghìn, vị trí ký hiệu tiền tệ",
      icon: <Coins size={18} />,
    },
    {
      id: "monthStart",
      name: "Đặt tháng bắt đầu",
      sub: "Ngày bắt đầu chu kỳ tính toán chi tiêu hàng tháng",
      icon: <Calendar size={18} />,
    },
    {
      id: "notification",
      name: "Nhắc nhở thông báo",
      sub: "Thời gian nhận thông báo nhắc nhở ghi chép chi tiêu",
      icon: <Bell size={18} />,
    },
    {
      id: "manual",
      name: "Chế độ thêm giao dịch thủ công",
      sub: "Bật nhập nhanh bằng biểu mẫu thay vì qua chat",
      icon: <PlusCircle size={18} />,
    },
  ];

  const accountGroup = [
    {
      id: "logout",
      name: "Đăng xuất",
      sub: "Thoát khỏi phiên làm việc hiện tại",
      icon: <LogOut size={18} />,
      danger: false,
    },
    {
      id: "delete",
      name: "Xóa tài khoản / Dữ liệu cục bộ",
      sub: "Đặt lại toàn bộ giao dịch và thiết lập trên thiết bị này",
      icon: <Trash2 size={18} />,
      danger: true,
    },
  ];

  return (
    <main className="r-dashboard fb-home fb-settings fb-account-settings-page">
      <FinBridgeHeader lang={lang}>
        <div className="fb-header-actions">
          <select
            aria-label="Ngôn ngữ hiển thị"
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
        </div>
      </FinBridgeHeader>

      <div className="fb-settings-back-row">
        <button type="button" className="fb-settings-back" onClick={() => navigate("?tab=settings")}>
          <ChevronLeft size={18} />
          <span>{t.back}</span>
        </button>
      </div>

      <div className="fb-home-intro fb-account-settings-intro">
        <div>
          <p className="fb-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
      </div>

      <button
        type="button"
        className="fb-settings-profile fb-account-profile-card"
        onClick={() => open("profile")}
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

      <div className="fb-account-grid">
        <div className="fb-account-col">
          <section className="fb-account-group" aria-label={t.assistantGroup}>
            <h2 className="fb-account-group-title">{t.assistantGroup}</h2>
            <div className="fb-account-group-card">
              {assistantGroup.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fb-account-opt-row"
                  onClick={() => open(item.id)}
                >
                  <span className="fb-account-opt-icon">{item.icon}</span>
                  <span className="fb-account-opt-text">
                    <b>{item.name}</b>
                    <small>{item.sub}</small>
                  </span>
                  <ChevronRight size={18} className="fb-account-opt-chevron" />
                </button>
              ))}
            </div>
          </section>

          <section className="fb-account-group" aria-label={t.accountGroup}>
            <h2 className="fb-account-group-title">{t.accountGroup}</h2>
            <div className="fb-account-group-card">
              {accountGroup.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`fb-account-opt-row ${item.danger ? "is-danger" : ""}`}
                  onClick={() => (item.id === "logout" ? setOption("logout") : setOption("delete"))}
                >
                  <span className="fb-account-opt-icon">{item.icon}</span>
                  <span className="fb-account-opt-text">
                    <b>{item.name}</b>
                    <small>{item.sub}</small>
                  </span>
                  <ChevronRight size={18} className="fb-account-opt-chevron" />
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="fb-account-col">
          <section className="fb-account-group" aria-label={t.displayGroup}>
            <h2 className="fb-account-group-title">{t.displayGroup}</h2>
            <div className="fb-account-group-card">
              {displayGroup.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fb-account-opt-row"
                  onClick={() => open(item.id)}
                >
                  <span className="fb-account-opt-icon">{item.icon}</span>
                  <span className="fb-account-opt-text">
                    <b>{item.name}</b>
                    <small>{item.sub}</small>
                  </span>
                  <ChevronRight size={18} className="fb-account-opt-chevron" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      {option && (
        <Modal
          title={
            option === "theme"
              ? "Chọn chủ đề"
              : option === "format"
              ? "Định dạng số tiền"
              : undefined
          }
          onClose={close}
          wide={option === "format"}
        >
          {option === "personality" && (
            <>
              <p>Bạn muốn FinBridge có tính cách như thế nào?</p>
              <div className="r-personalities">
                {[
                  "Cổ Động Viên Ủng Hộ",
                  "Mẹ giận dữ",
                  "Người Cố Vấn Thông Thái",
                  "7 Chuỗi để mở khóa",
                  "30 Chuỗi để mở khóa",
                  "Tùy chỉnh",
                ].map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className={selection === name ? "active" : ""}
                    onClick={() => (i === 3 || i === 4 ? setSelection(name) : setSelection(name))}
                  >
                    <Icon code={i < 3 ? "f007" : i === 5 ? "f544" : "f023"} />
                    <span>{name}</span>
                  </button>
                ))}
              </div>
              <p className="r-dialog-note">
                Chọn Cổ Động Viên Ủng Hộ nếu cần một người đồng hành tràn đầy năng lượng, sẵn sàng ăn mừng
                mọi bước trong hành trình tài chính.
              </p>
              <button
                type="button"
                className="r-primary"
                onClick={() => {
                  if (!selection.includes("Chuỗi")) {
                    setSetting("personality", selection);
                    close();
                  }
                }}
              >
                Xác nhận
              </button>
            </>
          )}

          {["reply", "goals", "monthStart", "profile"].includes(option) && (
            <form
              className="r-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSetting(option === "goals" ? "goal" : option === "profile" ? "name" : option, value);
                if (option === "goals") setSetting("less", extra);
                close();
              }}
            >
              <label>
                {option === "reply"
                  ? "Bạn muốn FinBridge trả lời bạn bằng ngôn ngữ nào?"
                  : option === "goals"
                  ? "Bạn muốn đạt được điều gì với ứng dụng theo dõi chi tiêu? Hãy để FinBridge truyền cảm hứng cho bạn!"
                  : option === "monthStart"
                  ? "Đặt ngày bắt đầu tháng."
                  : "Tên"}
                <input
                  aria-label={option === "profile" ? "Tên" : "Giá trị"}
                  value={value}
                  type={option === "monthStart" ? "number" : "text"}
                  min={1}
                  max={28}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
              {option === "goals" && (
                <label>
                  Có điều gì bạn muốn FinBridge nhắc bạn nên chi tiêu ít hơn không?
                  <input value={extra} onChange={(e) => setExtra(e.target.value)} />
                </label>
              )}
              <button className="r-primary">Xác nhận</button>
            </form>
          )}

          {option === "theme" && (
            <div className="r-menu-options">
              {[
                ["system", "Chế độ hệ thống"],
                ["light", "Chế độ sáng"],
                ["dark", "Chế độ tối"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={state.settings.theme === value ? "active" : ""}
                  onClick={() => {
                    setSetting("theme", value);
                    close();
                  }}
                >
                  {value === "dark" ? <Moon /> : <Sun />}
                  {label}
                </button>
              ))}
            </div>
          )}

          {option === "format" && (
            <>
              <div className="r-format-options">
                {[
                  ["separator", "Kiểu phân tách", 'Sử dụng dấu "." làm dấu phân cách hàng nghìn (ví dụ: 1.000).'],
                  ["symbolAfter", "Vị trí ký hiệu tiền tệ", "Hiển thị loại tiền tệ sau số tiền (ví dụ: 100$)."],
                  ["compact", "Định dạng nhỏ gọn", "Hiển thị số theo kiểu rút gọn (K, M, B)."],
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
              <p>Xem trước:</p>
              <h2 className="r-center">{money(1234567.89)}</h2>
            </>
          )}

          {option === "notification" && (
            <div className="r-form">
              <h2>Cho phép FinBridge gửi thông báo cho bạn</h2>
              <label>
                Thời gian nhắc nhở
                <input
                  aria-label="Thời gian nhắc nhở"
                  type="time"
                  defaultValue="20:00"
                  onChange={(e) => setSetting("reminderTime", e.target.value)}
                />
              </label>
              <button
                className="r-primary"
                onClick={() => {
                  setSetting("notification", true);
                  close();
                }}
              >
                Cho phép
              </button>
              <button
                className="r-secondary"
                onClick={() => {
                  setSetting("notification", false);
                  close();
                }}
              >
                Không cho phép
              </button>
            </div>
          )}

          {option === "manual" && (
            <>
              <h2>Chế độ thêm giao dịch thủ công</h2>
              <div className="r-toggle-row">
                <p>Chế độ giao dịch đơn giản</p>
                <Toggle
                  label="Chế độ thêm giao dịch thủ công"
                  checked={Boolean(state.settings.manual)}
                  onChange={(v) => setSetting("manual", v)}
                />
              </div>
              <p className="r-dialog-note">Khi bật, nút + sẽ mở biểu mẫu nhập giao dịch thủ công.</p>
            </>
          )}

          {option === "logout" && (
            <>
              <h2>Đăng xuất?</h2>
              <p className="r-dialog-note">Bạn sẽ quay lại màn hình chào mừng.</p>
              <button className="r-primary" onClick={() => navigate("welcome")}>
                Đăng xuất
              </button>
            </>
          )}

          {option === "delete" && (
            <>
              <h2>Xóa dữ liệu cục bộ</h2>
              <p className="r-dialog-note">
                Thao tác này sẽ xóa toàn bộ giao dịch, mục tiêu và thiết lập đã lưu trên trình duyệt này.
              </p>
              <button
                className="r-danger"
                onClick={() => {
                  updateState((s) => ({
                    ...s,
                    transactions: [],
                    goals: [],
                    recurring: [],
                    rules: [],
                  }));
                  close();
                }}
              >
                Xác nhận xóa dữ liệu
              </button>
            </>
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
      <div className="fb-settings-back-row">
        <button type="button" className="fb-settings-back" onClick={() => navigate("accountSettings")}>
          <ChevronLeft size={18} />
          <span>Quay lại Cài đặt tài khoản</span>
        </button>
      </div>
      <div className="fb-home-intro">
        <div>
          <p className="fb-eyebrow">CẤU HÌNH GIAO DIỆN</p>
          <h1>Cấu hình trang chủ</h1>
          <p>Bật hoặc tắt các khối thông tin hiển thị trên màn hình chính của FinBridge.</p>
        </div>
      </div>
      <div className="fb-account-group-card">
        {[
          ["chart", "Hiển thị biểu đồ đường", "Hiển thị biểu đồ đường theo dõi chi tiêu trên trang chủ"],
          ["totalBalance", "Hiển thị tổng số dư", "Hiển thị tổng số dư của tất cả các ví trên trang chủ"],
          ["savings", "Hiển thị tiết kiệm", "Hiển thị tổng tiền tiết kiệm tích lũy trên trang chủ"],
        ].map(([id, name, sub]) => (
          <div key={id} className="fb-account-opt-row fb-account-opt-toggle">
            <span className="fb-account-opt-text">
              <b>{name}</b>
              <small>{sub}</small>
            </span>
            <Toggle label={name} checked={Boolean(state.settings[id])} onChange={(v) => setSetting(id, v)} />
          </div>
        ))}
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
  const [name, setName] = useState(screen === "createWallet1" ? "" : wallet.name);
  const [amount, setAmount] = useState(screen === "createWallet1" ? "" : String(wallet.initial));
  const [currency, setCurrency] = useState(wallet.currency);
  const [type, setType] = useState(screen === "createWallet1" ? "cash" : wallet.type);
  const [shared, setShared] = useState(false);
  const [limit, setLimit] = useState("");
  const [modal, setModal] = useState("");
  const [categoryType, setCategoryType] = useState("Chi phí");
  const [categoryName, setCategoryName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  function save(event: FormEvent) {
    event.preventDefault();
    const next: Wallet = {
      id: screen === "createWallet1" ? crypto.randomUUID() : wallet.id,
      name,
      initial: Number(amount || 0),
      currency,
      type,
      limit: Number(limit) || undefined,
    };
    updateState((s) => ({
      ...s,
      wallets: screen === "createWallet1" ? [...s.wallets, next] : s.wallets.map((w) => (w.id === wallet.id ? next : w)),
    }));
    navigate(screen === "createWallet1" ? "" : "walletSettings?wallet=" + wallet.id);
  }

  if (screen === "category")
    return (
      <div className="r-category-page">
        <div className="fb-settings-back-row">
          <button type="button" className="fb-settings-back" onClick={() => navigate("walletSettings?wallet=" + wallet.id)}>
            <ChevronLeft size={18} />
            <span>Quay lại</span>
          </button>
        </div>
        <div className="r-category-tabs">
          {["Chi phí", "Thu nhập"].map((t) => (
            <button key={t} type="button" className={categoryType === t ? "active" : ""} onClick={() => setCategoryType(t)}>
              {t}
            </button>
          ))}
        </div>
        <div className="r-category-list">
          {(categoryType === "Chi phí" ? state.categories : ["Thu nhập", "Lương", "Quà tặng"]).map((c, i) => (
            <button key={c} type="button" onClick={() => { setSelectedCategory(c); setModal("categoryDetail"); }}>
              <span>{["❓", "🍔", "🏠", "🛍️"][i % 4]}</span>
              {c}
              <ChevronRight />
            </button>
          ))}
        </div>
        <button type="button" className="r-fab r-fab-wide r-fab-no-nav" onClick={() => { setCategoryName(""); setModal("addCategory"); }}>
          <PlusIcon />Thêm danh mục
        </button>
        {modal && (
          <Modal title={modal === "addCategory" ? "Tạo tên danh mục và biểu tượng của bạn" : selectedCategory} sheet onClose={() => setModal("")}>
            <form className="r-form" onSubmit={(e) => { e.preventDefault(); if (!categoryName.trim()) return; updateState((s) => ({ ...s, categories: [...s.categories, categoryName] })); setModal(""); }}>
              <input aria-label="Tiêu đề danh mục" placeholder="Tiêu đề" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
              {modal === "addCategory" ? (
                <button className="r-primary">Tạo danh mục</button>
              ) : (
                <>
                  <p>Danh mục phụ</p>
                  <button type="button" className="r-secondary" onClick={() => { setCategoryName(""); setModal("addCategory"); }}>
                    Thêm danh mục phụ
                  </button>
                  <button type="button" className="r-danger" onClick={() => { updateState((s) => ({ ...s, categories: s.categories.filter((c) => c !== selectedCategory) })); setModal(""); }}>
                    Xóa danh mục
                  </button>
                </>
              )}
            </form>
          </Modal>
        )}
      </div>
    );

  if (screen === "walletSettings")
    return (
      <div className="r-account-page">
        <div className="fb-settings-back-row">
          <button type="button" className="fb-settings-back" onClick={() => navigate("?tab=settings")}>
            <ChevronLeft size={18} />
            <span>Quay lại Cài đặt</span>
          </button>
        </div>
        <div className="r-account-options">
          <button className="r-setting-row r-setting-large" onClick={() => navigate("walletDetailsEdit?wallet=" + wallet.id)}>
            <span>Chi tiết ví<small>Tên, tiền tệ và số dư</small></span>
          </button>
          <button className="r-setting-row" onClick={() => navigate("category?wallet=" + wallet.id)}>
            <Icon code="f61f" />Quản lý danh mục
          </button>
          <button className="r-setting-row" onClick={() => setModal("share")}>
            <Icon code="f234" />Chia sẻ ví và mời thành viên
          </button>
          <div className="r-setting-row r-toggle-row">
            <span>Ví yêu cầu mở khóa sinh trắc học</span>
            <Toggle checked={false} label="Ví yêu cầu mở khóa sinh trắc học" onChange={() => setModal("biometric")} />
          </div>
          <button className="r-setting-row r-setting-large" onClick={() => setModal("email")}>
            <span>Thêm giao dịch qua email<small>Chuyển tiếp hóa đơn, FinBridge sẽ thêm vào ví này</small></span>
          </button>
        </div>
        {modal && (
          <Modal title={modal === "share" ? "Chia sẻ ví và mời thành viên" : modal === "email" ? "Thêm giao dịch qua email" : "Ví yêu cầu mở khóa sinh trắc học"} onClose={() => setModal("")}>
            <div className="r-form">{modal === "share" ? <><p>Thành viên · Bạn (Chủ sở hữu)</p><input aria-label="Địa chỉ email mời" placeholder="Địa chỉ email" /><p className="r-dialog-note">Mời thành viên cần máy chủ đồng bộ ví. Bạn có thể sao chép đường dẫn xem ví cục bộ.</p><button className="r-primary" onClick={() => { navigator.clipboard.writeText(window.location.origin + "/app/walletSettings?wallet=" + wallet.id); setModal(""); }}>Sao chép liên kết</button></> : <><p>{modal === "email" ? "Nhận hóa đơn qua email cần kết nối máy chủ FinBridge." : "Mở khóa sinh trắc học chưa được kết nối trong bản cục bộ."}</p><button className="r-primary" onClick={() => setModal("")}>Đóng</button></>}</div>
          </Modal>
        )}
      </div>
    );

  return (
    <div className="r-form-page">
      <div className="fb-settings-back-row">
        <button type="button" className="fb-settings-back" onClick={() => navigate(screen === "createWallet1" ? "" : "walletSettings?wallet=" + wallet.id)}>
          <ChevronLeft size={18} />
          <span>Quay lại</span>
        </button>
      </div>
      <form className="r-form" onSubmit={save}>
        {screen === "createWallet1" && (
          <>
            <small>Loại ví<br />Chọn đây là ví tiền mặt hay thẻ tín dụng</small>
            <div className="r-two-options">
              <button type="button" className={type === "cash" ? "active" : ""} onClick={() => setType("cash")}>
                Tiền mặt
              </button>
              <button type="button" className={type === "credit" ? "active" : ""} onClick={() => setType("credit")}>
                Thẻ tín dụng
              </button>
            </div>
          </>
        )}
        <Field label="Tên ví">
          <input aria-label="Tên ví" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <CurrencySelect value={currency} onChange={(v) => setCurrency(v.split(" ")[0])} />
        {type === "credit" && (
          <input aria-label="Hạn mức tín dụng" placeholder="Hạn mức tín dụng" type="number" required min="1" value={limit} onChange={(e) => setLimit(e.target.value)} />
        )}
        <Field label={type === "credit" ? "Nhập số dư chưa thanh toán" : "Số dư ban đầu"}>
          <input aria-label="Số dư ban đầu" type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {type === "credit" && (
          <Field label="Ngày đến hạn">
            <input type="date" />
          </Field>
        )}
        {screen === "createWallet1" && (
          <div className="r-setting-row r-toggle-row">
            <span>Mời người khác cùng quản lý ví</span>
            <Toggle label="Mời người khác cùng quản lý ví" checked={shared} onChange={setShared} />
          </div>
        )}
        <button className="r-primary">{screen === "createWallet1" ? "Tiếp tục" : "Lưu"}</button>
      </form>
    </div>
  );
}

function PlusIcon() {
  return <span aria-hidden="true">＋</span>;
}
