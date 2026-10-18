import type { AppLanguage } from "@/lib/i18n";
const en = {
  title: "International transfers", subtitle: "Compare costs, review the recipient, then approve each step.", eyebrow: "CROSS-BORDER PAYMENTS",
  sandbox: "Payment sandbox", disclaimer: "Practice with fictional schools, fixed example rates and test money. No bank is connected and no real money is sent. Your tracked wallets stay unchanged.",
  bills: "Education bills", history: "Transfer history", newBill: "Add education bill", empty: "No education bills yet", emptyHelp: "Add a test bill to compare routes and try the approval flow.",
  school: "Receiving school", billTitle: "Bill name", amount: "Amount the school receives", due: "Payment due date", reference: "Unique bill reference", referenceHelp: "Use a different reference for each bill or semester to avoid paying the same bill twice.",
  recipient: "Recipient", bank: "Receiving bank", bankCode: "Bank routing code", account: "Receiving account", matched: "Matches the fictional school directory", registryHelp: "These fixed recipients are synthetic test records. This is not real recipient or bank verification.",
  save: "Save bill", cancel: "Cancel", close: "Close", edit: "Edit", archive: "Archive", restore: "Restore", active: "Active", archived: "Archived", all: "All", search: "Search bills", back: "Back to bills",
  compare: "Compare routes", refresh: "Refresh example quotes", cheaper: "Lowest total cost", faster: "Shortest arrival time", preference: "Sort routes by", compareHelp: "Compare the total VND debit, including conversion and every displayed fee. Amount received stays the same across routes.",
  provider: "Route", rate: "Example rate", conversion: "Converted amount", markup: "Currency conversion fee", fee: "Transfer fee", total: "Total test debit", receives: "School receives", eta: "Estimated arrival", days: "calendar days", latest: "Suggested send-by date", deadline: "May arrive too late. The estimate includes one extra safety day; weekends and holidays are not modelled.",
  expires: "Quote expires in", expired: "Quote expired. Refresh quotes and create a new draft.", choose: "Review this option", referenceOnly: "Reference only", unavailableRoute: "This route is unavailable for this test corridor.", bankB: "No test account is available for Bank B. Its lower reference rate cannot be selected.", best: "First eligible option for your selected preference",
  review: "Review transfer", source: "Test source account", available: "Available test balance", opening: "Starting test money", spent: "Completed test transfers", reserve: "Minimum test reserve", after: "Test balance after transfer", insufficient: "This would leave the test account below its minimum reserve. Choose another route or a smaller bill.",
  acknowledgement: "I checked the school, bill reference, amount, fees and arrival estimate. I understand this uses test money.", approve: "Approve this draft", execute: "Complete test transfer", approved: "Approved. Complete the test transfer within 2 minutes, while the quote is still valid.", approvalExpired: "Approval expired. Review and approve again while the quote is valid.", steps: ["1 · Bill", "2 · Compare", "3 · Review & approve", "4 · Test receipt"],
  receipt: "Test transfer receipt", receiptHelp: "The test transfer is complete. No real payment was sent. This bill cannot be completed again.", receiptId: "Receipt ID", planId: "Plan ID", created: "Created", approvedOn: "Approved", completedOn: "Completed", noHistory: "No transfers yet", details: "View details", recent: "Showing the latest 200 plans. All records remain saved in your account.",
  pause: "Pause new transfers", resume: "Resume transfers", paused: "Transfers paused. Existing receipts are kept. Resume and approve again before completing a pending transfer.", controls: "Payment controls", balanceHelp: "Each test account starts with 100,000,000 VND once. Completed test transfers reduce this balance and it stays saved when you sign out.",
  audit: "Activity log", saved: "Saved to your account", loading: "Loading transfers…", retry: "Retry", unknown: "Could not load transfers. Please try again.", processing: "Processing…", duplicate: "A bill with this school and reference already exists. Open that bill or use a new reference.", error: "The request could not be completed. Refresh the page and try again.", prev: "Previous", next: "Next", page: "Page", showArchived: "Include archived bills",
  states: { review: "Awaiting review", approved: "Approved", completed: "Test completed", cancelled: "Cancelled", invalidated: "Needs a new quote" },
  events: { billCreated: "Bill created", billUpdated: "Bill updated", billArchived: "Bill archived", billRestored: "Bill restored", quoted: "Quotes generated", drafted: "Draft created", approved: "Draft approved", completed: "Test transfer completed", cancelled: "Draft cancelled", paused: "Transfers paused", resumed: "Transfers resumed" },
  errors: { QUOTE_EXPIRED: "The quote expired. Refresh quotes and create a new draft.", BILL_CHANGED: "The bill or quote has changed. Reload it and review again.", BILL_OVERDUE: "The bill is overdue. Update its due date before continuing.", ALREADY_COMPLETED: "This bill already has a completed test transfer. View its receipt.", PAUSED: "Transfers are paused. Resume before continuing.", INSUFFICIENT_RESERVE: "The test balance would fall below the minimum reserve.", APPROVAL_REQUIRED: "Review and approve this draft again before completing it.", CHANNEL_UNAVAILABLE: "This route cannot be selected in this sandbox.", DUPLICATE_REFERENCE: "This school and bill reference already exist.", MUTATION_MISMATCH: "This request changed while retrying. Reload and try again.", NOT_FOUND: "This record is unavailable in your account.", UNAUTHENTICATED: "Please sign in again.", WORKSPACE_OWNER_CHANGED: "The signed-in account changed. Reload before continuing.", RATE_LIMITED: "Too many requests. Wait a minute, then try again.", INVALID_COMMAND: "Check the amount, date and required fields.", BILL_LIMIT: "The sandbox supports up to 100 bills per account.", UNAVAILABLE: "The service is unavailable. Check that the database migration has run, then retry." },
};
type Copy = { [K in keyof typeof en]: K extends "steps" ? string[] : K extends "states" | "events" | "errors" ? { [P in keyof typeof en[K]]: string } : string };
const vi: Copy = {
  title: "Chuyển tiền quốc tế", subtitle: "So sánh chi phí, kiểm tra người nhận và xác nhận từng bước.", eyebrow: "THANH TOÁN XUYÊN BIÊN GIỚI",
  sandbox: "Mô phỏng thanh toán", disclaimer: "Trải nghiệm với trường học giả lập, tỷ giá ví dụ cố định và tiền thử nghiệm. Chưa kết nối ngân hàng hay chuyển tiền thật. Số dư ví bạn đang theo dõi không thay đổi.",
  bills: "Hóa đơn giáo dục", history: "Lịch sử chuyển tiền", newBill: "Thêm hóa đơn giáo dục", empty: "Chưa có hóa đơn giáo dục", emptyHelp: "Thêm hóa đơn thử để so sánh các kênh và trải nghiệm luồng xác nhận.",
  school: "Trường nhận tiền", billTitle: "Tên hóa đơn", amount: "Số tiền trường cần nhận", due: "Hạn thanh toán", reference: "Mã hóa đơn riêng biệt", referenceHelp: "Mỗi hóa đơn hoặc học kỳ dùng một mã khác nhau để tránh thanh toán trùng.",
  recipient: "Người nhận", bank: "Ngân hàng nhận", bankCode: "Mã định tuyến ngân hàng", account: "Tài khoản nhận", matched: "Khớp danh bạ trường học giả lập", registryHelp: "Các tài khoản nhận này là dữ liệu thử nghiệm cố định. Đây chưa phải xác minh người nhận hoặc ngân hàng thực tế.",
  save: "Lưu hóa đơn", cancel: "Hủy", close: "Đóng", edit: "Chỉnh sửa", archive: "Lưu trữ", restore: "Khôi phục", active: "Đang áp dụng", archived: "Đã lưu trữ", all: "Tất cả", search: "Tìm hóa đơn", back: "Về danh sách hóa đơn",
  compare: "So sánh kênh", refresh: "Làm mới báo giá ví dụ", cheaper: "Tổng chi phí thấp nhất", faster: "Thời gian nhận ngắn nhất", preference: "Sắp xếp kênh theo", compareHelp: "So sánh tổng VND bị trừ, đã gồm tiền quy đổi và các loại phí bên dưới. Số tiền trường nhận giữ nguyên giữa các kênh.",
  provider: "Kênh chuyển", rate: "Tỷ giá ví dụ", conversion: "Tiền quy đổi", markup: "Phí chuyển đổi tiền tệ", fee: "Phí chuyển tiền", total: "Tổng tiền thử nghiệm bị trừ", receives: "Trường nhận", eta: "Dự kiến nhận tiền", days: "ngày lịch", latest: "Ngày nên gửi trước", deadline: "Có nguy cơ nhận trễ hạn. Ước tính có thêm 1 ngày dự phòng; chưa tính riêng cuối tuần và ngày lễ.",
  expires: "Báo giá còn hiệu lực", expired: "Báo giá đã hết hạn. Hãy làm mới và tạo bản nháp mới.", choose: "Xem lại phương án này", referenceOnly: "Chỉ để tham khảo", unavailableRoute: "Kênh này chưa hỗ trợ tuyến thử nghiệm đang chọn.", bankB: "Chưa có tài khoản thử nghiệm ở Ngân hàng B. Tỷ giá tham khảo thấp hơn không thể chọn để thanh toán.", best: "Phương án khả dụng đầu tiên theo ưu tiên bạn chọn",
  review: "Kiểm tra chuyển tiền", source: "Tài khoản nguồn thử nghiệm", available: "Số dư thử nghiệm có thể dùng", opening: "Tiền thử nghiệm ban đầu", spent: "Đã chuyển trong mô phỏng", reserve: "Mức dự phòng thử nghiệm tối thiểu", after: "Số dư thử nghiệm sau chuyển", insufficient: "Sau chuyển, tài khoản thử nghiệm sẽ dưới mức dự phòng tối thiểu. Hãy chọn kênh khác hoặc giảm số tiền hóa đơn.",
  acknowledgement: "Tôi đã kiểm tra trường nhận, mã hóa đơn, số tiền, phí và thời gian dự kiến. Tôi hiểu đây là tiền thử nghiệm.", approve: "Phê duyệt bản nháp", execute: "Hoàn tất chuyển tiền thử", approved: "Đã phê duyệt. Hãy hoàn tất trong 2 phút, khi báo giá vẫn còn hiệu lực.", approvalExpired: "Phê duyệt đã hết hiệu lực. Hãy kiểm tra và phê duyệt lại khi báo giá còn hạn.", steps: ["1 · Hóa đơn", "2 · So sánh", "3 · Kiểm tra & phê duyệt", "4 · Biên nhận thử"],
  receipt: "Biên nhận chuyển tiền thử", receiptHelp: "Đã hoàn tất mô phỏng. Chưa có tiền thật được gửi đi. Hóa đơn này không thể hoàn tất lần thứ hai.", receiptId: "Mã biên nhận", planId: "Mã kế hoạch", created: "Ngày tạo", approvedOn: "Đã phê duyệt lúc", completedOn: "Đã hoàn tất lúc", noHistory: "Chưa có lịch sử chuyển tiền", details: "Xem chi tiết", recent: "Hiển thị 200 kế hoạch gần nhất. Toàn bộ lịch sử vẫn được lưu trong tài khoản.",
  pause: "Tạm dừng chuyển tiền mới", resume: "Tiếp tục chuyển tiền", paused: "Đã tạm dừng. Biên nhận cũ được giữ lại. Khi tiếp tục, hãy phê duyệt lại trước khi hoàn tất giao dịch đang chờ.", controls: "Kiểm soát thanh toán", balanceHelp: "Mỗi tài khoản thử nghiệm có 100.000.000 VND ban đầu, được cấp một lần. Chuyển tiền thử sẽ trừ số dư này và được lưu cả khi đăng xuất.",
  audit: "Nhật ký hoạt động", saved: "Lưu trong tài khoản", loading: "Đang tải chuyển tiền…", retry: "Thử lại", unknown: "Chưa tải được dữ liệu. Vui lòng thử lại.", processing: "Đang xử lý…", duplicate: "Đã có hóa đơn cùng trường và mã tham chiếu. Hãy mở lại hóa đơn đó hoặc dùng mã mới.", error: "Chưa thực hiện được yêu cầu. Hãy tải lại trang và thử lại.", prev: "Trước", next: "Sau", page: "Trang", showArchived: "Hiện hóa đơn đã lưu trữ",
  states: { review: "Chờ kiểm tra", approved: "Đã phê duyệt", completed: "Đã hoàn tất mô phỏng", cancelled: "Đã hủy", invalidated: "Cần báo giá mới" },
  events: { billCreated: "Đã tạo hóa đơn", billUpdated: "Đã sửa hóa đơn", billArchived: "Đã lưu trữ hóa đơn", billRestored: "Đã khôi phục hóa đơn", quoted: "Đã tạo báo giá", drafted: "Đã tạo bản nháp", approved: "Đã phê duyệt", completed: "Đã hoàn tất chuyển thử", cancelled: "Đã hủy bản nháp", paused: "Đã tạm dừng", resumed: "Đã tiếp tục" },
  errors: { QUOTE_EXPIRED: "Báo giá hết hạn. Hãy làm mới và tạo bản nháp mới.", BILL_CHANGED: "Hóa đơn hoặc báo giá đã thay đổi. Hãy tải lại và kiểm tra lại.", BILL_OVERDUE: "Hóa đơn đã quá hạn. Hãy cập nhật ngày đến hạn để tiếp tục.", ALREADY_COMPLETED: "Hóa đơn đã được chuyển thử. Bạn có thể xem lại biên nhận.", PAUSED: "Đang tạm dừng chuyển tiền. Hãy bật tiếp tục trước.", INSUFFICIENT_RESERVE: "Số dư thử nghiệm sau chuyển sẽ dưới mức dự phòng.", APPROVAL_REQUIRED: "Hãy kiểm tra và phê duyệt lại bản nháp trước khi hoàn tất.", CHANNEL_UNAVAILABLE: "Chưa thể chọn kênh này trong bản mô phỏng.", DUPLICATE_REFERENCE: "Đã có hóa đơn cùng trường và mã tham chiếu.", MUTATION_MISMATCH: "Nội dung yêu cầu đã thay đổi khi thử lại. Hãy tải lại trang.", NOT_FOUND: "Không tìm thấy bản ghi trong tài khoản của bạn.", UNAUTHENTICATED: "Vui lòng đăng nhập lại.", WORKSPACE_OWNER_CHANGED: "Tài khoản đăng nhập đã đổi. Hãy tải lại trước khi tiếp tục.", RATE_LIMITED: "Bạn thao tác quá nhanh. Hãy đợi một phút rồi thử lại.", INVALID_COMMAND: "Hãy kiểm tra số tiền, ngày và các ô bắt buộc.", BILL_LIMIT: "Mỗi tài khoản thử nghiệm hỗ trợ tối đa 100 hóa đơn.", UNAVAILABLE: "Dịch vụ chưa sẵn sàng. Hãy kiểm tra đã chạy migration database rồi thử lại." },
};
const zh: Copy = {
  title: "国际汇款", subtitle: "比较费用，核对收款人，并逐步确认。", eyebrow: "跨境支付",
  sandbox: "支付模拟", disclaimer: "使用虚构学校、固定示例汇率和测试资金。未连接银行，不会发送真实资金，也不改变您记录的钱包余额。",
  bills: "教育账单", history: "汇款记录", newBill: "添加教育账单", empty: "暂无教育账单", emptyHelp: "添加测试账单，比较渠道并体验审批流程。",
  school: "收款学校", billTitle: "账单名称", amount: "学校应收金额", due: "付款截止日期", reference: "唯一账单编号", referenceHelp: "每张账单或每个学期使用不同编号，以避免重复付款。",
  recipient: "收款人", bank: "收款银行", bankCode: "银行路由代码", account: "收款账号", matched: "与虚构学校目录匹配", registryHelp: "这些收款信息是固定的测试数据，不代表真实的收款人或银行验证。",
  save: "保存账单", cancel: "取消", close: "关闭", edit: "编辑", archive: "归档", restore: "恢复", active: "有效", archived: "已归档", all: "全部", search: "搜索账单", back: "返回账单列表",
  compare: "比较渠道", refresh: "刷新示例报价", cheaper: "总费用最低", faster: "预计到账最快", preference: "渠道排序", compareHelp: "比较包含兑换金额及以下全部费用的 VND 扣款总额。各渠道的学校应收金额相同。",
  provider: "汇款渠道", rate: "示例汇率", conversion: "兑换金额", markup: "货币兑换费", fee: "汇款手续费", total: "测试扣款总额", receives: "学校应收", eta: "预计到账", days: "自然日", latest: "建议最晚发送日期", deadline: "可能延迟到账。估算包含一天缓冲，但未单独计算周末和节假日。",
  expires: "报价剩余有效时间", expired: "报价已过期，请刷新报价并重新创建草稿。", choose: "检查此方案", referenceOnly: "仅供参考", unavailableRoute: "此测试路线暂不支持该渠道。", bankB: "没有银行 B 的测试账户，无法选择其较低的参考汇率付款。", best: "按所选偏好排序的首个可用方案",
  review: "核对汇款", source: "测试付款账户", available: "可用测试余额", opening: "初始测试资金", spent: "已完成的测试汇款", reserve: "最低测试储备金", after: "汇款后测试余额", insufficient: "汇款后测试账户将低于最低储备金，请选择其他渠道或降低账单金额。",
  acknowledgement: "我已核对学校、账单编号、金额、费用及预计到账时间，并了解此操作使用测试资金。", approve: "批准草稿", execute: "完成测试汇款", approved: "已批准，请在两分钟内且报价有效期间完成测试汇款。", approvalExpired: "批准已过期，请在报价仍有效时重新核对并批准。", steps: ["1 · 账单", "2 · 比较", "3 · 核对与批准", "4 · 测试回执"],
  receipt: "测试汇款回执", receiptHelp: "模拟已完成，未发送真实资金。此账单不能再次完成。", receiptId: "回执编号", planId: "计划编号", created: "创建时间", approvedOn: "批准时间", completedOn: "完成时间", noHistory: "暂无汇款记录", details: "查看详情", recent: "显示最近 200 个计划，全部记录仍保存在您的账户中。",
  pause: "暂停新汇款", resume: "恢复汇款", paused: "汇款已暂停，现有回执保留。恢复后需重新批准待处理汇款。", controls: "付款控制", balanceHelp: "每个测试账户仅首次获得 100,000,000 VND。测试汇款会减少余额，退出登录后余额仍保留。",
  audit: "操作日志", saved: "已保存到账户", loading: "正在加载汇款…", retry: "重试", unknown: "加载失败，请重试。", processing: "正在处理…", duplicate: "该学校的账单编号已存在，请打开现有账单或使用新编号。", error: "无法完成请求，请刷新后重试。", prev: "上一页", next: "下一页", page: "页", showArchived: "包含已归档账单",
  states: { review: "待核对", approved: "已批准", completed: "测试已完成", cancelled: "已取消", invalidated: "需要新报价" },
  events: { billCreated: "已创建账单", billUpdated: "已更新账单", billArchived: "已归档账单", billRestored: "已恢复账单", quoted: "已生成报价", drafted: "已创建草稿", approved: "已批准草稿", completed: "已完成测试汇款", cancelled: "已取消草稿", paused: "已暂停汇款", resumed: "已恢复汇款" },
  errors: { QUOTE_EXPIRED: "报价已过期，请刷新并重新创建草稿。", BILL_CHANGED: "账单或报价已更改，请重新加载并核对。", BILL_OVERDUE: "账单已逾期，请更新截止日期。", ALREADY_COMPLETED: "此账单的测试汇款已完成，请查看回执。", PAUSED: "汇款已暂停，请先恢复。", INSUFFICIENT_RESERVE: "汇款后的测试余额将低于最低储备金。", APPROVAL_REQUIRED: "请重新核对并批准草稿后再完成。", CHANNEL_UNAVAILABLE: "模拟环境中无法选择此渠道。", DUPLICATE_REFERENCE: "该学校的账单编号已存在。", MUTATION_MISMATCH: "重试时请求内容已更改，请刷新页面。", NOT_FOUND: "您的账户中找不到此记录。", UNAUTHENTICATED: "请重新登录。", WORKSPACE_OWNER_CHANGED: "登录账户已更改，请重新加载。", RATE_LIMITED: "操作过于频繁，请等待一分钟后重试。", INVALID_COMMAND: "请检查金额、日期和必填字段。", BILL_LIMIT: "每个测试账户最多支持 100 张账单。", UNAVAILABLE: "服务不可用，请检查数据库迁移后重试。" },
};
export const TRANSFER_COPY: Record<AppLanguage, Copy> = { en, vi, zh };
export const TRANSFER_VIEW_COPY = {
  en: {
    pending: "Not transferred", completed: "Transferred", history: "Activity history",
    pendingHelp: "Bills without a completed test transfer. Review and approve a transfer before completing it.",
    completedHelp: "Only completed test transfers with a receipt appear here. Amounts shown are the total test debit, including fees.",
    historyHelp: "A record of actions such as creating a draft, approving, cancelling or completing it. An action here does not mean money was transferred.",
    search: "Search this list", more: "Show more", collapse: "Show less", showing: "Showing", of: "of",
    emptyPending: "No bills waiting for transfer", emptyCompleted: "No completed transfers yet", emptyHistory: "No activity yet", noMatches: "No matching results",
    related: "View related item", historyLimit: "Up to 200 recent actions are shown. Completed receipts remain available under Transferred.",
    continueReview: "Continue review", expired: "Quote expired", approvalExpired: "Approval expired", recorded: "Action recorded", transferred: "Test transfer completed",
  },
  vi: {
    pending: "Chưa chuyển", completed: "Đã chuyển", history: "Lịch sử thao tác",
    pendingHelp: "Các hóa đơn chưa có giao dịch chuyển thử hoàn tất. Bạn cần kiểm tra và phê duyệt trước khi hoàn tất chuyển tiền.",
    completedHelp: "Chỉ hiển thị giao dịch chuyển thử đã hoàn tất và có biên nhận. Số tiền hiển thị là tổng tiền thử nghiệm bị trừ, đã gồm phí.",
    historyHelp: "Ghi lại các thao tác như tạo bản nháp, phê duyệt, hủy hoặc hoàn tất. Có thao tác ở đây chưa có nghĩa là đã chuyển tiền.",
    search: "Tìm trong danh sách này", more: "Xem thêm", collapse: "Thu gọn", showing: "Đang hiển thị", of: "/",
    emptyPending: "Không có hóa đơn chờ chuyển", emptyCompleted: "Chưa có giao dịch chuyển hoàn tất", emptyHistory: "Chưa có thao tác nào", noMatches: "Không có kết quả phù hợp",
    related: "Xem mục liên quan", historyLimit: "Hiển thị tối đa 200 thao tác gần nhất. Biên nhận hoàn tất vẫn được lưu trong mục Đã chuyển.",
    continueReview: "Tiếp tục kiểm tra", expired: "Báo giá đã hết hạn", approvalExpired: "Phê duyệt đã hết hạn", recorded: "Đã ghi nhận thao tác", transferred: "Đã chuyển thử thành công",
  },
  zh: {
    pending: "待汇款", completed: "已汇款", history: "操作记录",
    pendingHelp: "尚未完成测试汇款的账单。请先核对并批准，再完成汇款。",
    completedHelp: "仅显示已完成且有回执的测试汇款。所示金额为含手续费的测试扣款总额。",
    historyHelp: "记录创建草稿、批准、取消及完成等操作。出现操作记录并不代表已汇款。",
    search: "搜索当前列表", more: "查看更多", collapse: "收起", showing: "显示", of: "/",
    emptyPending: "暂无待汇款账单", emptyCompleted: "暂无已完成汇款", emptyHistory: "暂无操作记录", noMatches: "没有匹配结果",
    related: "查看相关项目", historyLimit: "最多显示最近 200 次操作，已完成回执仍可在已汇款中查看。",
    continueReview: "继续核对", expired: "报价已过期", approvalExpired: "批准已过期", recorded: "已记录操作", transferred: "测试汇款成功",
  },
};
export function transferProviderName(id: string, lang: AppLanguage) {
  if (id === "ALIPAY") return lang === "vi" ? "Alipay giáo dục · giả lập" : lang === "zh" ? "Alipay 教育 · 模拟" : "Alipay Education · simulated";
  if (id === "BANK_A") return lang === "vi" ? "Ngân hàng A · giả lập" : lang === "zh" ? "银行 A · 模拟" : "Bank A · simulated";
  return lang === "vi" ? "Ngân hàng B · tham khảo" : lang === "zh" ? "银行 B · 参考" : "Bank B · reference";
}
