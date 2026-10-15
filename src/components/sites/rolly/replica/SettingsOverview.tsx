"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  ListTodo,
  Mail,
  MessageSquare,
  Moon,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Wallet,
} from "lucide-react";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { FeatureRequestsModal } from "./Extras";
import { Modal } from "./Ui";
import { setSetting, useAppState, type AppState } from "./store";

const COPY = {
  vi: {
    eyebrow: "TÀI KHOẢN & CÀI ĐẶT",
    title: "Cài đặt",
    intro: "Quản lý tài khoản, liên hệ hỗ trợ và tùy chọn ứng dụng FinBridge.",
    account: "Cài đặt tài khoản",
    accountSub: "Tên người dùng, email, ngôn ngữ, định dạng tiền tệ & bảo mật",
    features: "Yêu cầu tính năng",
    featuresSub: "Đề xuất tính năng mới và tham gia đóng góp ý tưởng phát triển",
    contact: "Liên hệ với chúng tôi",
    contactSub: "Gửi phản hồi hoặc nhận hỗ trợ từ đội ngũ FinBridge",
    terms: "Điều khoản dịch vụ",
    termsSub: "Quy định và điều khoản sử dụng ứng dụng FinBridge",
    privacy: "Chính sách bảo mật",
    privacySub: "Cam kết bảo mật dữ liệu tài chính và quyền riêng tư cá nhân",
    theme: "Chọn chủ đề",
    calendar: "Lịch thu chi",
    contactTitle: "Liên hệ với FinBridge",
    contactDesc: "Chúng tôi luôn sẵn sàng lắng nghe mọi ý kiến đóng góp, thắc mắc và yêu cầu hỗ trợ từ bạn.",
    contactEmail: "Email hỗ trợ chính thức",
    contactHours: "Giờ làm việc",
    contactHoursVal: "08:00 – 21:00 (Thứ 2 – Thứ 7)",
    contactSubject: "Tiêu đề yêu cầu",
    contactSubjectPlaceholder: "Ví dụ: Góp ý tính năng, báo lỗi...",
    contactMessage: "Nội dung tin nhắn",
    contactMessagePlaceholder: "Nhập nội dung bạn muốn gửi tới đội ngũ FinBridge...",
    contactSend: "Gửi tin nhắn",
    contactSuccess: "Cảm ơn bạn! Tin nhắn đã được gửi tới đội ngũ FinBridge. Chúng tôi sẽ phản hồi sớm nhất có thể.",
    termsTitle: "Điều khoản dịch vụ FinBridge",
    privacyTitle: "Chính sách bảo mật FinBridge",
    close: "Đóng",
    wallets: "Cài đặt ví và danh mục",
    walletHint: "Tên ví, loại ví, tiền tệ, số dư và danh mục thu chi.",
    manageWallet: "Quản lý ví & danh mục",
    manage: "Quản lý ví",
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
    termsSections: [
      {
        heading: "1. Giới thiệu & Phạm vi dịch vụ",
        body: "FinBridge là ứng dụng trợ lý tài chính cá nhân thông minh, giúp người dùng theo dõi các khoản thu chi, lập ngân sách dự toán, quản lý các khoản chi cố định và thống kê dòng tiền một cách chủ động và minh bạch.",
      },
      {
        heading: "2. Trách nhiệm của người dùng",
        body: "Người dùng chịu trách nhiệm bảo mật thiết bị đăng nhập và tính chính xác của các số liệu giao dịch được nhập vào hệ thống. FinBridge khuyến khích bạn kiểm tra định kỳ các số dư thực tế so với sổ sách trong ứng dụng.",
      },
      {
        heading: "3. Quyền sở hữu trí tuệ",
        body: "Mọi thiết kế giao diện, thuật toán thống kê, tài sản thương hiệu và biểu tượng thuộc bản quyền của FinBridge. Nghiêm cấm sao chép, đảo ngược mã nguồn hoặc phân phối lại khi chưa có sự đồng ý bằng văn bản.",
      },
      {
        heading: "4. Giới hạn trách nhiệm",
        body: "FinBridge cung cấp công cụ hỗ trợ theo dõi và quản lý dữ liệu cá nhân, không cấu thành lời khuyên tư vấn tài chính, đầu tư hoặc bảo hiểm có chứng chỉ pháp lý.",
      },
    ],
    privacySections: [
      {
        heading: "1. Cam kết quyền riêng tư tuyệt đối",
        body: "FinBridge coi quyền riêng tư và an toàn dữ liệu của bạn là ưu tiên cao nhất. Dữ liệu tài chính, ví và các khoản chi tiêu thuộc về bạn và chỉ phục vụ cho việc quản lý tài chính của chính bạn.",
      },
      {
        heading: "2. Lưu trữ và bảo mật",
        body: "Dữ liệu giao dịch hiện được lưu trên thiết bị này theo từng tài khoản. Khi FinBridge triển khai đồng bộ máy chủ, dữ liệu được truyền qua HTTPS; mật khẩu không bao giờ được lưu ở dạng văn bản thuần.",
      },
      {
        heading: "3. Không thương mại hóa dữ liệu cá nhân",
        body: "FinBridge cam kết không bao giờ bán, cho thuê, chia sẻ hay tiết lộ thông tin tài chính hoặc hành vi chi tiêu của bạn cho bất kỳ bên thứ ba, công ty quảng cáo hay đối tác môi giới nào.",
      },
      {
        heading: "4. Quyền kiểm soát dữ liệu",
        body: "Bạn có thể xuất, chỉnh sửa hoặc đóng tài khoản trong Cài đặt tài khoản. Đóng tài khoản sẽ vô hiệu hóa quyền truy cập và giữ dữ liệu cần thiết cho kiểm toán; không xóa vĩnh viễn dữ liệu tài chính.",
      },
    ],
  },
  en: {
    eyebrow: "ACCOUNT & SETTINGS",
    title: "Settings",
    intro: "Manage your account, get support, and configure FinBridge application preferences.",
    account: "Account settings",
    accountSub: "Display name, email, language, currency format & security",
    features: "Feature requests",
    featuresSub: "Suggest new features and vote on development ideas",
    contact: "Contact us",
    contactSub: "Send feedback or get support from the FinBridge team",
    terms: "Terms of service",
    termsSub: "Terms and conditions for using the FinBridge application",
    privacy: "Privacy policy",
    privacySub: "Our commitment to financial data security and user privacy",
    theme: "Choose theme",
    calendar: "Calendar",
    contactTitle: "Contact FinBridge",
    contactDesc: "We are always here to listen to your feedback, questions and support requests.",
    contactEmail: "Official Support Email",
    contactHours: "Operating Hours",
    contactHoursVal: "08:00 – 21:00 (Mon – Sat)",
    contactSubject: "Subject",
    contactSubjectPlaceholder: "e.g., Feature idea, bug report...",
    contactMessage: "Message",
    contactMessagePlaceholder: "Write your message for the FinBridge team...",
    contactSend: "Send message",
    contactSuccess: "Thank you! Your message has been sent to the FinBridge team. We will respond shortly.",
    termsTitle: "FinBridge Terms of Service",
    privacyTitle: "FinBridge Privacy Policy",
    close: "Close",
    wallets: "Wallets & categories",
    walletHint: "Wallet names, types, currencies, balances and spending categories.",
    manageWallet: "Manage wallet & categories",
    manage: "Manage wallet",
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
    termsSections: [
      {
        heading: "1. Introduction & Scope of Services",
        body: "FinBridge is an intelligent personal finance assistant designed to help users track income and expenses, plan budgets, manage recurring commitments, and analyze cash flow transparently and proactively.",
      },
      {
        heading: "2. User Responsibilities",
        body: "Users are responsible for safeguarding login access on their devices and ensuring the accuracy of transaction data entered into the system. FinBridge encourages periodic reconciliation between real accounts and application ledgers.",
      },
      {
        heading: "3. Intellectual Property Rights",
        body: "All user interface designs, statistical models, brand assets, and icons are the proprietary intellectual property of FinBridge. Reproduction, reverse engineering, or redistribution without prior written consent is strictly prohibited.",
      },
      {
        heading: "4. Limitation of Liability",
        body: "FinBridge provides personal bookkeeping and financial organization tools. Application insights do not constitute certified financial, investment, legal, or tax advisory services.",
      },
    ],
    privacySections: [
      {
        heading: "1. Absolute Commitment to Privacy",
        body: "FinBridge treats your privacy and data security as our utmost priority. All financial records, wallets, and transaction entries belong solely to you and serve only your personal financial management.",
      },
      {
        heading: "2. Storage & security",
        body: "Financial workspace data is currently stored per account on this device. When server synchronization is enabled, data is transmitted over HTTPS; passwords are never stored in plain text.",
      },
      {
        heading: "3. Zero Commercialization of Personal Data",
        body: "FinBridge pledges never to sell, rent, monetize, share, or disclose your financial information or spending habits to any third-party advertisers, data brokers, or marketing partners.",
      },
      {
        heading: "4. Data control",
        body: "You can export, modify, or close your account in Account Settings. Closing it immediately disables access and retains the data required for audit; it does not permanently erase financial records.",
      },
    ],
  },
  zh: {
    eyebrow: "账户与设置",
    title: "设置",
    intro: "管理个人账户、联系客服支持以及配置 FinBridge 应用程序偏好。",
    account: "账户设置",
    accountSub: "用户名、邮箱、语言、货币格式及安全",
    features: "功能建议",
    featuresSub: "提出新功能建议并为开发想法投票",
    contact: "联系我们",
    contactSub: "发送反馈或获取 FinBridge 团队支持",
    terms: "服务条款",
    termsSub: "FinBridge 应用程序的使用条款与规范",
    privacy: "隐私政策",
    privacySub: "财务数据安全及个人隐私保护承诺",
    theme: "选择主题",
    calendar: "日历",
    contactTitle: "联系 FinBridge",
    contactDesc: "我们始终乐于倾听您的意见、疑问和支持请求。",
    contactEmail: "官方支持邮箱",
    contactHours: "工作时间",
    contactHoursVal: "08:00 – 21:00（周一至周六）",
    contactSubject: "主题",
    contactSubjectPlaceholder: "例如：功能建议、问题反馈...",
    contactMessage: "内容",
    contactMessagePlaceholder: "请输入您想发送给 FinBridge 团队的内容...",
    contactSend: "发送消息",
    contactSuccess: "感谢您的反馈！消息已发送至 FinBridge 团队，我们将尽快答复。",
    termsTitle: "FinBridge 服务条款",
    privacyTitle: "FinBridge 隐私政策",
    close: "关闭",
    wallets: "钱包与类别设置",
    walletHint: "钱包名称、类型、币种、余额及收支类别。",
    manageWallet: "管理钱包与类别",
    manage: "管理钱包",
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
    termsSections: [
      {
        heading: "1. 简介与服务范围",
        body: "FinBridge 是一款智能个人财务管理助手，帮助用户追踪收支、制定预算、管理固定开销并清晰透明地掌握现金流动态。",
      },
      {
        heading: "2. 用户责任",
        body: "用户应对登录设备的安全以及录入系统的交易数据的准确性负责。FinBridge 建议您定期核对实际账户与应用记录的账目。",
      },
      {
        heading: "3. 知识产权",
        body: "所有界面设计、统计分析模型、品牌资产与图标均为 FinBridge 的专有知识产权。未经书面许可，严禁复制、反向工程或重新分发。",
      },
      {
        heading: "4. 责任限制",
        body: "FinBridge 提供个人记账与财务规划辅助工具。应用内的洞察与分析不构成具法律效力的认证财务、投资、法律或税务咨询建议。",
      },
    ],
    privacySections: [
      {
        heading: "1. 绝对隐私承诺",
        body: "FinBridge 将您的隐私与数据安全视为重中之重。所有财务数据、钱包和交易记录均归您所有，仅用于您的个人财务管理。",
      },
      {
        heading: "2. 存储与安全",
        body: "财务工作区数据目前按账户保存在本设备上。启用服务器同步后，数据将通过 HTTPS 传输；密码绝不会以明文保存。",
      },
      {
        heading: "3. 绝不将个人数据商业化",
        body: "FinBridge 承诺绝不出售、出租、共享或向任何第三方广告商、数据中介或商业伙伴披露您的财务信息或消费行为。",
      },
      {
        heading: "4. 数据控制权",
        body: "您可以在“账户设置”中导出、修改或关闭账户。关闭账户会立即停用访问权限，并保留审计所需的数据；不会永久删除财务记录。",
      },
    ],
  },
};

