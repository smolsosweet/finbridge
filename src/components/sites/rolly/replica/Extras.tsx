"use client";

import Image from "next/image";
import { useState } from "react";
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

const COMPLETED_REQUESTS_I18N: Record<"vi" | "en" | "zh", [string, string][]> = {
  vi: [
    ["Tải Lên Hóa Đơn", "Khi hóa đơn được tải lên, nó sẽ tự động được phân tích và thêm vào dưới dạng giao dịch."],
    ["Nhắc Nhở Thông Báo", "FinBridge sẽ gửi thông báo đẩy để nhắc bạn thêm chi tiêu vào thời gian bạn đã chọn."],
    ["Quản Lý Ví Chung", "Có thể mời người dùng khác vào ví và quản lý chi tiêu cùng nhau."],
    ["Đặt Thời Gian Và Ngày Bắt Đầu Của Ngân Sách", "Ngân sách giờ đây có thể được tạo theo ngày, tuần hoặc tháng."],
    ["Mục tiêu tiết kiệm có thể được đặt là định kỳ", "Khi tạo mục tiêu tiết kiệm, có tùy chọn để lặp lại hàng tháng hoặc hàng tuần"],
    ["Tùy chỉnh tính cách của FinBridge", "Tạo và thiết lập tính cách cùng giọng điệu phản hồi của FinBridge theo cách bạn muốn – dù là trả lời như mẹ bạn, vợ bạn hay thậm chí là người bạn thầm thích."],
    ["Lịch sử ngân sách kỳ trước", "Có thể xem số tiền đã chi trong ngân sách ở các chu kỳ trước."],
    ["Danh mục con", "Cho phép tạo danh mục con dưới mỗi danh mục chính"],
    ["Chế độ ngoại tuyến", "Có thể đọc và nhập giao dịch khi ngoại tuyến."],
    ["Tạo ví thẻ tín dụng", "Đặt hạn mức tín dụng của bạn và xem còn lại bao nhiêu."],
    ["Phiên bản web", "Có thể sử dụng ứng dụng FinBridge trên trang web bằng máy tính để bàn"],
    ["Mở Khóa Sinh Trắc Học", "Có thể đặt ví yêu cầu mở khóa sinh trắc học để tăng cường quyền riêng tư."],
    ["Thay đổi ngày bắt đầu tháng", "Có thể đặt ngày bắt đầu của tháng (ví dụ: ngày 15) cho những người nhận lương vào các ngày khác nhau"],
    ["Nhiều danh mục cho ngân sách", "Có khả năng chọn nhiều danh mục trong một ngân sách."],
    ["Nhiều Giao Dịch Cùng Lúc", "Bạn chỉ cần nhập nhiều giao dịch trong một câu và FinBridge sẽ tự động nhập từng giao dịch riêng lẻ cho bạn."],
    ["Tiện Ích Màn Hình Chính", "Tổng quan chi tiêu của bạn trên trang chủ và liên kết nhanh đến trang thêm giao dịch."],
    ["Tính năng vay", "Theo dõi số tiền cho vay và vay mượn"],
    ["Chuyển tiếp email hóa đơn đến FinBridge", "Nhận địa chỉ email FinBridge của riêng bạn. Chuyển tiếp bất kỳ hóa đơn, thông báo ngân hàng hay phí đăng ký nào đến đó, FinBridge sẽ ghi lại giao dịch cho bạn và thông báo khi đã thêm xong."],
    ["Lập ngân sách với AI", "Cho phép AI gợi ý ngân sách và tự động tạo ngân sách phù hợp"],
  ],
  en: [
    ["Receipt & Invoice Scanner", "Upload receipts or invoices to automatically parse and record them as verified transactions."],
    ["Daily Notification Reminders", "FinBridge sends gentle push reminders at your chosen times so you never miss recording spending."],
    ["Shared Wallet Collaboration", "Invite family members or team partners to collaborate on shared wallets in real time."],
    ["Custom Budget Cycle & Start Dates", "Budgets can now follow daily, weekly, or monthly cadences tailored to your pay schedule."],
    ["Recurring Savings Goals", "Set repeating weekly or monthly contributions towards your target financial savings goals."],
    ["Custom AI Persona & Tone", "Customize FinBridge's AI conversation tone and personality to match your preferred communication style."],
    ["Past Budget Cycle History", "Review previous periods' actual spending vs planned budget allocations with full retrospective analytics."],
    ["Sub-category Hierarchies", "Create granular sub-categories nested beneath parent expense categories."],
    ["Offline Mode Support", "Seamlessly read and record transactions even when disconnected from the internet."],
    ["Credit Card Wallet Tracking", "Define credit limits, statement cycles, and monitor real-time available balances."],
    ["Full Desktop Web Platform", "Access FinBridge from any modern web browser on desktop and laptop computers."],
    ["Biometric Wallet Protection", "Lock sensitive individual wallets with biometric security for complete privacy."],
    ["Flexible Month Start Day", "Configure the month start day (e.g. 15th) to match individual payroll and income cycles."],
    ["Multi-category Budgeting", "Group and monitor multiple spending categories under a single unified budget envelope."],
    ["Batch Transaction Natural Language Input", "Describe multiple purchases in one single sentence and FinBridge parses each one individually."],
    ["Home Screen Widgets", "Glance at spending summaries on your home screen with one-tap shortcuts to record expenses."],
    ["Loan & Debt Tracking", "Keep track of money lent, borrowed, installment schedules, and remaining balances."],
    ["Email Bill Forwarding", "Get your dedicated FinBridge email address. Forward any invoice or bank receipt and it logs automatically."],
    ["AI-assisted Budget Creation", "Let AI analyze your historical patterns and suggest realistic budgets tailored to your lifestyle."],
  ],
  zh: [
    ["单据与发票智能识别", "上传发票或小票，AI 自动解析并录入为正式交易明细。"],
    ["每日记账通知提醒", "在您设定的时间接收推送提醒，培养每日清晰记账的好习惯。"],
    ["多人共享钱包协作", "邀请家庭成员或伴侣加入钱包，共同协作管理日常开支。"],
    ["自定义预算周期与起始日", "预算现已支持按日、周或月周期制定，更符合不同发薪节奏。"],
    ["定期储蓄目标规划", "支持设定每周或每月的定期存款计划，稳步达成储蓄目标。"],
    ["个性化 AI 交互人设", "自定义 FinBridge 的应答语调与个性风格，打造专属记账体验。"],
    ["往期预算历史回溯", "随时查阅过往各周期的预算执行情况与支出对比。"],
    ["多级子分类管理", "在各大支出分类下自由创建多级子类别，账目更细致。"],
    ["全功能离线模式", "无网络环境下依然能够顺畅查阅与录入新交易。"],
    ["信用卡专属钱包与额度追踪", "设置信用额度、账单日并实时监控可用额度与还款情况。"],
    ["桌面端 Web 完整版本", "支持在电脑大屏浏览器上体验全功能 FinBridge 工作空间。"],
    ["生物识别隐私保护", "为特定私密钱包开启指纹或面容锁，确保隐私无忧。"],
    ["自定义月份起始日期", "支持设定账单月起始日（如每月15日），贴合个人实际发薪周期。"],
    ["多类别组合预算", "可在单个预算中灵活关联多个支出类别。"],
    ["自然语言一次批量录入", "一句话包含多项收支，FinBridge 自动拆解并分别入账。"],
    ["主屏幕桌面小组件", "在主屏幕一览当期收支，一键直达记账界面。"],
    ["借贷与欠款追踪管理", "清晰记录借入与借出账目，掌握每笔分期与待还明细。"],
    ["账单邮件转发自动入账", "获得专属 FinBridge 邮箱，直接转发账单邮件即可自动生成记录。"],
    ["AI 智能辅助预算编制", "由 AI 分析历史消费偏好，量身定制合理的收支预算方案。"],
  ],
};

