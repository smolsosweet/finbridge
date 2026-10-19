"use client";

import Image from "next/image";
import { useState } from "react";
import { useFeedbackSubmission } from "@/components/auth/useFeedbackSubmission";
import { Check, ChevronLeft, ChevronRight, Flame, Plus, RotateCcw, Send, ThumbsUp } from "lucide-react";
import { MonthCalendar } from "./Dashboard";
import { Icon, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { setSetting, useAppState } from "./store";
import { settingsLanguage } from "./SettingsOverview";

export function CalendarPage({ navigate, milestones = false }: { navigate: (screen: string) => void; milestones?: boolean }) {
  const state = useAppState();
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState("");
  const [award, setAward] = useState("");
  const change = (delta: number) => { const date = new Date(year, month + delta, 1); setMonth(date.getMonth()); setYear(date.getFullYear()); };
  const streak = new Set(state.transactions.map((t) => t.date)).size;
  const lang = settingsLanguage(state.settings.language);
  const calMonthTitle = lang === "en" ? `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month]} ${year}` : lang === "zh" ? `${year}年${month + 1}月` : `Tháng ${month + 1} ${year}`;
  return <div className={milestones ? "r-milestones-page" : "r-calendar-page"}><PageHeader title={milestones ? (lang === "vi" ? "Những cột mốc" : lang === "zh" ? "里程碑" : "Milestones") : (lang === "vi" ? "Lịch" : lang === "zh" ? "日历" : "Calendar")} subtitle={milestones ? (lang === "vi" ? "Theo dõi những cột mốc tài chính của bạn" : lang === "zh" ? "追踪您的财务里程碑" : "Track your financial milestones") : undefined} close onBack={() => navigate(milestones ? "" : "?tab=transactions")} />
    {milestones ? <><div className="r-streak-summary"><div><b>{streak}</b><span>{lang === "vi" ? "ngày chuỗi" : lang === "zh" ? "天连击" : "day streak"}</span></div><Flame size={100} fill="#817d70" color="#817d70" /></div><div className="r-setting-row"><Icon code="f0eb" /><span>{lang === "vi" ? "Nhập giao dịch hôm nay để bắt đầu chuỗi!" : lang === "zh" ? "今日记账以开始连击！" : "Log a transaction today to start your streak!"}</span></div></> : <button className="r-calendar-premium" onClick={() => navigate("paywall7dTrial")}><Icon code="f521" className="r-gold" />{lang === "vi" ? "Nâng Cấp Lên FinBridge Premium Để Mở Khóa Tất Cả Ngày!" : lang === "zh" ? "升级至 FinBridge Premium 解锁所有日期！" : "Upgrade to FinBridge Premium to Unlock All Days!"}</button>}
    <div className="r-calendar-title"><button aria-label={lang === "vi" ? "Tháng trước" : lang === "zh" ? "上个月" : "Previous month"} onClick={() => change(-1)}><ChevronLeft size={20} /></button><b>{calMonthTitle}</b><button aria-label={lang === "vi" ? "Tháng sau" : lang === "zh" ? "下个月" : "Next month"} onClick={() => change(1)}><ChevronRight size={20} /></button><button aria-label={lang === "vi" ? "Tháng hiện tại" : lang === "zh" ? "当前月" : "Current month"} onClick={() => { setMonth(9); setYear(2026); }}><RotateCcw size={18} /></button></div>
    <MonthCalendar month={month} year={year} transactions={state.transactions} onPick={(value) => setDay(value)} />
    {day && <div className="r-calendar-day"><h3>{day}</h3>{state.transactions.filter((t) => t.date === day).length ? state.transactions.filter((t) => t.date === day).map((t) => <p key={t.id}>{t.title} · {t.amount}</p>) : <p>Chưa có giao dịch trong ngày này.</p>}</div>}
    {milestones && <section className="r-achievements"><h2>Thành tựu</h2><div>{[["Chuỗi Dài Nhất", "highest-streak-cropped.png"], ["Tuần Hoàn Hảo", "highest-streak-cropped.png"], ["Tháng Hoàn Hảo", "Rolly-365-streak-removebg-preview.png"], ["Người Bảo Vệ Ngân Sách", "budget-badge.png"], ["Người Giữ Kho Báu", "savings-badge-cropped.png"], ["Kẻ Nghiền Nát Nợ", "debt-badge-right-cropped.png"]].map(([title, image]) => <button key={title} onClick={() => setAward(title)}><Image src={"/sites/rolly/images/" + image} width={130} height={130} alt={title} className={streak ? "" : "r-locked-badge"} /><span>{title}</span></button>)}</div></section>}
    {award && <Modal title={award} onClose={() => setAward("")}><p>Nhập giao dịch và hoàn thành mục tiêu của bạn để đạt thành tựu này.</p><button className="r-primary" onClick={() => setAward("")}>Đóng</button></Modal>}
  </div>;
}
const REQUESTS_I18N: Record<"vi" | "en" | "zh", [string, string][]> = {
  vi: [
    ["Kết nối với ngân hàng", "Có thể tự động ghi lại các giao dịch thực hiện trên ngân hàng/thẻ vào FinBridge và phân loại."],
    ["Thiết lập tiền tệ cơ bản và chuyển đổi tự động", "Bất kỳ loại tiền tệ nào khác cũng có thể được tự động chuyển đổi sang tiền tệ cơ bản dựa trên tỷ giá hối đoái."],
    ["Thêm qua thông báo ngay sau khi thanh toán", "Ngay sau khi bạn thanh toán xong, thêm giao dịch vào FinBridge trực tiếp từ thông báo — không cần mở ứng dụng."],
    ["Kết nối FinBridge với trợ lý AI của bạn", "Kết nối FinBridge với trợ lý hoặc AI riêng của bạn qua kết nối MCP, để nó tự động thêm và kiểm tra giao dịch cho bạn."],
    ["Thêm giao dịch bằng Siri hoặc Google Assistant", "Ghi lại chi tiêu rảnh tay bằng cách nhờ Siri hoặc Google Assistant mà không cần mở ứng dụng."],
    ["Yêu cầu mở khóa khi mở ứng dụng", "Yêu cầu Face ID, vân tay hoặc mật mã mỗi khi bạn mở FinBridge để bảo mật tài chính của bạn."],
    ["Nhập sao kê ngân hàng", "Chuyển tiếp hoặc tải lên sao kê ngân hàng hàng tháng dưới dạng PDF hoặc CSV, FinBridge sẽ thêm toàn bộ giao dịch cùng lúc."],
    ["Tự động ghi giao dịch Apple Pay và Google Pay", "Liên kết FinBridge với Apple Pay hoặc Google Pay để mọi khoản thanh toán bạn thực hiện đều được ghi lại tự động."],
    ["Ghi chi tiêu từ Telegram hoặc Zalo", "Nhắn tin cho bot FinBridge trên Telegram hoặc Zalo để ghi lại một khoản chi."],
    ["Chia sẻ vào FinBridge từ mọi ứng dụng", "Chia sẻ hóa đơn, ảnh chụp màn hình hay xác nhận thanh toán thẳng vào FinBridge từ bất kỳ ứng dụng nào."],
  ],
  en: [
    ["Direct Bank Sync", "Automatically import and categorize transactions executed on supported banks and cards directly into FinBridge."],
    ["Base Currency & Auto Conversion", "Automatically convert multiple account currencies into your primary base currency using live exchange rates."],
    ["Add from Payment Notifications", "Log transactions right from system payment notifications without having to open the app."],
    ["Connect FinBridge to Personal AI Assistant", "Integrate FinBridge with your personal AI via MCP to log and audit transactions autonomously."],
    ["Voice Entry via Siri & Google Assistant", "Record expenses hands-free using Siri or Google Assistant voice commands."],
    ["Biometric Lock on App Open", "Require Face ID, fingerprint, or passcode every time FinBridge is launched for enhanced financial security."],
    ["Bank Statement PDF / CSV Import", "Upload or forward monthly bank statements; FinBridge will ingest all statement entries at once."],
    ["Apple Pay & Google Pay Auto-sync", "Link Apple Pay or Google Pay to record contactless mobile transactions automatically."],
    ["Expense Logging via Telegram & Zalo", "Message the official FinBridge bot on Telegram or Zalo to record quick expenses on the go."],
    ["Share Sheet Integration", "Share receipts, bill screenshots, or payment confirmations straight into FinBridge from any third-party app."],
  ],
  zh: [
    ["银行账户自动连接", "自动同步银行卡消费记录并智能归类，无需手动输入。"],
    ["基础货币与自动汇率换算", "基于实时汇率将不同币种的交易自动折算为您的主货币。"],
    ["支付后通知栏快捷记账", "完成支付后直接通过系统通知快捷记账，无需打开应用。"],
    ["通过 MCP 连接个人 AI 助手", "通过 MCP 协议将 FinBridge 与您的个人 AI 助手打通，实现智能记账与审查。"],
    ["Siri / Google Assistant 语音记账", "通过语音助手快速报销和记账，彻底解放双手。"],
    ["启动应用时生物识别解锁", "每次打开应用均需 Face ID、指纹或密码解锁，保护财务隐私安全。"],
    ["导入银行对账单 (PDF / CSV)", "上传或转发银行月度账单，一键批量导入所有交易明细。"],
    ["Apple Pay / Google Pay 自动记账", "关联 Apple Pay 与 Google Pay，每次刷卡支付均自动同步入账。"],
    ["通过 Telegram / Zalo 快捷记账", "向 FinBridge 官方机器人发送消息即可快速录入日常开销。"],
    ["跨应用分享单据直接入账", "从任何应用直接分享电子发票、截图或支付凭证到 FinBridge。"],
  ],
};

const COMPLETED_REQUESTS_I18N = {
  "vi": [
    [
      "Ví và lịch sử giao dịch",
      "Theo dõi số dư, thu chi và lọc giao dịch theo ví."
    ],
    [
      "Ngân sách và khoản chi cố định",
      "Lập hạn mức và theo dõi lịch đến hạn."
    ],
    [
      "Lịch thu chi",
      "Xem giao dịch đã ghi nhận và các khoản dự kiến đến hạn."
    ],
    [
      "Ba ngôn ngữ",
      "Sử dụng giao diện tiếng Việt, English hoặc 中文."
    ]
  ],
  "en": [
    [
      "Wallets and transaction history",
      "Track recorded balances, income and expenses, and filter by wallet."
    ],
    [
      "Budgets and fixed expenses",
      "Set spending limits and track scheduled commitments."
    ],
    [
      "Cash-flow calendar",
      "View recorded transactions and scheduled due dates."
    ],
    [
      "Three languages",
      "Use the interface in Vietnamese, English or Chinese."
    ]
  ],
  "zh": [
    [
      "钱包和交易记录",
      "跟踪已记录余额、收支并按钱包筛选。"
    ],
    [
      "预算和固定支出",
      "设置支出限额，跟踪到期计划。"
    ],
    [
      "收支日历",
      "查看已记录交易和计划到期日。"
    ],
    [
      "三种语言",
      "支持越南语、英语和中文界面。"
    ]
  ]
};

const UI_TEXT = {
  "vi": {
    "title": "Yêu cầu tính năng",
    "subtitle": "Khám phá ý tưởng và gửi đề xuất. Nút thích chỉ lưu lựa chọn cá nhân, không phải phiếu bầu cộng đồng.",
    "completedBtn": "Xem tính năng hiện có >",
    "inProgress": "Ý tưởng tham khảo",
    "underReview": "Ý tưởng tham khảo",
    "voteAria": "Lưu ý tưởng yêu thích: ",
    "suggestBtn": "Tôi có yêu cầu khác",
    "modalTitle": "Đề xuất tính năng",
    "sentSuccess": "Đã ghi nhận đề xuất trong hệ thống.",
    "inputPlaceholder": "Mô tả tính năng bạn mong muốn...",
    "inputNote": "Đề xuất được lưu trong hệ thống; chưa phải cam kết đưa vào lộ trình.",
    "submitBtn": "Gửi đề xuất",
    "completedTitle": "Tính năng hiện có",
    "completedSubtitle": "Các chức năng hiện có trong FinBridge."
  },
  "en": {
    "title": "Feature requests",
    "subtitle": "Explore ideas and submit a suggestion. Likes save personal preferences, not community votes.",
    "completedBtn": "View available features >",
    "inProgress": "Example idea",
    "underReview": "Example idea",
    "voteAria": "Save preferred idea: ",
    "suggestBtn": "Suggest another feature",
    "modalTitle": "Suggest a feature",
    "sentSuccess": "Your suggestion was saved in the system.",
    "inputPlaceholder": "Describe the feature you would like...",
    "inputNote": "Suggestions are stored in the system, with no commitment to a release date.",
    "submitBtn": "Submit suggestion",
    "completedTitle": "Available features",
    "completedSubtitle": "Features currently available in FinBridge."
  },
  "zh": {
    "title": "功能建议",
    "subtitle": "浏览想法并提交建议。点赞仅保存个人偏好，并非社区投票。",
    "completedBtn": "查看现有功能 >",
    "inProgress": "参考想法",
    "underReview": "参考想法",
    "voteAria": "保存喜欢的想法：",
    "suggestBtn": "提出其他建议",
    "modalTitle": "提交功能建议",
    "sentSuccess": "建议已保存到系统。",
    "inputPlaceholder": "描述您希望的功能…",
    "inputNote": "建议将保存在系统中，并不代表已承诺上线时间。",
    "submitBtn": "提交建议",
    "completedTitle": "现有功能",
    "completedSubtitle": "FinBridge 当前提供的功能。"
  }
};

export function CompletedRequests({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);
  const t = UI_TEXT[lang];
  const list = COMPLETED_REQUESTS_I18N[lang] || COMPLETED_REQUESTS_I18N.vi;

  return (
    <div className="r-feature-page r-feature-completed-page">
      <PageHeader title={t.completedTitle} close onBack={() => navigate("featureRequest")} />
      <p>{t.completedSubtitle}</p>
      <div className="r-feature-list">
        {list.map(([title, text]) => (
          <article key={title}>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function FeatureRequests({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);
  const t = UI_TEXT[lang];
  const list = REQUESTS_I18N[lang] || REQUESTS_I18N.vi;
  const [other, setOther] = useState(false);
  const [customRequest, setCustomRequest] = useState("");
  const feedback = useFeedbackSubmission("feature", lang);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!customRequest.trim()) return;
    if (await feedback.submit("", customRequest)) setCustomRequest("");
  }

  return (
    <div className="r-feature-page">
      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        close
        onBack={() => navigate("?tab=settings")}
      />
      <button className="r-feature-completed" onClick={() => navigate("featureRequestCompleted")}>
        {t.completedBtn}
      </button>
      <div className="r-feature-list">
        {list.map(([title, desc], i) => (
          <article key={title}>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <small>{i === 0 ? t.inProgress : t.underReview}</small>
            </div>
            <button
              aria-label={t.voteAria + title}
              className={state.settings["vote" + i] ? "r-voted" : ""}
              onClick={() => setSetting("vote" + i, !state.settings["vote" + i])}
            >
              <ThumbsUp fill="currentColor" />
            </button>
          </article>
        ))}
      </div>
      <button className="r-primary" onClick={() => { feedback.reset(); setOther(true); }}>
        {t.suggestBtn}
      </button>
      {other && (
        <Modal title={t.modalTitle} wide onClose={() => setOther(false)}>
          {feedback.receipt ? (
            <div className="r-dialog-note" style={{ color: "var(--r-teal)", textAlign: "center", padding: "20px" }}>
              {feedback.copy.saved} <code>{feedback.receipt?.id}</code>
            </div>
          ) : (
            <form className="r-form" onSubmit={handleSendRequest}>
              <textarea
                aria-label={t.modalTitle}
                placeholder={t.inputPlaceholder}
                maxLength={2000}
                disabled={feedback.busy}
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                required
                rows={4}
              />
              <p className="r-dialog-note">
                {t.inputNote}
              </p>
              {feedback.error && <p role="alert">{feedback.error}</p>}
              <button type="submit" className="r-primary" disabled={feedback.busy}>
                {feedback.busy ? feedback.copy.busy : t.submitBtn}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
export function FeatureRequestsModal({ onClose }: { onClose: () => void }) {
  const state = useAppState();
  const lang = settingsLanguage(state.settings.language);
  const t = UI_TEXT[lang] || UI_TEXT.vi;
  const list = REQUESTS_I18N[lang] || REQUESTS_I18N.vi;
  const completedList = COMPLETED_REQUESTS_I18N[lang] || COMPLETED_REQUESTS_I18N.vi;
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [other, setOther] = useState(false);
  const [customRequest, setCustomRequest] = useState("");
  const feedback = useFeedbackSubmission("feature", lang);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!customRequest.trim()) return;
    if (await feedback.submit("", customRequest)) setCustomRequest("");
  }

  return (
    <Modal title={t.title} wide onClose={onClose}>
      <div className="fb-features-modal-body">
        <div className="fb-features-modal-top">
          <p className="fb-modal-subheading">
            {tab === "active" ? t.subtitle : t.completedSubtitle}
          </p>
          <div className="fb-modal-tab-bar fb-features-tabs">
            <button
              type="button"
              className={"fb-tab-btn" + (tab === "active" ? " active" : "")}
              onClick={() => { setTab("active"); setOther(false); }}
            >
              {lang === "vi" ? "Ý tưởng" : lang === "zh" ? "想法" : "Ideas"}
            </button>
            <button
              type="button"
              className={"fb-tab-btn" + (tab === "completed" ? " active" : "")}
              onClick={() => { setTab("completed"); setOther(false); }}
            >
              {t.completedTitle}
            </button>
          </div>
        </div>

        {tab === "active" ? (
          <>
            <div className="r-feature-list fb-features-list-scroll">
              {list.map(([title, desc], i) => (
                <article key={title}>
                  <div>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                    <small>{i === 0 ? t.inProgress : t.underReview}</small>
                  </div>
                  <button
                    type="button"
                    aria-label={t.voteAria + title}
                    className={state.settings["vote" + i] ? "r-voted" : ""}
                    onClick={() => setSetting("vote" + i, !state.settings["vote" + i])}
                  >
                    <ThumbsUp fill="currentColor" size={18} />
                  </button>
                </article>
              ))}
            </div>

            {other ? (
              <div className="fb-features-suggest-box">
                {feedback.receipt ? (
                  <div className="fb-contact-success-msg">
                    <Check size={20} />
                    <p>{feedback.copy.saved} <code>{feedback.receipt?.id}</code></p>
                  </div>
                ) : (
                  <form onSubmit={handleSendRequest} className="fb-contact-form">
                    <label className="fb-form-group">
                      <span className="fb-form-label">{t.modalTitle}</span>
                      <textarea
                        className="fb-input"
                        rows={3}
                        placeholder={t.inputPlaceholder}
                maxLength={2000}
                disabled={feedback.busy}
                        value={customRequest}
                        onChange={(e) => setCustomRequest(e.target.value)}
                        required
                      />
                      <small className="fb-helper-text">{t.inputNote}</small>
                    </label>
                    <div className="fb-modal-actions">
                      <button type="button" className="r-button" onClick={() => setOther(false)}>
                        {lang === "vi" ? "Hủy" : lang === "zh" ? "取消" : "Cancel"}
                      </button>
                      {feedback.error && <p role="alert">{feedback.error}</p>}
                      <button type="submit" className="r-primary fb-contact-submit-btn" disabled={feedback.busy}>
                        <Send size={15} />
                        <span>{feedback.busy ? feedback.copy.busy : t.submitBtn}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="fb-modal-actions">
                <button type="button" className="r-button" onClick={onClose}>
                  {lang === "vi" ? "Đóng" : lang === "zh" ? "关闭" : "Close"}
                </button>
                <button type="button" className="r-primary" onClick={() => { feedback.reset(); setOther(true); }}>
                  <Plus size={16} />
                  <span>{t.suggestBtn}</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="r-feature-list fb-features-list-scroll">
              {completedList.map(([title, text]) => (
                <article key={title}>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="fb-modal-actions">
              <button type="button" className="r-primary" onClick={onClose}>
                {lang === "vi" ? "Đóng" : lang === "zh" ? "关闭" : "Close"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
export function PremiumPage({ navigate }: { navigate: (screen: string) => void }) {
  const [trial, setTrial] = useState(false);
  const [plans, setPlans] = useState(false);
  const [selected, setSelected] = useState("Hàng năm");
  const [payment, setPayment] = useState(false);
  return (
    <div className="r-premium-page">
      <PageHeader close onBack={() => navigate("?tab=settings")} />
      <h1>Dùng thử FinBridge Premium miễn phí</h1>
      <h2>Xây dựng thói quen quản lý tiền bạc tốt hơn bằng các công cụ AI mạnh mẽ.</h2>
      <ul>
        {[
          "Mở khóa tiềm năng đầy đủ - truy cập mọi tính năng",
          "Quét hóa đơn hoặc phiếu thu để dễ dàng liệt kê từng giao dịch",
          "Nhập liệu bằng giọng nói với các lệnh đơn giản để theo dõi chi tiêu rảnh tay",
          "Tạo nhiều ví để quản lý tài chính cho du lịch, công việc và cuộc sống cá nhân một cách riêng biệt",
          "Mời bạn bè/gia đình vào ví để cùng nhau quản lý chi phí chung",
          "Hiểu rõ hơn về thói quen chi tiêu của bạn với phân tích AI nâng cao",
          "Khóa sinh trắc học cho ví của bạn để bảo mật tốt hơn",
          "Xuất/Nhập tệp CSV",
        ].map((text, i) => (
          <li key={text}>
            <Icon code={["f534", "f030", "f130", "f555", "f234", "f201", "f023", "f019"][i]} />
            {text}
          </li>
        ))}
      </ul>
      <p>VÀ NHIỀU HƠN NỮA...</p>
      <button className="r-text-link" onClick={() => setPayment(true)}>
        Đổi mã khuyến mãi
      </button>
      <div className="r-premium-bottom">
        <div className="r-toggle-row">
          <span>Kích hoạt bản dùng thử miễn phí</span>
          <Toggle checked={trial} label="Kích hoạt bản dùng thử miễn phí" onChange={setTrial} />
        </div>
        <b>
          ₫249,000 mỗi năm <small>(20,750/tháng)</small>
        </b>
        <button className="r-premium-continue" onClick={() => setPlans(true)}>
          Tiếp tục
        </button>
        <button className="r-text-link" onClick={() => setPlans(true)}>
          Xem tất cả các kế hoạch
        </button>
      </div>
      {plans && (
        <Modal wide onClose={() => setPlans(false)}>
          <div className="r-plan-list">
            {[
              ["Hàng tháng", "₫79,000"],
              ["Hàng năm", "₫249,000"],
              ["Trọn đời", "₫739,000"],
            ].map(([name, price]) => (
              <button key={name} className={name === selected ? "active" : ""} onClick={() => setSelected(name)}>
                <span>
                  <b>{name}</b>
                  <small>{price}</small>
                </span>
                {name === selected ? "✓" : "○"}
              </button>
            ))}
          </div>
          <p className="r-center r-small">Đăng ký sẽ tự động gia hạn, bạn có thể hủy bất cứ lúc nào.</p>
          <button
            className="r-primary"
            onClick={() => {
              setPlans(false);
              setPayment(true);
            }}
          >
            Bắt đầu dùng thử miễn phí ›
          </button>
        </Modal>
      )}
      {payment && (
        <Modal title="FinBridge Premium" wide onClose={() => setPayment(false)}>
          <p>Tính năng thanh toán Premium đang được tích hợp trực tiếp trong các bản cập nhật sắp tới của FinBridge.</p>
          <button type="button" className="r-primary" onClick={() => setPayment(false)}>
            Đã hiểu
          </button>
        </Modal>
      )}
    </div>
  );
}
