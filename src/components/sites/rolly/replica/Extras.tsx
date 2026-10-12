"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, RotateCcw, ThumbsUp } from "lucide-react";
import { MonthCalendar } from "./Dashboard";
import { Icon, Mascot, Modal, PageHeader, Toggle } from "./Ui";
import { setSetting, useAppState } from "./store";

export function CalendarPage({ navigate, milestones = false }: { navigate: (screen: string) => void; milestones?: boolean }) {
  const state = useAppState();
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState("");
  const [award, setAward] = useState("");
  const change = (delta: number) => { const date = new Date(year, month + delta, 1); setMonth(date.getMonth()); setYear(date.getFullYear()); };
  const streak = new Set(state.transactions.map((t) => t.date)).size;
  return <div className={milestones ? "r-milestones-page" : "r-calendar-page"}><PageHeader title={milestones ? "Những cột mốc" : "Lịch"} subtitle={milestones ? "Theo dõi những cột mốc tài chính của bạn" : undefined} close onBack={() => navigate(milestones ? "" : "?tab=transactions")} />
    {milestones ? <><div className="r-streak-summary"><div><b>{streak}</b><span>ngày chuỗi</span></div><Flame size={100} fill="#817d70" color="#817d70" /></div><div className="r-setting-row"><Icon code="f0eb" /><span>Nhập giao dịch hôm nay để bắt đầu chuỗi!</span></div></> : <button className="r-calendar-premium" onClick={() => navigate("paywall7dTrial")}><Icon code="f521" className="r-gold" />Nâng Cấp Lên Rolly Premium Để Mở Khóa Tất Cả Ngày!</button>}
    <div className="r-calendar-title"><button aria-label="Tháng trước" onClick={() => change(-1)}><ChevronLeft size={20} /></button><b>Tháng {month + 1} {year}</b><button aria-label="Tháng sau" onClick={() => change(1)}><ChevronRight size={20} /></button><button aria-label="Tháng hiện tại" onClick={() => { setMonth(9); setYear(2026); }}><RotateCcw size={18} /></button></div>
    <MonthCalendar month={month} year={year} transactions={state.transactions} onPick={(value) => setDay(value)} />
    {day && <div className="r-calendar-day"><h3>{day}</h3>{state.transactions.filter((t) => t.date === day).length ? state.transactions.filter((t) => t.date === day).map((t) => <p key={t.id}>{t.title} · {t.amount}</p>) : <p>Chưa có giao dịch trong ngày này.</p>}</div>}
    {milestones && <section className="r-achievements"><h2>Thành tựu</h2><div>{[["Chuỗi Dài Nhất", "highest-streak-cropped.png"], ["Tuần Hoàn Hảo", "highest-streak-cropped.png"], ["Tháng Hoàn Hảo", "Rolly-365-streak-removebg-preview.png"], ["Người Bảo Vệ Ngân Sách", "budget-badge.png"], ["Người Giữ Kho Báu", "savings-badge-cropped.png"], ["Kẻ Nghiền Nát Nợ", "debt-badge-right-cropped.png"]].map(([title, image]) => <button key={title} onClick={() => setAward(title)}><Image src={"/sites/rolly/images/" + image} width={130} height={130} alt={title} className={streak ? "" : "r-locked-badge"} /><span>{title}</span></button>)}</div></section>}
    {award && <Modal title={award} onClose={() => setAward("")}><p>Nhập giao dịch và hoàn thành mục tiêu của bạn để đạt thành tựu này.</p><button className="r-primary" onClick={() => setAward("")}>Đóng</button></Modal>}
  </div>;
}
const requests = [
  ["Kết nối với ngân hàng", "Có thể tự động ghi lại các giao dịch thực hiện trên ngân hàng/thẻ vào Rolly và phân loại."],
  ["Thiết lập tiền tệ cơ bản và chuyển đổi tự động", "Bất kỳ loại tiền tệ nào khác cũng có thể được tự động chuyển đổi sang tiền tệ cơ bản dựa trên tỷ giá hối đoái."],
  ["Thêm qua thông báo ngay sau khi thanh toán", "Ngay sau khi bạn thanh toán xong, thêm giao dịch vào Rolly trực tiếp từ thông báo — không cần mở ứng dụng."],
  ["Kết nối Rolly với trợ lý AI của bạn", "Kết nối Rolly với trợ lý hoặc AI riêng của bạn qua kết nối MCP, để nó tự động thêm và kiểm tra giao dịch cho bạn."],
  ["Thêm giao dịch bằng Siri hoặc Google Assistant", "Ghi lại chi tiêu rảnh tay bằng cách nhờ Siri hoặc Google Assistant mà không cần mở ứng dụng."],
  ["Yêu cầu mở khóa khi mở ứng dụng", "Yêu cầu Face ID, vân tay hoặc mật mã mỗi khi bạn mở Rolly để bảo mật tài chính của bạn."],
  ["Nhập sao kê ngân hàng", "Chuyển tiếp hoặc tải lên sao kê ngân hàng hàng tháng dưới dạng PDF hoặc CSV, Rolly sẽ thêm toàn bộ giao dịch cùng lúc."],
  ["Tự động ghi giao dịch Apple Pay và Google Pay", "Liên kết Rolly với Apple Pay hoặc Google Pay để mọi khoản thanh toán bạn thực hiện đều được ghi lại tự động."],
  ["Ghi chi tiêu từ Telegram hoặc Zalo", "Nhắn tin cho bot Rolly trên Telegram hoặc Zalo để ghi lại một khoản chi."],
  ["Chia sẻ vào Rolly từ mọi ứng dụng", "Chia sẻ hóa đơn, ảnh chụp màn hình hay xác nhận thanh toán thẳng vào Rolly từ bất kỳ ứng dụng nào."],
];
const completedRequests = [
  ["Tải Lên Hóa Đơn", "Khi hóa đơn được tải lên, nó sẽ tự động được phân tích và thêm vào dưới dạng giao dịch."],
  ["Nhắc Nhở Thông Báo", "Rolly sẽ gửi thông báo đẩy để nhắc bạn thêm chi tiêu vào thời gian bạn đã chọn."],
  ["Quản Lý Ví Chung", "Có thể mời người dùng khác vào ví và quản lý chi tiêu cùng nhau."],
  ["Đặt Thời Gian Và Ngày Bắt Đầu Của Ngân Sách", "Ngân sách giờ đây có thể được tạo theo ngày, tuần hoặc tháng."],
  ["Mục tiêu tiết kiệm có thể được đặt là định kỳ", "Khi tạo mục tiêu tiết kiệm, có tùy chọn để lặp lại hàng tháng hoặc hàng tuần"],
  ["Tùy chỉnh tính cách của Rolly", "Tạo và thiết lập tính cách cùng giọng điệu phản hồi của Rolly theo cách bạn muốn – dù là trả lời như mẹ bạn, vợ bạn hay thậm chí là người bạn thầm thích."],
  ["Lịch sử ngân sách kỳ trước", "Có thể xem số tiền đã chi trong ngân sách ở các chu kỳ trước."],
  ["Danh mục con", "Cho phép tạo danh mục con dưới mỗi danh mục chính"],
  ["Chế độ ngoại tuyến", "Có thể đọc và nhập giao dịch khi ngoại tuyến."],
  ["Tạo ví thẻ tín dụng", "Đặt hạn mức tín dụng của bạn và xem còn lại bao nhiêu."],
  ["Phiên bản web", "Có thể sử dụng ứng dụng Rolly trên trang web bằng máy tính để bàn"],
  ["Mở Khóa Sinh Trắc Học", "Có thể đặt ví yêu cầu mở khóa sinh trắc học để tăng cường quyền riêng tư."],
  ["Thay đổi ngày bắt đầu tháng", "Có thể đặt ngày bắt đầu của tháng (ví dụ: ngày 15) cho những người nhận lương vào các ngày khác nhau"],
  ["Nhiều danh mục cho ngân sách", "Có khả năng chọn nhiều danh mục trong một ngân sách."],
  ["Nhiều Giao Dịch Cùng Lúc", "Bạn chỉ cần nhập nhiều giao dịch trong một câu và Rolly sẽ tự động nhập từng giao dịch riêng lẻ cho bạn."],
  ["Tiện Ích Màn Hình Chính", "Tổng quan chi tiêu của bạn trên trang chủ và liên kết nhanh đến trang thêm giao dịch."],
  ["Tính năng vay", "Theo dõi số tiền cho vay và vay mượn"],
  ["Chuyển tiếp email hóa đơn đến Rolly", "Nhận địa chỉ email Rolly của riêng bạn. Chuyển tiếp bất kỳ hóa đơn, thông báo ngân hàng hay phí đăng ký nào đến đó, Rolly sẽ ghi lại giao dịch cho bạn và thông báo khi đã thêm xong."],
  ["Lập ngân sách với AI", "Cho phép AI gợi ý ngân sách và tự động tạo ngân sách phù hợp"],
];
export function CompletedRequests({ navigate }: { navigate: (screen: string) => void }) {
  return <div className="r-feature-page r-feature-completed-page"><PageHeader title="Yêu cầu tính năng đã hoàn thành" close onBack={() => navigate("featureRequest")} /><p>Chúng tôi đã hoàn thiện các tính năng bên dưới trong ứng dụng theo yêu cầu của bạn.</p><div className="r-feature-list">{completedRequests.map(([title, text]) => <article key={title}><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div>;
}
export function FeatureRequests({ navigate }: { navigate: (screen: string) => void }) {
  const state = useAppState();
  const [other, setOther] = useState(false);
  return <div className="r-feature-page"><PageHeader title="Yêu cầu tính năng" close onBack={() => navigate("?tab=settings")} /><div className="r-feature-intro"><Mascot /><h2>Hãy giúp chúng tôi cải thiện!</h2><p>Hãy bỏ phiếu cho các tính năng bạn muốn thấy hoặc đề xuất các tính năng mới. Chúng tôi ưu tiên phát triển dựa trên phản hồi của cộng đồng.</p></div><button className="r-feature-completed" onClick={() => navigate("featureRequestCompleted")}>Xem yêu cầu đã hoàn thành ›</button><div className="r-feature-list">{requests.map(([title, desc], i) => <article key={title}><div><h3>{title}</h3><p>{desc}</p><small>{i === 0 ? "Đang thực hiện" : "Đang được xem xét"}</small></div><button aria-label={"Bỏ phiếu: " + title} className={state.settings["vote" + i] ? "r-voted" : ""} onClick={() => setSetting("vote" + i, !state.settings["vote" + i])}><ThumbsUp fill="currentColor" /></button></article>)}</div><button className="r-primary" onClick={() => setOther(true)}>Tôi có yêu cầu khác</button>{other && <Modal title="Tôi có yêu cầu khác" onClose={() => setOther(false)}><div className="r-form"><textarea aria-label="Yêu cầu của bạn" placeholder="Yêu cầu của bạn..." /><p>Gửi yêu cầu tới đội ngũ Rolly qua trang liên hệ.</p><a className="r-primary" href="https://rollyapp.ai/vi/lien-he" target="_blank" rel="noreferrer">Liên hệ với chúng tôi</a></div></Modal>}</div>;
}
export function PremiumPage({ navigate }: { navigate: (screen: string) => void }) {
  const [trial, setTrial] = useState(false);
  const [plans, setPlans] = useState(false);
  const [selected, setSelected] = useState("Hàng năm");
  const [payment, setPayment] = useState(false);
  return <div className="r-premium-page"><PageHeader close onBack={() => navigate("?tab=settings")} /><Mascot /><h1>Dùng thử Rolly Premium miễn phí</h1><h2>Xây dựng thói quen quản lý tiền bạc tốt hơn bằng các công cụ AI mạnh mẽ.</h2><ul>{["Mở khóa tiềm năng đầy đủ - truy cập mọi tính năng", "Quét hóa đơn hoặc phiếu thu để dễ dàng liệt kê từng giao dịch", "Nhập liệu bằng giọng nói với các lệnh đơn giản để theo dõi chi tiêu rảnh tay", "Tạo nhiều ví để quản lý tài chính cho du lịch, công việc và cuộc sống cá nhân một cách riêng biệt", "Mời bạn bè/gia đình vào ví để cùng nhau quản lý chi phí chung", "Hiểu rõ hơn về thói quen chi tiêu của bạn với phân tích AI nâng cao", "Khóa sinh trắc học cho ví của bạn để bảo mật tốt hơn", "Xuất/Nhập tệp CSV"].map((text, i) => <li key={text}><Icon code={["f534", "f030", "f130", "f555", "f234", "f201", "f023", "f019"][i]} />{text}</li>)}</ul><p>VÀ NHIỀU HƠN NỮA...</p><button className="r-text-link" onClick={() => setPayment(true)}>Đổi mã khuyến mãi</button><div className="r-premium-bottom"><div className="r-toggle-row"><span>Kích hoạt bản dùng thử miễn phí</span><Toggle checked={trial} label="Kích hoạt bản dùng thử miễn phí" onChange={setTrial} /></div><b>₫249,000 mỗi năm <small>(20,750/tháng)</small></b><button className="r-premium-continue" onClick={() => setPlans(true)}>Tiếp tục</button><button className="r-text-link" onClick={() => setPlans(true)}>Xem tất cả các kế hoạch</button></div>{plans && <Modal onClose={() => setPlans(false)}><div className="r-plan-list">{[["Hàng tháng", "₫79,000"], ["Hàng năm", "₫249,000"], ["Trọn đời", "₫739,000"]].map(([name, price]) => <button key={name} className={name === selected ? "active" : ""} onClick={() => setSelected(name)}><span><b>{name}</b><small>{price}</small></span>{name === selected ? "✓" : "○"}</button>)}</div><p className="r-center r-small">Đăng ký sẽ tự động gia hạn, bạn có thể hủy bất cứ lúc nào.</p><button className="r-primary" onClick={() => { setPlans(false); setPayment(true); }}>Bắt đầu dùng thử miễn phí ›</button></Modal>}{payment && <Modal title="Rolly Premium" onClose={() => setPayment(false)}><p>Thanh toán và kích hoạt Premium cần thực hiện trên dịch vụ Rolly chính thức.</p><a href="https://app.rollyapp.ai/" target="_blank" rel="noreferrer" className="r-primary">Mở Rolly chính thức</a></Modal>}</div>;
}