const UI_TEXT = {
  vi: {
    title: "Yêu cầu tính năng",
    subtitle: "Hãy bỏ phiếu cho các tính năng bạn muốn thấy hoặc đề xuất các tính năng mới cho FinBridge.",
    completedBtn: "Xem yêu cầu đã hoàn thành ›",
    inProgress: "Đang thực hiện",
    underReview: "Đang được xem xét",
    voteAria: "Bỏ phiếu: ",
    suggestBtn: "Tôi có yêu cầu khác",
    modalTitle: "Tôi có yêu cầu khác",
    sentSuccess: "Cảm ơn bạn! Yêu cầu tính năng đã được gửi tới đội ngũ FinBridge.",
    inputPlaceholder: "Mô tả tính năng hoặc ý tưởng bạn mong muốn FinBridge phát triển...",
    inputNote: "Đội ngũ FinBridge sẽ ghi nhận và xem xét đưa tính năng này vào lộ trình cập nhật sắp tới.",
    submitBtn: "Gửi yêu cầu",
    completedTitle: "Yêu cầu tính năng đã hoàn thành",
    completedSubtitle: "Chúng tôi đã hoàn thiện các tính năng bên dưới trong ứng dụng theo yêu cầu của bạn.",
  },
  en: {
    title: "Feature requests",
    subtitle: "Vote on features you would like to see or suggest new development ideas for FinBridge.",
    completedBtn: "View completed requests ›",
    inProgress: "In progress",
    underReview: "Under review",
    voteAria: "Vote: ",
    suggestBtn: "Suggest another feature",
    modalTitle: "Suggest another feature",
    sentSuccess: "Thank you! Your feature suggestion has been submitted to the FinBridge team.",
    inputPlaceholder: "Describe the feature or idea you would like FinBridge to build...",
    inputNote: "The FinBridge team will review this and consider it for upcoming product roadmap updates.",
    submitBtn: "Submit suggestion",
    completedTitle: "Completed feature requests",
    completedSubtitle: "We have shipped the following features in the application based on your community requests.",
  },
  zh: {
    title: "功能建议",
    subtitle: "为您期待的功能投票或提出全新的创意建议，与我们一同完善 FinBridge。",
    completedBtn: "查看已完成的功能 ›",
    inProgress: "正在开发",
    underReview: "评估中",
    voteAria: "投票：",
    suggestBtn: "我有其他建议",
    modalTitle: "我有其他建议",
    sentSuccess: "感谢您的反馈！功能建议已成功提交至 FinBridge 团队。",
    inputPlaceholder: "请描述您期望 FinBridge 开发的功能或想法...",
    inputNote: "FinBridge 团队将认真审阅并纳入后续产品迭代规划中。",
    submitBtn: "提交建议",
    completedTitle: "已实现的功能需求",
    completedSubtitle: "我们已根据社区用户的建议在应用中上线了以下功能。",
  },
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
  const [submitted, setSubmitted] = useState(false);

  function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!customRequest.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setCustomRequest("");
      setOther(false);
    }, 1500);
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
      <button className="r-primary" onClick={() => setOther(true)}>
        {t.suggestBtn}
      </button>
      {other && (
        <Modal title={t.modalTitle} wide onClose={() => setOther(false)}>
          {submitted ? (
            <div className="r-dialog-note" style={{ color: "var(--r-teal)", textAlign: "center", padding: "20px" }}>
              {t.sentSuccess}
            </div>
          ) : (
            <form className="r-form" onSubmit={handleSendRequest}>
              <textarea
                aria-label="Yêu cầu của bạn"
                placeholder={t.inputPlaceholder}
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                required
                rows={4}
              />
              <p className="r-dialog-note">
                {t.inputNote}
              </p>
              <button type="submit" className="r-primary">
                {t.submitBtn}
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
  const [submitted, setSubmitted] = useState(false);

  function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!customRequest.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setCustomRequest("");
      setOther(false);
    }, 1500);
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
              {lang === "vi" ? "Đang bình chọn" : lang === "zh" ? "投票中" : "Active ideas"}
            </button>
            <button
              type="button"
              className={"fb-tab-btn" + (tab === "completed" ? " active" : "")}
              onClick={() => { setTab("completed"); setOther(false); }}
            >
              {lang === "vi" ? "Đã hoàn thành" : lang === "zh" ? "已上线" : "Completed"}
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
                {submitted ? (
                  <div className="fb-contact-success-msg">
                    <Check size={20} />
                    <p>{t.sentSuccess}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSendRequest} className="fb-contact-form">
                    <label className="fb-form-group">
                      <span className="fb-form-label">{t.modalTitle}</span>
                      <textarea
                        className="fb-input"
                        rows={3}
                        placeholder={t.inputPlaceholder}
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
                      <button type="submit" className="r-primary fb-contact-submit-btn">
                        <Send size={15} />
                        <span>{t.submitBtn}</span>
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
                <button type="button" className="r-primary" onClick={() => setOther(true)}>
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