export function settingsLanguage(value: unknown): "vi" | "en" | "zh" {
  const text = String(value || "").toLowerCase();
  return /zh|chinese|trung|中文/.test(text) ? "zh" : /english|en|anh/.test(text) ? "en" : "vi";
}

export function SettingsOverview({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);
  const [featuresModalOpen, setFeaturesModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);

  const lang = settingsLanguage(state.settings.language);
  const t = COPY[lang];

  function handleSendContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactMessage.trim()) return;
    setContactSent(true);
    setTimeout(() => {
      setContactSent(false);
      setContactSubject("");
      setContactMessage("");
      setContactModalOpen(false);
    }, 1600);
  }

  const menuItems = [
    {
      id: "account",
      title: t.account,
      subtitle: t.accountSub,
      icon: <Settings size={22} />,
      onClick: () => navigate("accountSettings"),
    },
    {
      id: "features",
      title: t.features,
      subtitle: t.featuresSub,
      icon: <ListTodo size={22} />,
      onClick: () => setFeaturesModalOpen(true),
    },
    {
      id: "contact",
      title: t.contact,
      subtitle: t.contactSub,
      icon: <HelpCircle size={22} />,
      onClick: () => {
        setContactSent(false);
        setContactModalOpen(true);
      },
    },
    {
      id: "terms",
      title: t.terms,
      subtitle: t.termsSub,
      icon: <FileText size={22} />,
      onClick: () => setTermsModalOpen(true),
    },
    {
      id: "privacy",
      title: t.privacy,
      subtitle: t.privacySub,
      icon: <ShieldCheck size={22} />,
      onClick: () => setPrivacyModalOpen(true),
    },
  ];

  return (
    <main className="r-dashboard fb-home fb-settings">
      <FinBridgeHeader
        lang={lang}
        theme={String(state.settings.theme || "light")}
        currentLanguage={String(state.settings.language || "Tiếng Việt")}
        onOpenCalendar={() => setCalendarLedgerOpen(true)}
        onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")}
        onSelectLanguage={(val) => setSetting("language", val)}
      />

      {/* Synchronized header & intro matching Home, Transactions, and Planning */}
      <div className="fb-home-intro fb-settings-header">
        <div>
          <p className="fb-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p>{t.intro}</p>
        </div>
      </div>

      {/* Grid of feature cards aligned with the layout of previous tabs */}
      <div className="fb-settings-cards">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`fb-settings-card ${item.id === "account" ? "is-primary" : ""}`}
            onClick={item.onClick}
            aria-label={item.title}
          >
            <span className="fb-settings-card-icon">{item.icon}</span>
            <span className="fb-settings-card-text">
              <b>{item.title}</b>
              <small>{item.subtitle}</small>
            </span>
            <ChevronRight size={20} className="fb-settings-card-arrow" />
          </button>
        ))}
      </div>

      {/* Modal: Liên hệ với chúng tôi */}
      {contactModalOpen && (
        <Modal title={t.contactTitle} wide onClose={() => setContactModalOpen(false)}>
          <div className="fb-contact-modal-body">
            <p className="fb-contact-lead">{t.contactDesc}</p>
            <div className="fb-contact-info-cards">
              <div className="fb-contact-info-item">
                <Mail size={18} />
                <div>
                  <small>{t.contactEmail}</small>
                  <b>support@finbridge.app</b>
                </div>
              </div>
              <div className="fb-contact-info-item">
                <MessageSquare size={18} />
                <div>
                  <small>{t.contactHours}</small>
                  <b>{t.contactHoursVal}</b>
                </div>
              </div>
            </div>

            {contactSent ? (
              <div className="fb-contact-success-msg">
                <ShieldCheck size={26} />
                <p>{t.contactSuccess}</p>
              </div>
            ) : (
              <form className="r-form fb-contact-form" onSubmit={handleSendContact}>
                <label>
                  {t.contactSubject}
                  <input
                    placeholder={t.contactSubjectPlaceholder}
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                  />
                </label>
                <label>
                  {t.contactMessage}
                  <textarea
                    rows={4}
                    placeholder={t.contactMessagePlaceholder}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                  />
                </label>
                <div className="fb-modal-actions">
                  <button type="button" className="r-button" onClick={() => setContactModalOpen(false)}>
                    {t.close}
                  </button>
                  <button type="submit" className="r-primary fb-contact-submit-btn">
                    <Send size={15} />
                    <span>{t.contactSend}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* Modal: Điều khoản dịch vụ FinBridge */}
      {termsModalOpen && (
        <Modal title={t.termsTitle} wide onClose={() => setTermsModalOpen(false)}>
          <div className="fb-legal-modal-body">
            {t.termsSections.map((sec, idx) => (
              <section key={idx} className="fb-legal-section">
                <h4>{sec.heading}</h4>
                <p>{sec.body}</p>
              </section>
            ))}
            <div className="fb-modal-actions">
              <button type="button" className="r-primary" onClick={() => setTermsModalOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Chính sách bảo mật FinBridge */}
      {privacyModalOpen && (
        <Modal title={t.privacyTitle} wide onClose={() => setPrivacyModalOpen(false)}>
          <div className="fb-legal-modal-body">
            {t.privacySections.map((sec, idx) => (
              <section key={idx} className="fb-legal-section">
                <h4>{sec.heading}</h4>
                <p>{sec.body}</p>
              </section>
            ))}
            <div className="fb-modal-actions">
              <button type="button" className="r-primary" onClick={() => setPrivacyModalOpen(false)}>
                {t.close}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Yêu cầu tính năng */}
      {featuresModalOpen && <FeatureRequestsModal onClose={() => setFeaturesModalOpen(false)} />}

      {/* Modal: Lịch thu chi */}
      {calendarLedgerOpen && <CalendarLedgerModal navigate={navigate} onClose={() => setCalendarLedgerOpen(false)} />}
    </main>
  );
}

/**
 * Reusable wallet directory component preserved for modular use
 */
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
  const lang = settingsLanguage(state.settings.language);
  const t = COPY[lang];

  return (
    <div className="fb-wallet-directory">
      <div className="fb-wallet-directory-list">
        {state.wallets.map((w) => {
          const txs = state.transactions.filter((tx) => tx.wallet === w.id || tx.targetWallet === w.id);
          const balance =
            w.initial +
            txs.reduce((sum, tx) => {
              if (tx.type === "income") return sum + tx.amount;
              if (tx.type === "expense") return sum - tx.amount;
              if (tx.type === "transfer") {
                if (tx.wallet === w.id) return sum - tx.amount;
                if (tx.targetWallet === w.id) return sum + tx.amount;
              }
              return sum;
            }, 0);
          return (
            <div key={w.id} className="fb-wallet-dir-card">
              <div className="fb-wallet-dir-header">
                <div className="fb-wallet-dir-info">
                  <b>{w.name}</b>
                  <div className="fb-wallet-dir-badges">
                    <span className="fb-badge fb-badge-currency">{w.currency}</span>
                    <span className={`fb-badge fb-badge-status ${w.archived ? "is-archived" : "is-active"}`}>
                      {w.archived ? t.archived : t.active}
                    </span>
                  </div>
                </div>
                <div className="fb-wallet-dir-balance-wrap">
                  <small>{t.currentBalance}</small>
                  <span className="fb-wallet-directory-balance">
                    {new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US").format(balance)} {w.currency}
                  </span>
                </div>
              </div>
              <div className="fb-wallet-dir-actions">
                <button
                  type="button"
                  className="fb-wallet-action-manage"
                  onClick={() => onManage(w.id)}
                  aria-label={`${t.manage} ${w.name}`}
                >
                  <Wallet size={16} />
                  <span>{t.manage}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
