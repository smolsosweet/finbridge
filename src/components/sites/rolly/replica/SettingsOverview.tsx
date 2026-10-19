"use client";
import { privacyCopy } from "@/lib/privacy-copy";

import { useState } from "react";
import { useFeedbackSubmission } from "@/components/auth/useFeedbackSubmission";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  ListTodo,
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
    contactSubject: "Tiêu đề yêu cầu",
    contactSubjectPlaceholder: "Ví dụ: Góp ý tính năng, báo lỗi...",
    contactMessage: "Nội dung tin nhắn",
    contactMessagePlaceholder: "Nhập nội dung bạn muốn gửi tới đội ngũ FinBridge...",
    contactSend: "Gửi tin nhắn",
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
        body: "Thành phần mã nguồn mở và tài sản của bên thứ ba tuân theo giấy phép riêng. Ghi nhận nguồn được giữ trong LICENSE và THIRD_PARTY_NOTICES.md. Tên và đường dẫn di sản Rolly không xác lập quyền sở hữu giao diện hoặc tài sản gốc.",
      },
      {
        heading: "4. Giới hạn trách nhiệm",
        body: "FinBridge cung cấp công cụ hỗ trợ theo dõi và quản lý dữ liệu cá nhân, không cấu thành lời khuyên tư vấn tài chính, đầu tư hoặc bảo hiểm có chứng chỉ pháp lý.",
      },
    ],
    privacySections: privacyCopy.vi,
  },
  en: {
    eyebrow: "ACCOUNT & SETTINGS",
    title: "Settings",
    intro: "Manage your account, get support, and configure FinBridge application preferences.",
    account: "Account settings",
    accountSub: "Display name, email, language, currency format & security",
    features: "Feature requests",
    featuresSub: "Explore ideas and submit a feature suggestion",
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
    contactSubject: "Subject",
    contactSubjectPlaceholder: "e.g., Feature idea, bug report...",
    contactMessage: "Message",
    contactMessagePlaceholder: "Write your message for the FinBridge team...",
    contactSend: "Send message",
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
        body: "Open-source components and third-party assets retain their own licenses. Attribution is recorded in LICENSE and THIRD_PARTY_NOTICES.md. Legacy Rolly names and paths do not establish ownership of the original interface or assets.",
      },
      {
        heading: "4. Limitation of Liability",
        body: "FinBridge provides personal bookkeeping and financial organization tools. Application insights do not constitute certified financial, investment, legal, or tax advisory services.",
      },
    ],
    privacySections: privacyCopy.en,
  },
  zh: {
    eyebrow: "账户与设置",
    title: "设置",
    intro: "管理个人账户、联系客服支持以及配置 FinBridge 应用程序偏好。",
    account: "账户设置",
    accountSub: "用户名、邮箱、语言、货币格式及安全",
    features: "功能建议",
    featuresSub: "浏览想法并提交功能建议",
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
    contactSubject: "主题",
    contactSubjectPlaceholder: "例如：功能建议、问题反馈...",
    contactMessage: "内容",
    contactMessagePlaceholder: "请输入您想发送给 FinBridge 团队的内容...",
    contactSend: "发送消息",
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
        body: "开源组件和第三方素材遵循各自许可证。来源说明保留在 LICENSE 和 THIRD_PARTY_NOTICES.md 中。遗留的 Rolly 名称和路径不代表拥有原始界面或素材的权利。",
      },
      {
        heading: "4. 责任限制",
        body: "FinBridge 提供个人记账与财务规划辅助工具。应用内的洞察与分析不构成具法律效力的认证财务、投资、法律或税务咨询建议。",
      },
    ],
    privacySections: privacyCopy.zh,
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


  const lang = settingsLanguage(state.settings.language);
  const t = COPY[lang];
  const feedback = useFeedbackSubmission("contact", lang);

  async function handleSendContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactMessage.trim()) return;
    if (await feedback.submit(contactSubject, contactMessage)) {
      setContactSubject(""); setContactMessage("");
    }
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
        feedback.reset();
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
        navigate={navigate}
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.intro}
        theme={String(state.settings.theme || "light")}
        currentLanguage={String(state.settings.language || "Tiếng Việt")}
        onOpenCalendar={() => setCalendarLedgerOpen(true)}
        onToggleTheme={() => setSetting("theme", state.settings.theme === "dark" ? "light" : "dark")}
        onSelectLanguage={(val) => setSetting("language", val)}
      />

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
        <Modal title={t.contactTitle} wide closeLabel={t.close} onClose={() => setContactModalOpen(false)}>
          <div className="fb-contact-modal-body">
            <p className="fb-contact-lead">{t.contactDesc}</p>
            <p className="r-dialog-note">{feedback.copy.note}</p>

            {feedback.receipt ? (
              <div className="fb-contact-success-msg">
                <ShieldCheck size={26} />
                <p>{feedback.copy.saved} <code>{feedback.receipt.id}</code></p>
              </div>
            ) : (
              <form className="r-form fb-contact-form" onSubmit={handleSendContact}>
                <label>
                  {t.contactSubject}
                  <input
                    placeholder={t.contactSubjectPlaceholder}
                    maxLength={120}
                    disabled={feedback.busy}
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                  />
                </label>
                <label>
                  {t.contactMessage}
                  <textarea
                    rows={4}
                    maxLength={2000}
                    disabled={feedback.busy}
                    placeholder={t.contactMessagePlaceholder}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    required
                  />
                </label>
                {feedback.error && <p role="alert">{feedback.error}</p>}
                <div className="fb-modal-actions">
                  <button type="button" className="r-button" onClick={() => setContactModalOpen(false)}>
                    {t.close}
                  </button>
                  <button type="submit" className="r-primary fb-contact-submit-btn" disabled={feedback.busy}>
                    <Send size={15} />
                    <span>{feedback.busy ? feedback.copy.busy : t.contactSend}</span>
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
                    {new Intl.NumberFormat("en-US").format(balance)} {w.currency}
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
