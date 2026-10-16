"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Ban, CalendarDays, Check, ChevronDown, FolderTree, Info, Lock, Pencil, Plus, ReceiptText, RotateCcw, Search, Settings, SlidersHorizontal, Trash2, Wallet, X } from "lucide-react";
import { EmptyState, Icon, Modal } from "./Ui";
import { money, updateState, useAppState, type Transaction, type Wallet as WalletType } from "./store";
import { categoryIcon, iconGroups } from "./Categories";
import { calendarWeek, localDateKey, shiftCalendarWeek } from "./chartWeek";
import { WalletSettingsDirectory } from "./SettingsOverview";
import { CalendarLedgerModal } from "./CalendarLedgerModal";
import { FinBridgeHeader } from "./FinBridgeHeader";
import { FinancialOutlook } from "./FinancialOutlook";
import { resolveLanguage, resolveWalletDisplayName, isSentinelWalletName, resolveCategoryDisplayName } from "@/lib/i18n";

type DashboardSample = {
  id: string;
  date: string;
  type: "expense" | "income" | "transfer";
  amount: number;
  category: string;
  currency: string;
  title?: string;
  wallet?: string;
  targetWallet?: string;
  note?: string;
};

export const DASHBOARD_SAMPLE: DashboardSample[] = [
  // Tháng 7 (15/07 - 31/07)
  { id: "sample-01", date: "2026-07-16", type: "expense", amount: 700000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Phí thường niên thẻ thanh toán" },
  { id: "sample-02", date: "2026-07-18", type: "expense", amount: 920000, category: "Ăn uống", currency: "VND", title: "Siêu thị thực phẩm tuần" },
  { id: "sample-03", date: "2026-07-24", type: "expense", amount: 165000, category: "Di chuyển", currency: "VND", title: "Grab Car di chuyển công tác" },
  { id: "sample-04", date: "2026-07-28", type: "expense", amount: 450000, category: "Ăn uống", currency: "VND", title: "Ăn tối họp mặt bạn bè" },

  // Tháng 8 (01/08 - 31/08)
  { id: "sample-05", date: "2026-08-02", type: "expense", amount: 65000, category: "Ăn uống", currency: "VND", title: "Cà phê sáng Highlands" },
  { id: "sample-06", date: "2026-08-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 7 - Công ty FinBridge" },
  { id: "sample-07", date: "2026-08-08", type: "expense", amount: 380000, category: "Di chuyển", currency: "VND", title: "Bảo dưỡng & thay dầu xe máy" },
  { id: "sample-08", date: "2026-08-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 8" },
  { id: "sample-09", date: "2026-08-15", type: "expense", amount: 1650000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Điện nước & Internet FPT T8" },
  { id: "sample-10", date: "2026-08-18", type: "expense", amount: 780000, category: "Ăn uống", currency: "VND", title: "Ăn tối nhà hàng Pizza 4P's" },
  { id: "sample-11", date: "2026-08-20", type: "income", amount: 2500000, category: "Thu nhập", currency: "VND", title: "Thưởng hoàn thành dự án Q2" },
  { id: "sample-12", date: "2026-08-22", type: "expense", amount: 1450000, category: "Mua sắm", currency: "VND", title: "Giày chạy bộ rèn luyện sức khỏe" },
  { id: "sample-13", date: "2026-08-25", type: "transfer", amount: 5000000, category: "Chuyển khoản nội bộ", currency: "VND", title: "Trích tiết kiệm tích lũy sang ví phụ" },
  { id: "sample-14", date: "2026-08-28", type: "expense", amount: 960000, category: "Ăn uống", currency: "VND", title: "Siêu thị Co.opmart thực phẩm" },

  // Tháng 9 (01/09 - 30/09)
  { id: "sample-15", date: "2026-09-02", type: "expense", amount: 280000, category: "Giải trí", currency: "VND", title: "Vé xem phim CGV cuối tuần" },
  { id: "sample-16", date: "2026-09-04", type: "expense", amount: 4500000, category: "Mua sắm", currency: "VND", title: "Khóa học phân tích dữ liệu nâng cao" },
  { id: "sample-17", date: "2026-09-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 8 - Công ty FinBridge" },
  { id: "sample-18", date: "2026-09-08", type: "expense", amount: 120000, category: "Di chuyển", currency: "VND", title: "Đổ xăng xe máy Petrolimex" },
  { id: "sample-19", date: "2026-09-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 9" },
  { id: "sample-20", date: "2026-09-15", type: "expense", amount: 1720000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Điện nước & Internet FPT T9" },
  { id: "sample-21", date: "2026-09-18", type: "expense", amount: 3200000, category: "Mua sắm", currency: "VND", title: "Bàn làm việc công thái học" },
  { id: "sample-22", date: "2026-09-19", type: "expense", amount: 880000, category: "Ăn uống", currency: "VND", title: "Siêu thị WinMart thực phẩm tươi" },
  { id: "sample-23", date: "2026-09-22", type: "expense", amount: 1850000, category: "Mua sắm", currency: "VND", title: "Nồi cơm điện tử cao cấp" },
  { id: "sample-24", date: "2026-09-24", type: "expense", amount: -480000, category: "Mua sắm", currency: "VND", title: "Hoàn tiền đơn hàng Shopee bị hủy" },
  { id: "sample-25", date: "2026-09-27", type: "expense", amount: 320000, category: "Mua sắm", currency: "VND", title: "Sách tài chính & đầu tư" },
  { id: "sample-26", date: "2026-09-29", type: "expense", amount: 95000, category: "Ăn uống", currency: "VND", title: "Cơm trưa văn phòng" },

  // Tháng 10 (01/10 - 12/10)
  { id: "sample-27", date: "2026-10-02", type: "expense", amount: 145000, category: "Ăn uống", currency: "VND", title: "Cà phê trao đổi đối tác" },
  { id: "sample-28", date: "2026-10-05", type: "income", amount: 20000000, category: "Lương", currency: "VND", title: "Lương tháng 9 - Công ty FinBridge" },
  { id: "sample-29", date: "2026-10-08", type: "expense", amount: 1050000, category: "Ăn uống", currency: "VND", title: "Siêu thị Tops Market cuối tuần" },
  { id: "sample-30", date: "2026-10-10", type: "expense", amount: 7500000, category: "Nhà ở", currency: "VND", title: "Tiền thuê căn hộ tháng 10" },
  { id: "sample-31", date: "2026-10-11", type: "expense", amount: 250000, category: "Hóa đơn & Tiện ích", currency: "VND", title: "Gói cước di động 4G Viettel" },
];

export const DASHBOARD_I18N = {
  vi: {
    overviewEyebrow: "TỔNG QUAN",
    welcomePrefix: "Chào ",
    defaultGreeting: "Tiền của bạn, trong tầm tay.",
    introSub: "Theo dõi dòng tiền. Chủ động cho những kế hoạch tiếp theo.",
    addTransaction: "Thêm giao dịch",
    yourWallets: "Ví của bạn",
    activeWalletsSuffix: "ví hoạt động",
    unlinkedSuffix: "đã hủy liên kết",
    unlinkedChip: (count: number) => `Đã hủy (${count})`,
    addWallet: "Thêm ví",
    flowThisPeriod: "Dòng tiền trong kỳ",
    flowSub: "Tổng hợp từ tất cả ví đã tích hợp",
    totalIncome: "Tổng thu",
    totalExpense: "Tổng chi",
    fromAllWalletsInPeriod: "Từ mọi ví trong kỳ",
    currencyNote: "Tiền tệ được hiển thị riêng, không quy đổi tỷ giá.",
    details: "Chi tiết",
    walletFlowTitle: "Chi & thu theo ví",
    walletFlowSub: "Số liệu của từng ví đã tích hợp trong kỳ",
    manageWallets: "Quản lý ví",
    expShort: "Chi ",
    incShort: "Thu ",
    mainWallet: "Ví chính",
    netChange: "Thay đổi ròng",
    cost: "Chi phí",
    income: "Thu nhập",
    txThisPeriod: "Giao dịch trong kỳ",
    selectedWalletBalance: "Số dư ví đã chọn",
    habitEyebrow: "MỖI NGÀY MỘT CHÚT",
    habitTitle: "Hiểu tiền của mình hơn.",
    habitSub: "Ghi lại các khoản thu và chi để có một bức tranh rõ ràng hơn.",
    viewTransactionsAction: "Xem giao dịch",
    periodDay: "Ngày",
    periodWeek: "Tuần",
    periodMonth: "Tháng",
    periodYear: "Năm",
    periodAllTime: "Mọi thời gian",
    periodCustomRange: "Phạm vi tùy chỉnh",
    formatMonthYear: (m: number, y: number) => `tháng ${m + 1} năm ${y}`,
    formatYearOnly: (y: number) => `Năm ${y}`,
    cardTitle: "Xu hướng chi tiêu",
    cardSubtitle: "Theo dõi thu, chi và dòng tiền theo thời gian",
    viewTransactions: "Xem giao dịch",
    periodLabel: "Khoảng thời gian",
    selectWeek: "Chọn ngày trong tuần",
    previousWeek: "Tuần trước",
    nextWeek: "Tuần sau",
    currentWeek: "Tuần hiện tại",
    period7d: "7 ngày",
    period30d: "30 ngày",
    period90d: "90 ngày",
    periodAll: "Toàn bộ dữ liệu",
    periodCustom: "Phạm vi tùy chỉnh",
    fromDate: "Từ ngày",
    toDate: "Đến ngày",
    typeFilter: "Lọc loại giao dịch",
    typeAll: "Tất cả",
    typeExpense: "Chi",
    typeIncome: "Thu",
    categoryFilter: "Lọc danh mục",
    allCategories: "Tất cả danh mục",
    accountFilter: "Chọn tài khoản",
    allAccounts: "Tất cả ví",
    currencyFilter: "Chọn tiền tệ",
    simulated: "Mô phỏng",
    emptyText: "Chưa có dữ liệu phù hợp với bộ lọc này.",
    resetFilters: "Đặt lại bộ lọc",
    summaryIncome: "Thu",
    summaryExpense: "Chi",
    summaryNet: "Ròng",
    summaryTransactions: "giao dịch",
    tooltipPeriod: "Kỳ",
    tooltipCount: "Số GD",
    tableCaption: "Bảng dữ liệu dòng tiền theo thời gian",
    tableColPeriod: "Kỳ",
    tableColIncome: "Thu nhập",
    tableColExpense: "Chi phí",
    tableColNet: "Ròng",
    tableColCount: "Giao dịch",

    // F2: Add Wallet Modal
    addWalletModalTitle: "Thêm ví mới",
    addWalletDesc: "Tạo ví để phân bổ tài chính và quản lý dòng tiền chi tiết.",
    walletTypeLabel: "Loại ví",
    walletTypeCash: "Tiền mặt",
    walletTypeCredit: "Thẻ tín dụng",
    walletNameLabel: "Tên ví",
    walletNamePlaceholder: "Ví dụ: Ví tiêu dùng, Techcombank, VIB...",
    walletCurrencyLabel: "Đơn vị tiền tệ",
    initialBalanceLabel: "Số dư ban đầu",
    unsettledBalanceLabel: "Số dư chưa thanh toán",
    creditLimitLabel: "Hạn mức tín dụng",
    creditLimitPlaceholder: "Ví dụ: 50,000,000",
    cancel: "Hủy",
    saveWallet: "Lưu ví",
    currencyOptions: {
      VND: "VND (Việt Nam Đồng)",
      USD: "USD (Đô la Mỹ)",
      EUR: "EUR (Euro)",
      JPY: "JPY (Yên Nhật)",
      SGD: "SGD (Đô la Singapore)",
      GBP: "GBP (Bảng Anh)",
      AUD: "AUD (Đô la Úc)",
    },
    currencyOptionsList: [
      { code: "VND", label: "VND (Việt Nam Đồng)" },
      { code: "USD", label: "USD (Đô la Mỹ)" },
      { code: "EUR", label: "EUR (Euro)" },
      { code: "JPY", label: "JPY (Yên Nhật)" },
      { code: "SGD", label: "SGD (Đô la Singapore)" },
      { code: "GBP", label: "GBP (Bảng Anh)" },
      { code: "AUD", label: "AUD (Đô la Úc)" },
    ],

    // F4: Wallet Selectors & Action Aria-labels
    selectWalletModalTitle: "Chọn ví",
    selectWalletAria: (name: string) => `Chọn ví ${name}`,
    manageWalletAria: (name: string) => `Quản lý ví ${name}`,

    // F3: Manage Wallet - Details Tab
    manageWalletModalTitle: (name: string) => `Quản lý ví: ${name}`,
    walletInfoTab: "Thông tin ví",
    categoryManagerTab: "Quản lý danh mục",
    walletArchivedBannerTitle: "Ví đang ở trạng thái hủy liên kết (đã lưu trữ)",
    walletArchivedBannerDesc: "Ví này bị ẩn khỏi mục chọn khi tạo giao dịch mới, nhưng tất cả lịch sử giao dịch vẫn được giữ nguyên.",
    currencyUnitLabel: "Đơn vị tiền tệ",
    lockedBadge: "Đã khóa (đã phát sinh giao dịch)",
    lockedCurrencyHelper: "Không thể đổi tiền tệ khi đã có giao dịch để tránh xung đột tỷ giá và dữ liệu lịch sử.",
    initialBalanceLabelCredit: "Số dư chưa thanh toán ban đầu",
    initialBalanceLabelCash: "Số dư ban đầu",
    lockedInitialBalanceHelperPrefix: "Số dư ban đầu được cố định để bảo toàn tính toàn vẹn của sổ sách. Để cập nhật số dư theo tài khoản ngân hàng thực tế, vui lòng sử dụng tính năng ",
    lockedInitialBalanceHelperHighlight: "Điều chỉnh số dư thực tế",
    lockedInitialBalanceHelperSuffix: " bên dưới.",
    unlockedInitialBalanceHelper: "Ví chưa có giao dịch nào, bạn có thể tự do điều chỉnh số dư ban đầu.",
    closeButton: "Đóng",
    saveChangesButton: "Lưu thay đổi",

    // F3: Manage Wallet - Reconcile Box
    reconcileCardTitle: "Khớp số dư thực tế",
    reconcileCurrentBookPrefix: "Số dư sổ sách hiện tại: ",
    reconcileCurrentBookSuffix: ". Nếu không khớp với thực tế ngoài đời, hãy nhập số dư thực tế để hệ thống tự động bù trừ.",
    reconcileTriggerButton: "Điều chỉnh số dư thực tế",
    reconcileActualBalanceLabel: (curr: string) => `Số dư thực tế trong ví / tài khoản ngân hàng (${curr})`,
    reconcileActualBalancePlaceholder: "Nhập số dư thực tế hiện tại",
    cancelButton: "Hủy",
    confirmAdjustmentButton: "Xác nhận điều chỉnh",
    reconcileTxTitleIncrease: "Điều chỉnh tăng số dư thực tế",
    reconcileTxTitleDecrease: "Điều chỉnh giảm số dư thực tế",
    reconcileTxCategory: "Điều chỉnh số dư",
    reconcileTxNoteTemplate: (fromBal: string, toBal: string) => `Khớp số dư thực tế từ ${fromBal} sang ${toBal}`,

    // F3: Manage Wallet - Danger Zone
    dangerZoneHeader: "Thao tác bảo mật ví",
    dangerZoneDescArchived: "Ví này hiện đang bị hủy liên kết. Bạn có thể khôi phục để tiếp tục ghi chép giao dịch.",
    dangerZoneDescHasTxs: (count: number) => `Ví này đã ghi nhận ${count} giao dịch. Hệ thống sẽ áp dụng chính sách xóa mềm (Hủy liên kết): ví sẽ bị ẩn nhưng ${count} giao dịch lịch sử vẫn được bảo toàn nguyên vẹn.`,
    dangerZoneDescNoTxs: "Ví này chưa có giao dịch nào. Bạn có thể xóa vĩnh viễn ví khỏi hệ thống.",
    reactivateWalletBtn: "Kích hoạt lại ví này",
    unlinkWalletBtn: "Hủy liên kết ví (Lưu trữ)",
    deleteWalletPermanentBtn: "Xóa vĩnh viễn ví này",
    minOneActiveWalletAlert: "Hệ thống cần ít nhất 1 ví hoạt động. Bạn không thể hủy liên kết ví duy nhất này.",
    deleteWalletConfirmNoTxs: (name: string) => `Ví "${name}" chưa có giao dịch nào. Bạn có chắc chắn muốn xóa vĩnh viễn ví này?`,
    archiveWalletConfirmHasTxs: (name: string, count: number) => `Ví "${name}" đã có ${count} giao dịch. Ví sẽ được chuyển sang trạng thái "Đã hủy liên kết" và ẩn khỏi màn hình thêm giao dịch. Tất cả ${count} giao dịch trước đây vẫn được lưu trữ an toàn. Bạn có muốn tiếp tục?`,

    // F3: Manage Wallet - Category Manager
    catTabExpense: "Danh mục Chi phí",
    catTabIncome: "Danh mục Thu nhập",
    catChooseIconTooltip: "Bấm để chọn biểu tượng cho danh mục",
    catInputPlaceholderExpense: "Nhập tên danh mục chi tiêu mới...",
    catInputPlaceholderIncome: "Nhập tên danh mục thu nhập mới...",
    catAddButton: "Thêm",
    emojiPickerHeaderFor: (targetName: string) => `Chọn biểu tượng cho "${targetName}"`,
    emojiPickerHeaderNewCategory: "Chọn biểu tượng cho danh mục mới",
    emojiPickerCloseAriaLabel: "Đóng bảng icon",
    emojiGroupNames: {
      "Nhà & Hóa đơn": "Nhà & Hóa đơn",
      "Đồ ăn & Đồ uống": "Đồ ăn & Đồ uống",
      "Giao thông vận tải & Du lịch": "Giao thông vận tải & Du lịch",
      "Sức khỏe & Chăm sóc cá nhân": "Sức khỏe & Chăm sóc cá nhân",
      "Điện tử & Công nghệ": "Điện tử & Công nghệ",
      "Tiền bạc và công việc": "Tiền bạc và công việc",
      "Vui chơi & Giải trí": "Vui chơi & Giải trí",
      "Gia đình & Giáo dục": "Gia đình & Giáo dục",
      "Khác": "Khác",
    },
    catEditIconTitle: "Chọn biểu tượng",
    catEditSaveTitle: "Lưu thay đổi",
    catEditCancelTitle: "Hủy",
    catTxCountBadge: (count: number) => `${count} giao dịch`,
    catArchivedTag: "Đã ẩn",
    catEditTooltip: (name: string) => `Sửa danh mục ${name}`,
    catDeleteTooltip: (name: string) => `Xóa hoặc ẩn danh mục ${name}`,
    catRestoreTooltip: (name: string) => `Khôi phục danh mục ${name}`,
    catRestoreBtnText: "Khôi phục",
    catReassignDeleteTooltip: (count: number) => `Chuyển ${count} giao dịch về "Chưa được phân loại" và xóa vĩnh viễn`,
    uncategorizedCategory: "Chưa được phân loại",
    catNameExistsAlert: "Tên danh mục này đã tồn tại.",
    catCannotDeleteSystemDefaultAlert: "Không thể xóa danh mục mặc định của hệ thống.",
    catReactivateConfirm: (name: string) => `Bạn muốn kích hoạt lại danh mục "${name}"?`,
    catDeleteConfirmNoTxs: (name: string) => `Danh mục "${name}" chưa có giao dịch nào. Bạn có chắc chắn muốn xóa vĩnh viễn?`,
    catSoftDeleteConfirmHasTxs: (name: string, count: number) => `Danh mục "${name}" đang được ghi nhận trong ${count} giao dịch.\n\n• Chọn [OK]: Ẩn danh mục (Xóa mềm - ẩn khỏi danh sách chọn khi tạo giao dịch mới nhưng bảo toàn 100% dữ liệu lịch sử).\n• Chọn [Cancel]: Giữ nguyên danh mục.`,
    catReassignDeleteConfirm: (name: string, count: number) => `Chuyển tất cả ${count} giao dịch của danh mục "${name}" về danh mục "Chưa được phân loại" và xóa vĩnh viễn "${name}" khỏi hệ thống?`,

    // F5: Date Pickers & Period Selection
    formatDayPeriod: (dayStr: string) => `ngày ${dayStr}`,
    formatWeekPeriod: (fromStr: string, toStr: string) => `tuần ${fromStr} – ${toStr}`,
    allTimePeriod: "toàn thời gian",
    selectDetailedTimeAria: "Chọn thời gian chi tiết",
    periodModalTitle: "Chọn khoảng thời gian",
    pickDayModalTitle: "Chọn ngày",
    pickDayDesc: "Chọn ngày để theo dõi thu chi trong ngày cụ thể.",
    pickDayLabel: "Chọn ngày",
    today: "Hôm nay",
    yesterday: "Hôm qua",
    selectedDayLabel: "Ngày được chọn:",
    confirmButton: "Xác nhận",
    pickWeekModalTitle: "Chọn tuần",
    pickWeekDesc: "Chọn tuần để theo dõi dòng tiền trong chu kỳ 7 ngày (Thứ 2 – Chủ nhật).",
    pickWeekOrChooseDate: "Hoặc chọn một ngày bất kỳ trong tuần",
    thisWeek: "Tuần này",
    previousYearAria: "Năm trước",
    nextYearAria: "Năm sau",
    pickMonthModalTitle: "Chọn tháng",
    monthNamesShort: ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"],
    selectedMonthLabel: "Tháng đã chọn:",
    pickYearModalTitle: "Chọn năm",
    pickYearDesc: "Chọn năm để xem tổng kết tài chính cả năm.",
    pickCustomRangeModalTitle: "Chọn khoảng thời gian",
    pickCustomRangeDesc: "Tùy chọn khoảng thời gian từ ngày đến ngày.",
    period7dPast: "7 ngày qua",
    period30dPast: "30 ngày qua",
    thisMonth: "Tháng này",
    rangePreviewLabel: "Khoảng thời gian:",
    applyButton: "Áp dụng",

    // F5: Flow Analysis Modals & SvgDonut
    flowIncomeModalTitle: "Chi tiết các khoản thu",
    flowExpenseModalTitle: "Chi tiết các khoản chi",
    flowComparisonModalTitle: "Phân tích Thu & Chi trong kỳ",
    periodPrefix: "Kỳ: ",
    emptyIncomeTitle: "Chưa có khoản thu nào trong kỳ này",
    emptyIncomeDesc: (period: string) => `Các giao dịch thu nhập trong ${period} sẽ hiển thị tại đây.`,
    addIncomeTxBtn: "Thêm giao dịch thu",
    emptyExpenseTitle: "Chưa có khoản chi nào trong kỳ này",
    emptyExpenseDesc: (period: string) => `Các giao dịch chi tiêu trong ${period} sẽ hiển thị tại đây.`,
    addExpenseTxBtn: "Thêm giao dịch chi",
    totalIncomeWithPeriod: (period: string) => `Tổng thu (${period})`,
    totalExpenseWithPeriod: (period: string) => `Tổng chi (${period})`,
    donutCurrencySwitcherLabel: "Đơn vị tiền tệ hiển thị biểu đồ:",
    donutIncomeBreakdown: "Cơ cấu Thu nhập",
    donutExpenseBreakdown: "Cơ cấu Chi tiêu",
    donutTotalIncome: "Tổng thu",
    donutTotalExpense: "Tổng chi",
    donutNoIncomeTx: "Chưa có giao dịch thu trong kỳ này",
    donutNoExpenseTx: "Chưa có giao dịch chi trong kỳ này",
    unlinkedTag: " (Đã hủy liên kết)",

    // F5 & F6: Quick Search, Workspace & Overviews
    transactionsHeading: "Giao dịch",
    searchTransactionsAria: "Tìm kiếm giao dịch",
    calendarAria: "Lịch giao dịch",
    searchModalTitle: "Tìm kiếm giao dịch",
    searchPlaceholder: "Tìm kiếm giao dịch...",
    searchButton: "Tìm kiếm",
    clearSearchButton: "Xóa tìm kiếm",
    noMatchingTransactions: "Không tìm thấy giao dịch",
    noMatchingTransactionsHint: "Không có giao dịch nào khớp với từ khóa tìm kiếm.",
    emptyTransactionsPeriodTitle: "Chưa có giao dịch trong kỳ này.",
    emptyTransactionsPeriodText: "Nhấn + để thêm giao dịch.",
    noExpensesThisPeriod: "Chưa có khoản chi trong kỳ này",
    noIncomesThisPeriod: "Chưa có khoản thu trong kỳ này",
    recordTxToTrackFlow: "Ghi lại một giao dịch để bắt đầu theo dõi dòng tiền.",
    archivedWalletSuffix: " (Đã hủy liên kết)",
    homeTotalsModalTitle: "Tổng dòng tiền",
    totalAllWalletsBalance: "Tổng số dư tất cả ví",
    totalExpenseFromWallets: "Tổng chi từ các ví",
    totalIncomeFromWallets: "Tổng thu từ các ví",
    totalsModalTitle: "Tổng quan thu chi",
    transfer: "Chuyển khoản",
    totalSum: "Tổng cộng",
    viewCashFlowDetailsAria: "Xem chi tiết dòng tiền",
  },
  en: {
    overviewEyebrow: "OVERVIEW",
    welcomePrefix: "Welcome, ",
    defaultGreeting: "Your money, in your hands.",
    introSub: "Track cash flow. Plan ahead with confidence.",
    addTransaction: "Add transaction",
    yourWallets: "Your wallets",
    activeWalletsSuffix: "active wallet",
    unlinkedSuffix: "unlinked",
    unlinkedChip: (count: number) => `Unlinked (${count})`,
    addWallet: "Add wallet",
    flowThisPeriod: "Cash flow this period",
    flowSub: "Aggregated across all integrated wallets",
    totalIncome: "Total income",
    totalExpense: "Total expense",
    fromAllWalletsInPeriod: "From all wallets this period",
    currencyNote: "Currencies are shown separately without exchange rate conversion.",
    details: "Details",
    walletFlowTitle: "Income & expense by wallet",
    walletFlowSub: "Data for each integrated wallet this period",
    manageWallets: "Manage wallets",
    expShort: "Exp ",
    incShort: "Inc ",
    mainWallet: "Main wallet",
    netChange: "Net change",
    cost: "Expense",
    income: "Income",
    txThisPeriod: "Transactions this period",
    selectedWalletBalance: "Selected wallet balance",
    habitEyebrow: "LITTLE BY LITTLE",
    habitTitle: "Understand your money better.",
    habitSub: "Record income and expenses for a clearer financial picture.",
    viewTransactionsAction: "View transactions",
    periodDay: "Day",
    periodWeek: "Week",
    periodMonth: "Month",
    periodYear: "Year",
    periodAllTime: "All time",
    periodCustomRange: "Custom range",
    formatMonthYear: (m: number, y: number) => `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m]} ${y}`,
    formatYearOnly: (y: number) => `Year ${y}`,
    cardTitle: "Spending trend",
    cardSubtitle: "Track income, expenses, and cash flow over time",
    viewTransactions: "View transactions",
    periodLabel: "Time period",
    selectWeek: "Choose a date in the week",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    currentWeek: "This week",
    period7d: "7 days",
    period30d: "30 days",
    period90d: "90 days",
    periodAll: "All data",
    periodCustom: "Custom range",
    fromDate: "From date",
    toDate: "To date",
    typeFilter: "Filter transaction type",
    typeAll: "All",
    typeExpense: "Expense",
    typeIncome: "Income",
    categoryFilter: "Filter category",
    allCategories: "All categories",
    accountFilter: "Select account",
    allAccounts: "All accounts",
    currencyFilter: "Select currency",
    simulated: "Simulated",
    emptyText: "No transactions match these filters.",
    resetFilters: "Reset filters",
    summaryIncome: "Income",
    summaryExpense: "Expense",
    summaryNet: "Net",
    summaryTransactions: "transactions",
    tooltipPeriod: "Period",
    tooltipCount: "Count",
    tableCaption: "Cash flow summary table over time",
    tableColPeriod: "Period",
    tableColIncome: "Income",
    tableColExpense: "Expense",
    tableColNet: "Net",
    tableColCount: "Count",

    // F2: Add Wallet Modal
    addWalletModalTitle: "Add New Wallet",
    addWalletDesc: "Create a wallet to allocate funds and manage detailed cash flow.",
    walletTypeLabel: "Wallet type",
    walletTypeCash: "Cash",
    walletTypeCredit: "Credit Card",
    walletNameLabel: "Wallet name",
    walletNamePlaceholder: "E.g., Daily spending, Techcombank, Savings...",
    walletCurrencyLabel: "Currency",
    initialBalanceLabel: "Initial balance",
    unsettledBalanceLabel: "Unsettled balance",
    creditLimitLabel: "Credit limit",
    creditLimitPlaceholder: "E.g., 50,000,000",
    cancel: "Cancel",
    saveWallet: "Save wallet",
    currencyOptions: {
      VND: "VND (Vietnamese Dong)",
      USD: "USD (US Dollar)",
      EUR: "EUR (Euro)",
      JPY: "JPY (Japanese Yen)",
      SGD: "SGD (Singapore Dollar)",
      GBP: "GBP (British Pound)",
      AUD: "AUD (Australian Dollar)",
    },
    currencyOptionsList: [
      { code: "VND", label: "VND (Vietnamese Dong)" },
      { code: "USD", label: "USD (US Dollar)" },
      { code: "EUR", label: "EUR (Euro)" },
      { code: "JPY", label: "JPY (Japanese Yen)" },
      { code: "SGD", label: "SGD (Singapore Dollar)" },
      { code: "GBP", label: "GBP (British Pound)" },
      { code: "AUD", label: "AUD (Australian Dollar)" },
    ],

    // F4: Wallet Selectors & Action Aria-labels
    selectWalletModalTitle: "Select Wallet",
    selectWalletAria: (name: string) => `Select wallet ${name}`,
    manageWalletAria: (name: string) => `Manage wallet ${name}`,

    // F3: Manage Wallet - Details Tab
    manageWalletModalTitle: (name: string) => `Manage wallet: ${name}`,
    walletInfoTab: "Wallet info",
    categoryManagerTab: "Manage categories",
    walletArchivedBannerTitle: "This wallet is currently unlinked (archived)",
    walletArchivedBannerDesc: "This wallet is hidden when creating new transactions, but all transaction history is preserved.",
    currencyUnitLabel: "Currency unit",
    lockedBadge: "Locked (transactions exist)",
    lockedCurrencyHelper: "Currency cannot be changed once transactions exist to prevent exchange rate conflicts and historical data issues.",
    initialBalanceLabelCredit: "Initial outstanding balance",
    initialBalanceLabelCash: "Initial balance",
    lockedInitialBalanceHelperPrefix: "Initial balance is fixed to preserve bookkeeping integrity. To update balance according to your actual bank account, please use ",
    lockedInitialBalanceHelperHighlight: "Reconcile actual balance",
    lockedInitialBalanceHelperSuffix: " below.",
    unlockedInitialBalanceHelper: "No transactions in this wallet yet; you can freely adjust the initial balance.",
    closeButton: "Close",
    saveChangesButton: "Save changes",

    // F3: Manage Wallet - Reconcile Box
    reconcileCardTitle: "Reconcile actual balance",
    reconcileCurrentBookPrefix: "Current book balance: ",
    reconcileCurrentBookSuffix: ". If this does not match your real-world balance, enter your actual balance for automatic adjustment.",
    reconcileTriggerButton: "Adjust actual balance",
    reconcileActualBalanceLabel: (curr: string) => `Actual balance in wallet / bank account (${curr})`,
    reconcileActualBalancePlaceholder: "Enter current actual balance",
    cancelButton: "Cancel",
    confirmAdjustmentButton: "Confirm adjustment",
    reconcileTxTitleIncrease: "Actual balance upward adjustment",
    reconcileTxTitleDecrease: "Actual balance downward adjustment",
    reconcileTxCategory: "Balance Adjustment",
    reconcileTxNoteTemplate: (fromBal: string, toBal: string) => `Reconcile actual balance from ${fromBal} to ${toBal}`,

    // F3: Manage Wallet - Danger Zone
    dangerZoneHeader: "Wallet security operations",
    dangerZoneDescArchived: "This wallet is currently unlinked. You can restore it to continue recording transactions.",
    dangerZoneDescHasTxs: (count: number) => `This wallet has recorded ${count} transactions. The system applies a soft-delete (unlink) policy: the wallet will be hidden, but all ${count} historical transactions will be safely preserved.`,
    dangerZoneDescNoTxs: "This wallet has no transactions. You can permanently delete it from the system.",
    reactivateWalletBtn: "Reactivate this wallet",
    unlinkWalletBtn: "Unlink wallet (Archive)",
    deleteWalletPermanentBtn: "Permanently delete this wallet",
    minOneActiveWalletAlert: "The system requires at least 1 active wallet. You cannot unlink this only remaining wallet.",
    deleteWalletConfirmNoTxs: (name: string) => `Wallet "${name}" has no transactions. Are you sure you want to permanently delete this wallet?`,
    archiveWalletConfirmHasTxs: (name: string, count: number) => `Wallet "${name}" has ${count} transactions. The wallet will be set to "Unlinked" and hidden from transaction creation. All ${count} previous transactions remain safely stored. Do you want to continue?`,

    // F3: Manage Wallet - Category Manager
    catTabExpense: "Expense Categories",
    catTabIncome: "Income Categories",
    catChooseIconTooltip: "Click to choose an icon for category",
    catInputPlaceholderExpense: "Enter new expense category name...",
    catInputPlaceholderIncome: "Enter new income category name...",
    catAddButton: "Add",
    emojiPickerHeaderFor: (targetName: string) => `Choose icon for "${targetName}"`,
    emojiPickerHeaderNewCategory: "Choose icon for new category",
    emojiPickerCloseAriaLabel: "Close icon picker",
    emojiGroupNames: {
      "Nhà & Hóa đơn": "Housing & Bills",
      "Đồ ăn & Đồ uống": "Food & Dining",
      "Giao thông vận tải & Du lịch": "Transportation & Travel",
      "Sức khỏe & Chăm sóc cá nhân": "Health & Personal Care",
      "Điện tử & Công nghệ": "Electronics & Tech",
      "Tiền bạc và công việc": "Money & Work",
      "Vui chơi & Giải trí": "Entertainment & Leisure",
      "Gia đình & Giáo dục": "Family & Education",
      "Khác": "Other",
    },
    catEditIconTitle: "Choose icon",
    catEditSaveTitle: "Save changes",
    catEditCancelTitle: "Cancel",
    catTxCountBadge: (count: number) => `${count} ${count === 1 ? "transaction" : "transactions"}`,
    catArchivedTag: "Hidden",
    catEditTooltip: (name: string) => `Edit category ${name}`,
    catDeleteTooltip: (name: string) => `Delete or hide category ${name}`,
    catRestoreTooltip: (name: string) => `Restore category ${name}`,
    catRestoreBtnText: "Restore",
    catReassignDeleteTooltip: (count: number) => `Move ${count} transactions to "Uncategorized" and permanently delete`,
    uncategorizedCategory: "Uncategorized",
    catNameExistsAlert: "This category name already exists.",
    catCannotDeleteSystemDefaultAlert: "Cannot delete system default category.",
    catReactivateConfirm: (name: string) => `Do you want to reactivate category "${name}"?`,
    catDeleteConfirmNoTxs: (name: string) => `Category "${name}" has no transactions. Are you sure you want to permanently delete it?`,
    catSoftDeleteConfirmHasTxs: (name: string, count: number) => `Category "${name}" is recorded in ${count} transactions.\n\n• Choose [OK]: Hide category (Soft delete - hidden from selection when creating new transactions, but 100% history is preserved).\n• Choose [Cancel]: Keep category.`,
    catReassignDeleteConfirm: (name: string, count: number) => `Move all ${count} transactions of category "${name}" to "Uncategorized" and permanently delete "${name}" from the system?`,

    // F5: Date Pickers & Period Selection
    formatDayPeriod: (dayStr: string) => `Day ${dayStr}`,
    formatWeekPeriod: (fromStr: string, toStr: string) => `Week ${fromStr} – ${toStr}`,
    allTimePeriod: "all time",
    selectDetailedTimeAria: "Select detailed time period",
    periodModalTitle: "Select time period",
    pickDayModalTitle: "Select date",
    pickDayDesc: "Select a date to track income and expenses for that specific day.",
    pickDayLabel: "Select date",
    today: "Today",
    yesterday: "Yesterday",
    selectedDayLabel: "Selected date:",
    confirmButton: "Confirm",
    pickWeekModalTitle: "Select week",
    pickWeekDesc: "Select a week to track cash flow over a 7-day cycle (Monday – Sunday).",
    pickWeekOrChooseDate: "Or choose any day of the week",
    thisWeek: "This week",
    previousYearAria: "Previous year",
    nextYearAria: "Next year",
    pickMonthModalTitle: "Select month",
    monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    selectedMonthLabel: "Selected month:",
    pickYearModalTitle: "Select year",
    pickYearDesc: "Select a year to view full-year financial summary.",
    pickCustomRangeModalTitle: "Select custom range",
    pickCustomRangeDesc: "Customize time range from date to date.",
    period7dPast: "Past 7 days",
    period30dPast: "Past 30 days",
    thisMonth: "This month",
    rangePreviewLabel: "Time range:",
    applyButton: "Apply",

    // F5: Flow Analysis Modals & SvgDonut
    flowIncomeModalTitle: "Income details",
    flowExpenseModalTitle: "Expense details",
    flowComparisonModalTitle: "Income & Expense analysis this period",
    periodPrefix: "Period: ",
    emptyIncomeTitle: "No income recorded for this period",
    emptyIncomeDesc: (period: string) => `Income transactions in ${period} will appear here.`,
    addIncomeTxBtn: "Add income transaction",
    emptyExpenseTitle: "No expenses recorded for this period",
    emptyExpenseDesc: (period: string) => `Expense transactions in ${period} will appear here.`,
    addExpenseTxBtn: "Add expense transaction",
    totalIncomeWithPeriod: (period: string) => `Total income (${period})`,
    totalExpenseWithPeriod: (period: string) => `Total expense (${period})`,
    donutCurrencySwitcherLabel: "Chart display currency:",
    donutIncomeBreakdown: "Income Breakdown",
    donutExpenseBreakdown: "Expense Breakdown",
    donutTotalIncome: "Total income",
    donutTotalExpense: "Total expense",
    donutNoIncomeTx: "No income transactions this period",
    donutNoExpenseTx: "No expense transactions this period",
    unlinkedTag: " (Unlinked)",

    // F5 & F6: Quick Search, Workspace & Overviews
    transactionsHeading: "Transactions",
    searchTransactionsAria: "Search transactions",
    calendarAria: "Transaction calendar",
    searchModalTitle: "Search Transactions",
    searchPlaceholder: "Search transactions...",
    searchButton: "Search",
    clearSearchButton: "Clear",
    noMatchingTransactions: "No matching transactions",
    noMatchingTransactionsHint: "No transactions match your search keywords.",
    emptyTransactionsPeriodTitle: "No transactions this period.",
    emptyTransactionsPeriodText: "Tap + to add a transaction.",
    noExpensesThisPeriod: "No expenses in this period",
    noIncomesThisPeriod: "No income in this period",
    recordTxToTrackFlow: "Record a transaction to start tracking your cash flow.",
    archivedWalletSuffix: " (Unlinked)",
    homeTotalsModalTitle: "Total cash flow",
    totalAllWalletsBalance: "Total balance across all wallets",
    totalExpenseFromWallets: "Total expenses from all wallets",
    totalIncomeFromWallets: "Total income from all wallets",
    totalsModalTitle: "Income & Expense summary",
    transfer: "Transfer",
    totalSum: "Total",
    viewCashFlowDetailsAria: "View cash flow details",
  },
  zh: {
    overviewEyebrow: "总览",
    welcomePrefix: "你好，",
    defaultGreeting: "掌握您的财富。",
    introSub: "追踪现金流，从容规划未来。",
    addTransaction: "添加交易",
    yourWallets: "您的钱包",
    activeWalletsSuffix: "个活跃钱包",
    unlinkedSuffix: "已解绑",
    unlinkedChip: (count: number) => `已解绑 (${count})`,
    addWallet: "添加钱包",
    flowThisPeriod: "本期现金流",
    flowSub: "汇总自所有已集成钱包",
    totalIncome: "总收入",
    totalExpense: "总支出",
    fromAllWalletsInPeriod: "来自本期所有钱包",
    currencyNote: "货币分别显示，不折算汇率。",
    details: "详情",
    walletFlowTitle: "按钱包收支",
    walletFlowSub: "本期各已集成钱包数据",
    manageWallets: "管理钱包",
    expShort: "支 ",
    incShort: "收 ",
    mainWallet: "主钱包",
    netChange: "净变动",
    cost: "支出",
    income: "收入",
    txThisPeriod: "本期交易",
    selectedWalletBalance: "已选钱包余额",
    habitEyebrow: "日积月累",
    habitTitle: "更懂您的每一笔财富。",
    habitSub: "记录日常收支，掌握清晰财务全貌。",
    viewTransactionsAction: "查看交易",
    periodDay: "按日",
    periodWeek: "按周",
    periodMonth: "按月",
    periodYear: "按年",
    periodAllTime: "全部时间",
    periodCustomRange: "自定义范围",
    formatMonthYear: (m: number, y: number) => `${y}年${m + 1}月`,
    formatYearOnly: (y: number) => `${y}年`,
    cardTitle: "支出趋势",
    cardSubtitle: "追踪各时期的收入、支出与现金流",
    viewTransactions: "查看交易",
    periodLabel: "时间范围",
    selectWeek: "选择周内日期",
    previousWeek: "上一周",
    nextWeek: "下一周",
    currentWeek: "本周",
    period7d: "7天",
    period30d: "30天",
    period90d: "90天",
    periodAll: "全部数据",
    periodCustom: "自定义范围",
    fromDate: "起始日期",
    toDate: "结束日期",
    typeFilter: "筛选交易类型",
    typeAll: "全部",
    typeExpense: "支出",
    typeIncome: "收入",
    categoryFilter: "筛选分类",
    allCategories: "全部分类",
    accountFilter: "选择账户",
    allAccounts: "全部账户",
    currencyFilter: "选择货币",
    simulated: "模拟",
    emptyText: "没有符合此筛选条件的交易。",
    resetFilters: "重置筛选",
    summaryIncome: "收入",
    summaryExpense: "支出",
    summaryNet: "净额",
    summaryTransactions: "笔交易",
    tooltipPeriod: "期间",
    tooltipCount: "笔数",
    tableCaption: "各期现金流汇总数据表",
    tableColPeriod: "期间",
    tableColIncome: "收入",
    tableColExpense: "支出",
    tableColNet: "净额",
    tableColCount: "笔数",

    // F2: Add Wallet Modal
    addWalletModalTitle: "添加新钱包",
    addWalletDesc: "创建钱包以分配财务并详细管理现金流。",
    walletTypeLabel: "钱包类型",
    walletTypeCash: "现金",
    walletTypeCredit: "信用卡",
    walletNameLabel: "钱包名称",
    walletNamePlaceholder: "例如：日常消费、招商银行、储蓄卡...",
    walletCurrencyLabel: "货币单位",
    initialBalanceLabel: "初始余额",
    unsettledBalanceLabel: "未结算余额",
    creditLimitLabel: "信用额度",
    creditLimitPlaceholder: "例如：50,000,000",
    cancel: "取消",
    saveWallet: "保存钱包",
    currencyOptions: {
      VND: "VND (越南盾)",
      USD: "USD (美元)",
      EUR: "EUR (欧元)",
      JPY: "JPY (日元)",
      SGD: "SGD (新加坡元)",
      GBP: "GBP (英镑)",
      AUD: "AUD (澳大利亚元)",
    },
    currencyOptionsList: [
      { code: "VND", label: "VND (越南盾)" },
      { code: "USD", label: "USD (美元)" },
      { code: "EUR", label: "EUR (欧元)" },
      { code: "JPY", label: "JPY (日元)" },
      { code: "SGD", label: "SGD (新加坡元)" },
      { code: "GBP", label: "GBP (英镑)" },
      { code: "AUD", label: "AUD (澳大利亚元)" },
    ],

    // F4: Wallet Selectors & Action Aria-labels
    selectWalletModalTitle: "选择钱包",
    selectWalletAria: (name: string) => `选择钱包 ${name}`,
    manageWalletAria: (name: string) => `管理钱包 ${name}`,

    // F3: Manage Wallet - Details Tab
    manageWalletModalTitle: (name: string) => `管理钱包: ${name}`,
    walletInfoTab: "钱包信息",
    categoryManagerTab: "分类管理",
    walletArchivedBannerTitle: "此钱包处于已解绑状态（已归档）",
    walletArchivedBannerDesc: "创建新交易时此钱包将被隐藏，但所有交易历史记录仍会完整保留。",
    currencyUnitLabel: "货币单位",
    lockedBadge: "已锁定（已发生交易）",
    lockedCurrencyHelper: "已有交易记录时无法更改货币，以避免汇率冲突和历史数据问题。",
    initialBalanceLabelCredit: "初始未还余额",
    initialBalanceLabelCash: "初始余额",
    lockedInitialBalanceHelperPrefix: "初始余额已锁定以维护账目完整性。如需根据实际银行账户更新余额，请使用下方的",
    lockedInitialBalanceHelperHighlight: "核对实际余额",
    lockedInitialBalanceHelperSuffix: "功能。",
    unlockedInitialBalanceHelper: "此钱包尚无交易记录，您可以自由调整初始余额。",
    closeButton: "关闭",
    saveChangesButton: "保存更改",

    // F3: Manage Wallet - Reconcile Box
    reconcileCardTitle: "核对实际余额",
    reconcileCurrentBookPrefix: "当前账面余额：",
    reconcileCurrentBookSuffix: "。如果与实际不符，请输入实际余额，系统将自动补齐差额。",
    reconcileTriggerButton: "调整实际余额",
    reconcileActualBalanceLabel: (curr: string) => `钱包/银行账户中的实际余额 (${curr})`,
    reconcileActualBalancePlaceholder: "输入当前实际余额",
    cancelButton: "取消",
    confirmAdjustmentButton: "确认调整",
    reconcileTxTitleIncrease: "实际余额上调",
    reconcileTxTitleDecrease: "实际余额下调",
    reconcileTxCategory: "余额调整",
    reconcileTxNoteTemplate: (fromBal: string, toBal: string) => `将实际余额从 ${fromBal} 调整为 ${toBal}`,

    // F3: Manage Wallet - Danger Zone
    dangerZoneHeader: "钱包安全操作",
    dangerZoneDescArchived: "此钱包当前已解绑。您可以恢复它以继续记录交易。",
    dangerZoneDescHasTxs: (count: number) => `此钱包已记录 ${count} 笔交易。系统将应用软删除（解绑）策略：钱包将被隐藏，但全部 ${count} 笔历史交易将完整保留。`,
    dangerZoneDescNoTxs: "此钱包尚无交易记录。您可以将其从系统中永久删除。",
    reactivateWalletBtn: "重新激活此钱包",
    unlinkWalletBtn: "解绑钱包（归档）",
    deleteWalletPermanentBtn: "永久删除此钱包",
    minOneActiveWalletAlert: "系统至少需要一个活跃钱包。您不能解绑这唯一的钱包。",
    deleteWalletConfirmNoTxs: (name: string) => `钱包 "${name}" 尚无交易记录。确定要永久删除此钱包吗？`,
    archiveWalletConfirmHasTxs: (name: string, count: number) => `钱包 "${name}" 已有 ${count} 笔交易。该钱包将转为“已解绑”状态并在创建交易时隐藏。之前所有的 ${count} 笔交易仍会安全保存。是否继续？`,

    // F3: Manage Wallet - Category Manager
    catTabExpense: "支出分类",
    catTabIncome: "收入分类",
    catChooseIconTooltip: "点击为分类选择图标",
    catInputPlaceholderExpense: "输入新支出分类名称...",
    catInputPlaceholderIncome: "输入新收入分类名称...",
    catAddButton: "添加",
    emojiPickerHeaderFor: (targetName: string) => `为 "${targetName}" 选择图标`,
    emojiPickerHeaderNewCategory: "为新分类选择图标",
    emojiPickerCloseAriaLabel: "关闭图标面板",
    emojiGroupNames: {
      "Nhà & Hóa đơn": "住房与账单",
      "Đồ ăn & Đồ uống": "餐饮美食",
      "Giao thông vận tải & Du lịch": "交通出行与旅游",
      "Sức khỏe & Chăm sóc cá nhân": "健康与个人护理",
      "Điện tử & Công nghệ": "数码与科技",
      "Tiền bạc và công việc": "财务与工作",
      "Vui chơi & Giải trí": "休闲与娱乐",
      "Gia đình & Giáo dục": "家庭与教育",
      "Khác": "其他",
    },
    catEditIconTitle: "选择图标",
    catEditSaveTitle: "保存更改",
    catEditCancelTitle: "取消",
    catTxCountBadge: (count: number) => `${count} 笔交易`,
    catArchivedTag: "已隐藏",
    catEditTooltip: (name: string) => `编辑分类 ${name}`,
    catDeleteTooltip: (name: string) => `删除或隐藏分类 ${name}`,
    catRestoreTooltip: (name: string) => `恢复分类 ${name}`,
    catRestoreBtnText: "恢复",
    catReassignDeleteTooltip: (count: number) => `将 ${count} 笔交易归入“未分类”并永久删除`,
    uncategorizedCategory: "未分类",
    catNameExistsAlert: "此分类名称已存在。",
    catCannotDeleteSystemDefaultAlert: "无法删除系统默认分类。",
    catReactivateConfirm: (name: string) => `是否重新激活分类 "${name}"？`,
    catDeleteConfirmNoTxs: (name: string) => `分类 "${name}" 尚无交易记录。确定要永久删除吗？`,
    catSoftDeleteConfirmHasTxs: (name: string, count: number) => `分类 "${name}" 已记录在 ${count} 笔交易中。\n\n• 选择 [确定]：隐藏分类（软删除 - 创建新交易时隐藏，但100%保留历史数据）。\n• 选择 [取消]：保留分类。`,
    catReassignDeleteConfirm: (name: string, count: number) => `将分类 "${name}" 的全部 ${count} 笔交易转移至“未分类”并从系统中永久删除 "${name}"？`,

    // F5: Date Pickers & Period Selection
    formatDayPeriod: (dayStr: string) => `${dayStr}`,
    formatWeekPeriod: (fromStr: string, toStr: string) => `周 ${fromStr} – ${toStr}`,
    allTimePeriod: "全部时间",
    selectDetailedTimeAria: "选择详细时间",
    periodModalTitle: "选择时间范围",
    pickDayModalTitle: "选择日期",
    pickDayDesc: "选择日期以追踪该特定日期的收支。",
    pickDayLabel: "选择日期",
    today: "今天",
    yesterday: "昨天",
    selectedDayLabel: "已选日期：",
    confirmButton: "确认",
    pickWeekModalTitle: "选择周",
    pickWeekDesc: "选择周以追踪7天周期（周一至周日）的现金流。",
    pickWeekOrChooseDate: "或选择周内的任意一天",
    thisWeek: "本周",
    previousYearAria: "上一年",
    nextYearAria: "下一年",
    pickMonthModalTitle: "选择月份",
    monthNamesShort: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
    selectedMonthLabel: "已选月份：",
    pickYearModalTitle: "选择年份",
    pickYearDesc: "选择年份以查看全年财务汇总。",
    pickCustomRangeModalTitle: "选择自定义范围",
    pickCustomRangeDesc: "自定义从起始日期到结束日期的时间范围。",
    period7dPast: "过去7天",
    period30dPast: "过去30天",
    thisMonth: "本月",
    rangePreviewLabel: "时间范围：",
    applyButton: "应用",

    // F5: Flow Analysis Modals & SvgDonut
    flowIncomeModalTitle: "收入明细",
    flowExpenseModalTitle: "支出明细",
    flowComparisonModalTitle: "本期收支对比分析",
    periodPrefix: "期间：",
    emptyIncomeTitle: "本期尚无收入记录",
    emptyIncomeDesc: (period: string) => `${period}的收入交易将显示在此处。`,
    addIncomeTxBtn: "添加收入交易",
    emptyExpenseTitle: "本期尚无支出记录",
    emptyExpenseDesc: (period: string) => `${period}的支出交易将显示在此处。`,
    addExpenseTxBtn: "添加支出交易",
    totalIncomeWithPeriod: (period: string) => `总收入 (${period})`,
    totalExpenseWithPeriod: (period: string) => `总支出 (${period})`,
    donutCurrencySwitcherLabel: "图表显示货币：",
    donutIncomeBreakdown: "收入结构",
    donutExpenseBreakdown: "支出结构",
    donutTotalIncome: "总收入",
    donutTotalExpense: "总支出",
    donutNoIncomeTx: "本期尚无收入交易",
    donutNoExpenseTx: "本期尚无支出交易",
    unlinkedTag: " (已解绑)",

    // F5 & F6: Quick Search, Workspace & Overviews
    transactionsHeading: "交易",
    searchTransactionsAria: "搜索交易",
    calendarAria: "交易日历",
    searchModalTitle: "搜索交易",
    searchPlaceholder: "搜索交易...",
    searchButton: "搜索",
    clearSearchButton: "清除",
    noMatchingTransactions: "没有符合条件的交易",
    noMatchingTransactionsHint: "没有找到与搜索词匹配的交易记录。",
    emptyTransactionsPeriodTitle: "本期暂无交易记录。",
    emptyTransactionsPeriodText: "点击 + 添加交易。",
    noExpensesThisPeriod: "本期暂无支出记录",
    noIncomesThisPeriod: "本期暂无收入记录",
    recordTxToTrackFlow: "记录一笔交易以开始追踪现金流。",
    archivedWalletSuffix: " (已解绑)",
    homeTotalsModalTitle: "现金流总览",
    totalAllWalletsBalance: "全部钱包总余额",
    totalExpenseFromWallets: "各钱包总支出",
    totalIncomeFromWallets: "各钱包总收入",
    totalsModalTitle: "收支总览",
    transfer: "转账",
    totalSum: "总计",
    viewCashFlowDetailsAria: "查看现金流详情",
  },
};

function getLanguage(langSetting: unknown): "vi" | "en" | "zh" {
  return resolveLanguage(langSetting);
}

function getNiceScale(maxValue: number, tickCount = 4) {
  if (maxValue <= 0) return { max: 100, step: 25, ticks: [0, 25, 50, 75, 100] };
  const rawStep = maxValue / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let niceStep = magnitude;
  if (normalized <= 1) niceStep = 1 * magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 2.5) niceStep = 2.5 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;
  const niceMax = niceStep * tickCount >= maxValue ? niceStep * tickCount : niceStep * (tickCount + 1);
  const ticks: number[] = [];
  for (let t = 0; t <= niceMax + 1e-6; t += niceStep) {
    ticks.push(Number(t.toPrecision(12)));
  }
  return { max: ticks[ticks.length - 1], step: niceStep, ticks };
}

export function formatHomeMoney(amount: number, currency = "VND", withSign = false) {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const formatted = absVal.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const curr = (currency || "VND").toUpperCase();
  if (withSign) {
    const sign = amount > 0 ? "+" : isNeg ? "−" : "";
    return `${sign}${formatted} ${curr}`;
  }
  return `${isNeg ? "−" : ""}${formatted} ${curr}`;
}

function formatCompactMoney(amount: number, currency: string, lang: "vi" | "en" | "zh") {
  const curr = (currency || "VND").toUpperCase();
  if (amount === 0) return `0 ${curr}`;
  if (curr === "VND") {
    if (amount >= 1_000_000_000) {
      const v = (amount / 1_000_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tỷ VND` : lang === "zh" ? `${v}0亿 VND` : `${v}B VND`;
    }
    if (amount >= 1_000_000) {
      const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
      return lang === "vi" ? `${v} tr VND` : lang === "zh" ? `${Math.round(amount / 10000)}万 VND` : `${v}M VND`;
    }
    if (amount >= 1_000) {
      const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 0 });
      return lang === "vi" ? `${v} k VND` : lang === "zh" ? `${(amount / 10000).toFixed(1)}万 VND` : `${v}K VND`;
    }
    return `${amount.toLocaleString(lang === "vi" ? "vi-VN" : "en-US")} VND`;
  }
  if (amount >= 1_000_000) {
    const v = (amount / 1_000_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${v}M ${curr}`;
  }
  if (amount >= 1_000) {
    const v = (amount / 1_000).toLocaleString(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 });
    return `${v}K ${curr}`;
  }
  return `${amount.toLocaleString("en-US")} ${curr}`;
}

const INCOME_COLORS = ["#0d9488", "#10b981", "#0284c7", "#6366f1", "#f59e0b", "#8b5cf6", "#ec4899"];
const EXPENSE_COLORS = ["#e11d48", "#f97316", "#7c3aed", "#2563eb", "#059669", "#d97706", "#db2777", "#0891b2"];

function getCategoryBreakdown(records: Transaction[], fallbackCurrency: string, colors: string[]) {
  const map = new Map<string, number>();
  let total = 0;
  for (const r of records) {
    const prev = map.get(r.category) || 0;
    map.set(r.category, prev + r.amount);
    total += r.amount;
  }
  const items = Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount], idx) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
      color: colors[idx % colors.length],
      currency: fallbackCurrency,
    }));
  return { total, items };
}

function SvgDonut({
  type,
  items,
  total,
  currency,
  lang = "vi",
}: {
  type: "income" | "expense";
  items: { category: string; amount: number; percent: number; color: string }[];
  total: number;
  currency: string;
  lang?: "vi" | "en" | "zh";
}) {
  const t = DASHBOARD_I18N[lang];
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <div className="fb-donut-card">
      <div className="fb-donut-header">
        <span className={"fb-donut-badge " + (type === "income" ? "r-income" : "r-expense")}>
          {type === "income" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          <span>{type === "income" ? t.donutIncomeBreakdown : t.donutExpenseBreakdown}</span>
        </span>
      </div>

      <div className="fb-donut-visual-container">
        <svg viewBox="0 0 160 160" className="fb-donut-svg">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={type === "income" ? "#ecfdf5" : "#fff1f2"}
            strokeWidth="22"
          />
          {total === 0 || items.length === 0 ? (
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="20"
              strokeDasharray="6 6"
            />
          ) : (
            items.map((item) => {
              const sliceLength = (item.percent / 100) * circumference;
              const offset = -accumulated;
              accumulated += sliceLength;
              return (
                <circle
                  key={item.category}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="22"
                  strokeDasharray={`${Math.max(1, sliceLength - (items.length > 1 ? 1.5 : 0))} ${circumference}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 80 80)"
                  strokeLinecap="round"
                />
              );
            })
          )}
        </svg>
        <div className="fb-donut-center-info">
          <span className="fb-donut-center-label">{type === "income" ? t.donutTotalIncome : t.donutTotalExpense}</span>
          <b className={"fb-donut-center-value " + (type === "income" ? "r-income" : "r-expense")}>
            {total === 0 ? `0 ${currency}` : (type === "income" ? "+" : "−") + formatHomeMoney(total, currency)}
          </b>
        </div>
      </div>

      <div className="fb-donut-legend">
        {items.length === 0 ? (
          <p className="fb-donut-empty-text">{type === "income" ? t.donutNoIncomeTx : t.donutNoExpenseTx}</p>
        ) : (
          items.map((item) => {
            const localizedCat = resolveCategoryDisplayName(item.category, lang);
            return (
              <div key={item.category} className="fb-donut-legend-item">
                <div className="fb-donut-legend-left">
                  <i className="fb-donut-dot" style={{ backgroundColor: item.color }} />
                  <span className="fb-donut-cat-name" title={localizedCat}>{localizedCat}</span>
                </div>
                <div className="fb-donut-legend-right">
                  <span className="fb-donut-pct">{item.percent.toFixed(1)}%</span>
                  <b className="fb-donut-val">{formatHomeMoney(item.amount, currency)}</b>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}


export function MonthCalendar({ month, year, transactions = [], onPick }: { month: number; year: number; transactions?: Transaction[]; onPick?: (date: string) => void }) {
  const start = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return <div className="r-calendar"><div className="r-calendar-week">{["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}</div><div className="r-calendar-days">{Array.from({ length: Math.ceil((start + count) / 7) * 7 }, (_, i) => {
    const date = new Date(year, month, i - start + 1);
    const value = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
    const records = transactions.filter((t) => t.date === value);
    return <button key={value} type="button" className={date.getMonth() !== month ? "r-other-month" : ""} onClick={() => onPick?.(value)}><span>{date.getDate()}</span>{records.length > 0 && <small className={records.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0) < 0 ? "r-expense" : "r-income"}>{money(records.reduce((a, t) => a + (t.type === "income" ? t.amount : -t.amount), 0))}</small>}</button>;
  })}</div></div>;
}

export function Dashboard({ transactionsTab = false, walletSettingsMode = false, navigate }: { transactionsTab?: boolean; walletSettingsMode?: boolean; navigate: (screen: string) => void }) {
  const state = useAppState();
  const searchParams = useSearchParams();
  const lang = getLanguage(state.settings.language);
  const t = DASHBOARD_I18N[lang];

  const queryType = searchParams.get("type");
  const queryCategory = searchParams.get("category");
  const queryFrom = searchParams.get("from");
  const queryTo = searchParams.get("to");
  const queryWallet = searchParams.get("wallet");
  const querySource = searchParams.get("source");

  const activeWallets = state.wallets.filter((w) => !w.archived);
  const archivedWallets = state.wallets.filter((w) => w.archived);
  const [walletId, setWalletId] = useState(queryWallet || activeWallets[0]?.id || state.wallets[0].id);
  const wallet = activeWallets.find((w) => w.id === walletId) || activeWallets[0] || state.wallets[0];
  const [period, setPeriod] = useState("Tháng");
  const [month, setMonth] = useState(9);
  const [year, setYear] = useState(2026);
  const [day, setDay] = useState("2026-10-12");
  const [from, setFrom] = useState("2026-10-01");
  const [to, setTo] = useState("2026-10-31");
  const [type, setType] = useState<"expense" | "income">("expense");

  // Spending trend chart filter state
  const [dashboardSource] = useState<"sample" | "live">(querySource === "live" ? "live" : "sample");
  const [dashboardType, setDashboardType] = useState<"all" | "expense" | "income">((queryType as "all" | "expense" | "income") || "all");
  const [dashboardCategory, setDashboardCategory] = useState(queryCategory || "all");
  const dashboardCurrency = wallet.currency;
  const [dashboardWeek, setDashboardWeek] = useState(() => calendarWeek(localDateKey(new Date())).start);
  const [focusedBucketKey, setFocusedBucketKey] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [modal, setModal] = useState("");
  const [calendarLedgerOpen, setCalendarLedgerOpen] = useState(false);

  // Add wallet modal state
  const [newWalletName, setNewWalletName] = useState("");
  const [newWalletAmount, setNewWalletAmount] = useState("");
  const [newWalletCurrency, setNewWalletCurrency] = useState("VND");
  const [newWalletType, setNewWalletType] = useState<"cash" | "credit">("cash");
  const [newWalletLimit, setNewWalletLimit] = useState("");

  const openAddWalletModal = () => {
    setNewWalletName("");
    setNewWalletAmount("");
    setNewWalletCurrency(wallet.currency || "VND");
    setNewWalletType("cash");
    setNewWalletLimit("");
    setModal("addWallet");
  };

  const handleCreateWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim()) return;
    const newId = crypto.randomUUID();
    const nextWallet: WalletType = {
      id: newId,
      name: newWalletName.trim(),
      initial: Number(newWalletAmount || 0),
      currency: newWalletCurrency,
      type: newWalletType,
      limit: newWalletType === "credit" ? Number(newWalletLimit) || undefined : undefined,
    };
    updateState((s) => ({ ...s, wallets: [...s.wallets, nextWallet] }));
    setWalletId(newId);
    setModal("");
  };

  // Manage wallet modal state
  const [editingWalletId, setEditingWalletId] = useState("");
  const [manageWalletTab, setManageWalletTab] = useState<"details" | "categories">("details");
  const [editWalletName, setEditWalletName] = useState("");
  const [editWalletType, setEditWalletType] = useState<"cash" | "credit">("cash");
  const [editWalletCurrency, setEditWalletCurrency] = useState("VND");
  const [editWalletInitial, setEditWalletInitial] = useState("");
  const [editWalletLimit, setEditWalletLimit] = useState("");
  const [isReconciling, setIsReconciling] = useState(false);
  const [newActualBalance, setNewActualBalance] = useState("");
  const [catType, setCatType] = useState<"expense" | "income">("expense");
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");
  const [isPickingIcon, setIsPickingIcon] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<"new" | "edit">("new");
  const [editingCatName, setEditingCatName] = useState<string | null>(null);
  const [editCatTitle, setEditCatTitle] = useState("");
  const [editCatIcon, setEditCatIcon] = useState("");

  const openManageWalletModal = (targetWalletId: string) => {
    const target = state.wallets.find((w) => w.id === targetWalletId) || wallet;
    setEditingWalletId(target.id);
    setEditWalletName(isSentinelWalletName(target.name) ? t.mainWallet : target.name);
    setEditWalletType(target.type === "credit" ? "credit" : "cash");
    setEditWalletCurrency(target.currency || "VND");
    setEditWalletInitial(String(target.initial || 0));
    setEditWalletLimit(target.limit ? String(target.limit) : "");
    setManageWalletTab("details");
    setIsReconciling(false);
    setNewActualBalance("");
    setNewCatName("");
    setNewCatIcon("🏷️");
    setIsPickingIcon(false);
    setEditingCatName(null);
    setModal("manageWallet");
  };

  const handleSaveWalletInfo = (e: React.FormEvent) => {
    e.preventDefault();
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const txCount = state.transactions.filter((t) => t.wallet === target.id || t.targetWallet === target.id).length;
    const hasTxs = txCount > 0;
    const trimmed = editWalletName.trim();
    const isTargetSentinel = isSentinelWalletName(target.name);
    const persistentName = isTargetSentinel
      ? (!trimmed || isSentinelWalletName(trimmed) || trimmed === t.mainWallet ? "." : trimmed)
      : (trimmed || target.name);
    const updated: WalletType = {
      ...target,
      name: persistentName,
      type: editWalletType,
      limit: editWalletType === "credit" ? Number(editWalletLimit) || undefined : undefined,
      currency: hasTxs ? target.currency : editWalletCurrency,
      initial: hasTxs ? target.initial : Number(editWalletInitial || 0),
    };
    updateState((s) => ({
      ...s,
      wallets: s.wallets.map((w) => (w.id === target.id ? updated : w)),
    }));
    close();
  };

  const handleConfirmAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const currentBal = target.initial + state.transactions.reduce((a, t) => a + (t.wallet === target.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === target.id ? t.amount : 0), 0);
    const targetBal = Number(newActualBalance);
    if (isNaN(targetBal)) return;
    const diff = targetBal - currentBal;
    if (Math.abs(diff) > 0.0001) {
      const adjTx: Transaction = {
        id: crypto.randomUUID(),
        date: localDateKey(new Date()),
        title: diff > 0 ? t.reconcileTxTitleIncrease : t.reconcileTxTitleDecrease,
        amount: Math.abs(diff),
        type: diff > 0 ? "income" : "expense",
        category: t.reconcileTxCategory,
        wallet: target.id,
        note: t.reconcileTxNoteTemplate(formatHomeMoney(currentBal, target.currency), formatHomeMoney(targetBal, target.currency)),
      };
      updateState((s) => ({
        ...s,
        transactions: [adjTx, ...s.transactions],
      }));
    }
    setIsReconciling(false);
    setNewActualBalance("");
  };

  const handleArchiveOrDeleteWallet = () => {
    const target = state.wallets.find((w) => w.id === editingWalletId);
    if (!target) return;
    const txCount = state.transactions.filter((t) => t.wallet === target.id || t.targetWallet === target.id).length;
    const activeCount = state.wallets.filter((w) => !w.archived).length;

    if (activeCount <= 1 && !target.archived) {
      alert(t.minOneActiveWalletAlert);
      return;
    }

    if (target.archived) {
      updateState((s) => ({
        ...s,
        wallets: s.wallets.map((w) => (w.id === target.id ? { ...w, archived: false } : w)),
      }));
      close();
      return;
    }

    if (txCount === 0) {
      if (confirm(t.deleteWalletConfirmNoTxs(walletName(target.name)))) {
        updateState((s) => ({
          ...s,
          wallets: s.wallets.filter((w) => w.id !== target.id),
        }));
        if (walletId === target.id) {
          const remaining = state.wallets.filter((w) => w.id !== target.id && !w.archived);
          if (remaining[0]) setWalletId(remaining[0].id);
        }
        close();
      }
    } else {
      if (confirm(t.archiveWalletConfirmHasTxs(walletName(target.name), txCount))) {
        updateState((s) => ({
          ...s,
          wallets: s.wallets.map((w) => (w.id === target.id ? { ...w, archived: true } : w)),
        }));
        if (walletId === target.id) {
          const remaining = state.wallets.filter((w) => w.id !== target.id && !w.archived);
          if (remaining[0]) setWalletId(remaining[0].id);
        }
        close();
      }
    }
  };

  const handleSwitchCatType = (type: "expense" | "income") => {
    setCatType(type);
    if (type === "income" && (newCatIcon === "🏷️" || newCatIcon === "🍔")) {
      setNewCatIcon("💰");
    } else if (type === "expense" && newCatIcon === "💰") {
      setNewCatIcon("🏷️");
    }
    setIsPickingIcon(false);
    setEditingCatName(null);
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed || state.categories.includes(trimmed)) return;
    updateState((s) => ({
      ...s,
      categories: [...s.categories, trimmed],
      categoryMeta: {
        ...s.categoryMeta,
        [trimmed]: {
          type: catType,
          icon: newCatIcon || (catType === "income" ? "💰" : "🏷️"),
          children: [],
        },
      },
    }));
    setNewCatName("");
    setIsPickingIcon(false);
  };

  const handleStartEditCat = (cat: string) => {
    setEditingCatName(cat);
    setEditCatTitle(cat);
    setEditCatIcon(categoryIcon(cat, state.categoryMeta));
    setIconPickerTarget("edit");
    setIsPickingIcon(false);
  };

  const handleSaveEditCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCatName) return;
    const oldName = editingCatName;
    const newName = editCatTitle.trim();
    if (!newName) return;
    if (newName !== oldName && state.categories.includes(newName)) {
      alert(t.catNameExistsAlert);
      return;
    }
    const currentMeta = state.categoryMeta[oldName] || { type: catType, icon: editCatIcon, children: [] };
    updateState((s) => {
      const nextMeta = { ...s.categoryMeta };
      if (newName !== oldName) {
        delete nextMeta[oldName];
      }
      nextMeta[newName] = {
        ...currentMeta,
        icon: editCatIcon,
      };
      return {
        ...s,
        categories: s.categories.map((c) => (c === oldName ? newName : c)),
        walletCategories: s.walletCategories ? Object.fromEntries(Object.entries(s.walletCategories).map(([id, names]) => [id, names.map(n => n === oldName ? newName : n)])) : undefined,
        goals: s.goals.map(g => g.category === oldName ? { ...g, category: newName } : g),
        fixedExpenses: s.fixedExpenses?.map(e => e.category === oldName ? { ...e, category: newName } : e),
        recurring: s.recurring.map(t => t.category === oldName ? { ...t, category: newName } : t),
        categoryMeta: nextMeta,
        transactions: newName !== oldName
          ? s.transactions.map((t) => (t.category === oldName ? { ...t, category: newName } : t))
          : s.transactions,
      };
    });
    setEditingCatName(null);
    setIsPickingIcon(false);
  };

  const handleCancelEditCat = () => {
    setEditingCatName(null);
    setIsPickingIcon(false);
  };

  const handleDeleteCategory = (cat: string) => {
    if (cat === "Chưa được phân loại") {
      alert(t.catCannotDeleteSystemDefaultAlert);
      return;
    }

    const txCount = state.transactions.filter((t) => t.category === cat).length;
    const meta = state.categoryMeta[cat];
    const displayCatName = cat === "Chưa được phân loại" ? t.uncategorizedCategory : cat;

    if (meta?.archived) {
      if (confirm(t.catReactivateConfirm(displayCatName))) {
        updateState((s) => ({
          ...s,
          categoryMeta: {
            ...s.categoryMeta,
            [cat]: { ...meta, archived: false },
          },
        }));
      }
      return;
    }

    if (txCount === 0) {
      if (confirm(t.catDeleteConfirmNoTxs(displayCatName))) {
        updateState((s) => {
          const nextMeta = { ...s.categoryMeta };
          delete nextMeta[cat];
          return {
            ...s,
            categories: s.categories.filter((c) => c !== cat),
            categoryMeta: nextMeta,
          };
        });
      }
    } else {
      const choice = confirm(t.catSoftDeleteConfirmHasTxs(displayCatName, txCount));
      if (choice) {
        updateState((s) => ({
          ...s,
          categoryMeta: {
            ...s.categoryMeta,
            [cat]: { ...(meta || { type: catType, icon: "🏷️", children: [] }), archived: true },
          },
        }));
      }
    }
  };

  const handleReassignAndDelete = (cat: string) => {
    const txCount = state.transactions.filter((t) => t.category === cat).length;
    const displayCatName = cat === "Chưa được phân loại" ? t.uncategorizedCategory : cat;
    if (confirm(t.catReassignDeleteConfirm(displayCatName, txCount))) {
      updateState((s) => {
        const nextMeta = { ...s.categoryMeta };
        delete nextMeta[cat];
        return {
          ...s,
          categories: s.categories.filter((c) => c !== cat),
          categoryMeta: nextMeta,
          transactions: s.transactions.map((t) => (t.category === cat ? { ...t, category: "Chưa được phân loại" } : t)),
        };
      });
    }
  };

  const overviewCardRef = useRef<HTMLDivElement>(null);
  const [overviewHeight, setOverviewHeight] = useState<number | undefined>(undefined);
  const [selectedDonutCurrency, setSelectedDonutCurrency] = useState(wallet.currency || "VND");

  const currencies = Array.from(new Set(state.wallets.map((item) => item.currency)));
  // Sample rows without a wallet ID belong to the first wallet with their currency.
  const rawDashboardData = dashboardSource === "sample"
    ? DASHBOARD_SAMPLE.filter((tx) => tx.type !== "transfer" && tx.currency === wallet.currency && (tx.wallet || state.wallets.find((item) => item.currency === tx.currency)?.id) === wallet.id)
    : state.transactions.filter((tx) => tx.type !== "transfer" && tx.wallet === wallet.id);

  const week = calendarWeek(dashboardWeek);
  const chartStart = week.start;
  const chartEnd = week.end;
  const weekdayNames = {
    vi: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
    en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  };
  const weekRangeLabel = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : lang === "zh" ? "zh-CN" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const formattedWeekRange = weekRangeLabel.format(new Date(chartStart + "T12:00:00")) + " – " + weekRangeLabel.format(new Date(chartEnd + "T12:00:00"));

  const dashboardCategories = Array.from(new Set(rawDashboardData.map((tx) => tx.category))).sort();

  // Filter transactions according to selected filters
  const dashboardRecords = rawDashboardData.filter((tx) => {
    if (tx.date < chartStart || tx.date > chartEnd) return false;
    if (dashboardCategory !== "all" && tx.category !== dashboardCategory) return false;
    if (dashboardType !== "all" && tx.type !== dashboardType) return false;
    return true;
  });

  // Calculate totals without floating point precision issues (in integer minor units / cents)
  const totalIncomeMinor = dashboardRecords.filter((t) => t.type === "income").reduce((acc, t) => acc + Math.round(t.amount * 100), 0);
  const totalExpenseMinor = dashboardRecords.filter((t) => t.type === "expense").reduce((acc, t) => acc + Math.round(t.amount * 100), 0);
  const totalIncome = totalIncomeMinor / 100;
  const totalExpense = totalExpenseMinor / 100;
  const totalNet = (totalIncomeMinor - totalExpenseMinor) / 100;
  const totalCount = dashboardRecords.length;

  const buckets = week.days.map((key, index) => {
    const txs = dashboardRecords.filter((tx) => tx.date === key);
    return {
      key,
      label: weekdayNames[lang][index],
      fullDateLabel: key,
      income: txs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100,
      expense: txs.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Math.round(tx.amount * 100), 0) / 100,
      count: txs.length,
    };
  });

  // Calculate chart scale
  const maxBucketVal = Math.max(1, ...buckets.flatMap((b) => [b.income, b.expense]));
  const scale = getNiceScale(maxBucketVal, 4);
  const niceMax = scale.max;

  // SVG Geometry
  const chartWidth = 960;
  const chartHeight = 240;
  const marginLeft = 65;
  const marginRight = 20;
  const marginTop = 20;
  const baselineY = 195;
  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = baselineY - marginTop;

  // View transactions handler to open Transactions tab with identical filters
  const openTransactionsWithFilters = () => {
    const query = new URLSearchParams();
    query.set("tab", "transactions");
    query.set("source", dashboardSource);
    query.set("type", dashboardType);
    query.set("category", dashboardCategory);
    query.set("from", chartStart);
    query.set("to", chartEnd);
    query.set("currency", dashboardCurrency);
    query.set("wallet", wallet.id);
    navigate("?" + query.toString());
  };

  // Transactions list for Transactions tab (or bottom list)
  const isFilteredFromDashboard = transactionsTab && (queryFrom || queryTo || queryType || queryCategory || querySource === "sample");
  const rawTxList = (transactionsTab && querySource === "sample")
    ? DASHBOARD_SAMPLE
    : state.transactions;

  const records = rawTxList.filter((t) => {
    if (!transactionsTab && t.wallet !== wallet.id && t.targetWallet !== wallet.id) return false;
    if (transactionsTab && queryWallet) {
      const sourceWallet = t.wallet || ("currency" in t ? state.wallets.find((item) => item.currency === t.currency)?.id : undefined);
      if (sourceWallet !== queryWallet && t.targetWallet !== queryWallet) return false;
    }
    if (isFilteredFromDashboard) {
      if (queryFrom && t.date < queryFrom) return false;
      if (queryTo && t.date > queryTo) return false;
      if (queryType && queryType !== "all" && t.type !== queryType) return false;
      if (queryCategory && queryCategory !== "all" && t.category !== queryCategory) return false;
      return (t.title || t.category || "").toLowerCase().includes(search.toLowerCase());
    }
    if (period === "Tháng" && !t.date.startsWith(year + "-" + String(month + 1).padStart(2, "0"))) return false;
    if (period === "Năm" && !t.date.startsWith(String(year))) return false;
    if (period === "Ngày" && t.date !== day) return false;
    if ((period === "Phạm vi tùy chỉnh" || period === "Tuần") && (t.date < from || t.date > to)) return false;
    return ((t.title || "") + t.category + (t.note || "")).toLowerCase().includes(search.toLowerCase());
  });

  const expense = records.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0);
  const income = records.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0);
  const allBalance = wallet.initial + state.transactions.reduce((a, t) => a + (t.wallet === wallet.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === wallet.id ? t.amount : 0), 0);

  const isInSelectedPeriod = (date: string) => {
    if (period === "Tháng" && !date.startsWith(year + "-" + String(month + 1).padStart(2, "0"))) return false;
    if (period === "Năm" && !date.startsWith(String(year))) return false;
    if (period === "Ngày" && date !== day) return false;
    if ((period === "Phạm vi tùy chỉnh" || period === "Tuần") && (date < from || date > to)) return false;
    return true;
  };
  const overviewRecords = state.transactions.filter((transaction) => isInSelectedPeriod(transaction.date));
  const incomeList = overviewRecords.filter((t) => t.type === "income");
  const expenseList = overviewRecords.filter((t) => t.type === "expense");

  const walletFlows = activeWallets.map((item) => {
    const walletRecords = overviewRecords.filter((transaction) => transaction.wallet === item.id);
    return {
      wallet: item,
      expense: walletRecords.filter((transaction) => transaction.type === "expense").reduce((total, transaction) => total + transaction.amount, 0),
      income: walletRecords.filter((transaction) => transaction.type === "income").reduce((total, transaction) => total + transaction.amount, 0),
    };
  });
  const totalsByCurrency = (field: "expense" | "income" | "net") => {
    const groups = new Map<string, number>();
    walletFlows.forEach((flow) => {
      const value = field === "net" ? flow.income - flow.expense : flow[field];
      groups.set(flow.wallet.currency, (groups.get(flow.wallet.currency) || 0) + value);
    });
    return Array.from(groups, ([curr, amount]) => ({ currency: curr, amount }));
  };
  const formatTotals = (field: "expense" | "income" | "net") => totalsByCurrency(field).map((total) => formatHomeMoney(total.amount, total.currency)).join(" · ");

  const walletBalanceTotals = currencies.map((curr) => {
    const amount = activeWallets.filter((item) => item.currency === curr).reduce((sum, item) => sum + item.initial + state.transactions.reduce((balance, transaction) => balance + (transaction.wallet === item.id ? (transaction.type === "income" ? transaction.amount : -transaction.amount) : transaction.targetWallet === item.id ? transaction.amount : 0), 0), 0);
    return formatHomeMoney(amount, curr);
  }).join(" · ");

  const incomeTotals = totalsByCurrency("income");
  const expenseTotals = totalsByCurrency("expense");

  const activeDonutCurrency = currencies.includes(selectedDonutCurrency) ? selectedDonutCurrency : (currencies[0] || wallet.currency || "VND");
  const currencyIncomeList = incomeList.filter((t) => (state.wallets.find((w) => w.id === t.wallet)?.currency || wallet.currency) === activeDonutCurrency);
  const currencyExpenseList = expenseList.filter((t) => (state.wallets.find((w) => w.id === t.wallet)?.currency || wallet.currency) === activeDonutCurrency);
  const donutIncomeBreakdown = getCategoryBreakdown(currencyIncomeList, activeDonutCurrency, INCOME_COLORS);
  const donutExpenseBreakdown = getCategoryBreakdown(currencyExpenseList, activeDonutCurrency, EXPENSE_COLORS);
  const donutIncomeTotal = currencyIncomeList.reduce((sum, t) => sum + t.amount, 0);
  const donutExpenseTotal = currencyExpenseList.reduce((sum, t) => sum + t.amount, 0);

  const formatLocalizedDate = (isoDate: string) => {
    if (!isoDate || !isoDate.includes("-")) return isoDate;
    const parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    if (lang === "zh") return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    if (lang === "en") return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}/${parts[0]}`;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const selectedPeriodText = period === "Tháng"
    ? t.formatMonthYear(month, year)
    : period === "Năm"
      ? t.formatYearOnly(year)
      : period === "Ngày"
        ? t.formatDayPeriod(formatLocalizedDate(day))
        : period === "Tuần"
          ? t.formatWeekPeriod(formatLocalizedDate(from), formatLocalizedDate(to))
          : period === "Mọi thời gian"
            ? t.allTimePeriod
            : `${formatLocalizedDate(from)} – ${formatLocalizedDate(to)}`;

  const periodDateLabel = period === "Tháng"
    ? t.formatMonthYear(month, year)
    : period === "Năm"
      ? t.formatYearOnly(year)
      : period === "Ngày"
        ? formatLocalizedDate(day)
        : period === "Tuần"
          ? `${formatLocalizedDate(from)} – ${formatLocalizedDate(to)}`
          : period === "Phạm vi tùy chỉnh"
            ? `${formatLocalizedDate(from)} – ${formatLocalizedDate(to)}`
            : "";

  const setWeekFromDate = (dateStr: string) => {
    try {
      const { start, end } = calendarWeek(dateStr);
      setFrom(start);
      setTo(end);
    } catch {
      const d = new Date(dateStr + "T12:00:00");
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() - (d.getDay() + 6) % 7);
        const s = localDateKey(d);
        d.setDate(d.getDate() + 6);
        const e = localDateKey(d);
        setFrom(s);
        setTo(e);
      }
    }
  };

  const shiftWeek = (delta: number) => {
    try {
      const newStart = shiftCalendarWeek(from, delta);
      const { start, end } = calendarWeek(newStart);
      setFrom(start);
      setTo(end);
    } catch {}
  };

  const openPeriodDateModal = () => {
    if (period === "Tháng") setModal("pickMonth");
    else if (period === "Năm") setModal("pickYear");
    else if (period === "Ngày") setModal("pickDay");
    else if (period === "Tuần") setModal("pickWeek");
    else if (period === "Phạm vi tùy chỉnh") setModal("pickCustomRange");
  };

  useEffect(() => {
    if (!overviewCardRef.current) return;
    const updateH = () => {
      if (overviewCardRef.current && window.innerWidth > 640) {
        setOverviewHeight(Math.round(overviewCardRef.current.offsetHeight));
      } else {
        setOverviewHeight(undefined);
      }
    };
    updateH();
    const ro = new ResizeObserver(() => updateH());
    ro.observe(overviewCardRef.current);
    window.addEventListener("resize", updateH);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateH);
    };
  }, [period, month, year, day, from, to, incomeTotals.length, expenseTotals.length]);

  const list = transactionsTab ? records : records.filter((t) => t.type === type);
  const close = useCallback(() => setModal(""), []);
  const addTransaction = () => navigate(state.settings.manual ? "addTransaction" : "addTransactionChatMode");
  const walletName = (name: string) => resolveWalletDisplayName(name, lang);
  const periodDisplay = (p: string) => {
    if (p === "Ngày") return t.periodDay;
    if (p === "Tuần") return t.periodWeek;
    if (p === "Tháng") return t.periodMonth;
    if (p === "Năm") return t.periodYear;
    if (p === "Mọi thời gian") return t.periodAllTime;
    if (p === "Phạm vi tùy chỉnh") return t.periodCustomRange;
    return p;
  };
  const periodControls = (
    <div className="r-period-controls">
      <button type="button" onClick={() => setModal("period")} className="r-period">
        {periodDisplay(period)}
        <CalendarDays size={17} />
        <ChevronDown size={17} />
      </button>
      {period !== "Mọi thời gian" && (
        <button
          type="button"
          onClick={openPeriodDateModal}
          className="r-period-date"
          aria-label={t.selectDetailedTimeAria}
        >
          {periodDateLabel}
          <ChevronDown size={15} />
        </button>
      )}
    </div>
  );
  const transactionRows = (
    <div className="r-record-list">
      {list.map((tx) => {
        const txW = state.wallets.find((item) => item.id === tx.wallet);
        const localizedCat = resolveCategoryDisplayName(tx.category, lang);
        return (
          <button key={tx.id} type="button" className="r-record" onClick={() => navigate("editTransaction?id=" + tx.id)}>
            <span className="r-category-symbol">
              {transactionsTab ? (tx.category === "Thức ăn & Đồ uống" ? "🍔" : tx.type === "income" ? "💰" : "🛍️") : tx.type === "income" ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            </span>
            <span>
              <b>{localizedCat}</b>
              <small>{tx.title || localizedCat}{txW?.archived ? t.archivedWalletSuffix : ""} · {formatLocalizedDate(tx.date)}</small>
            </span>
            <b className={tx.type === "income" ? "r-income" : "r-expense"}>
              {tx.type === "income" ? "+" : "−"}{money(tx.amount, wallet.currency)}
            </b>
          </button>
        );
      })}
    </div>
  );

  const focusedBucket = buckets.find((b) => b.key === focusedBucketKey);

  return <div className={walletSettingsMode ? "fb-wallet-management-host" : "r-dashboard " + (transactionsTab ? "r-transactions" : "r-home fb-home")}>
    {walletSettingsMode ? <WalletSettingsDirectory state={state} navigate={navigate} onManage={openManageWalletModal} onAddWallet={openAddWalletModal} /> : transactionsTab ? <>
      <div className="r-transactions-heading"><h1>{t.transactionsHeading}</h1><div><button type="button" className="r-icon-button" onClick={() => setModal("search")} aria-label={t.searchTransactionsAria}><Search size={22} /></button><button type="button" className="r-icon-button" onClick={() => navigate("calendar")} aria-label={t.calendarAria}><CalendarDays size={22} /></button></div></div>
      <button
        type="button"
        className="r-wallet-chip"
        onClick={() => setModal("wallet")}
        aria-label={t.selectWalletAria(walletName(wallet.name))}
      >
        <Icon code="f555" />
        {walletName(wallet.name)}
        <ChevronDown size={13} />
      </button>
      {periodControls}
      <button type="button" className="r-totals-strip" onClick={() => setModal("totals")}><span className="r-expense">▼ {money(expense, wallet.currency)}</span><span className="r-income">▲ {money(income, wallet.currency)}</span><span>∑ {money(income - expense, wallet.currency)}</span></button>
      {list.length === 0 ? <EmptyState title={t.emptyTransactionsPeriodTitle} text={t.emptyTransactionsPeriodText} className="r-dashboard-empty" /> : transactionRows}
      <button type="button" className="r-fab" aria-label={t.addTransaction} onClick={addTransaction}><Plus size={32} /></button>
    </> : <>
      <FinBridgeHeader
        lang={lang}
        theme={String(state.settings.theme || "light")}
        currentLanguage={String(state.settings.language || "Tiếng Việt")}
        onOpenCalendar={() => setCalendarLedgerOpen(true)}
        onToggleTheme={() => updateState((s) => ({ ...s, settings: { ...s.settings, theme: s.settings.theme === "dark" ? "light" : "dark" } }))}
        onSelectLanguage={(val) => updateState((s) => ({ ...s, settings: { ...s.settings, language: val } }))}
      />
      <div className="fb-home-intro">
        <div>
          <p className="fb-eyebrow">{t.overviewEyebrow}</p>
          <h1>{state.settings.name && state.settings.name !== "." ? `${t.welcomePrefix}${state.settings.name}` : t.defaultGreeting}</h1>
          <p>{t.introSub}</p>
        </div>
        <button type="button" className="fb-add-button" onClick={addTransaction}>
          <Plus size={18} />
          <span>{t.addTransaction}</span>
        </button>
      </div>
      <FinancialOutlook />
      <section className="fb-wallet-section" aria-label={t.yourWallets}>
        <div className="fb-section-heading">
          <div>
            <h2>{t.yourWallets}</h2>
            <span>
              {lang === "en"
                ? `${activeWallets.length} ${t.activeWalletsSuffix}${activeWallets.length === 1 ? "" : "s"}`
                : `${activeWallets.length} ${t.activeWalletsSuffix}`}
              {archivedWallets.length > 0 ? ` · ${archivedWallets.length} ${t.unlinkedSuffix}` : ""}
            </span>
          </div>
          {archivedWallets.length > 0 && (
            <button
              type="button"
              className="fb-archived-wallets-chip"
              onClick={() => openManageWalletModal(archivedWallets[0].id)}
              title={t.unlinkedChip(archivedWallets.length)}
            >
              <Ban size={13} />
              <span>{t.unlinkedChip(archivedWallets.length)}</span>
            </button>
          )}
        </div>
        <div className="r-wallets">
          {activeWallets.map((w) => {
            const localizedName = walletName(w.name);
            return (
              <div key={w.id} className={"r-wallet-card " + (w.id === wallet.id ? "is-selected" : "")}>
                <button
                  type="button"
                  onClick={() => setWalletId(w.id)}
                  className="r-wallet-content"
                  aria-label={t.selectWalletAria(localizedName)}
                  aria-pressed={w.id === wallet.id}
                >
                  <Wallet size={19} />
                  <span>{localizedName}</span>
                  <b>{formatHomeMoney(w.initial + state.transactions.reduce((a, t) => a + (t.wallet === w.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === w.id ? t.amount : 0), 0), w.currency)}</b>
                </button>
                <button
                  type="button"
                  className="r-wallet-edit"
                  aria-label={t.manageWalletAria(localizedName)}
                  onClick={() => openManageWalletModal(w.id)}
                >
                  <Pencil size={14} />
                </button>
              </div>
            );
          })}
          <button type="button" className="r-new-wallet" onClick={openAddWalletModal}>
            <Plus size={20} />
            <span>{t.addWallet}</span>
          </button>
        </div>
      </section>
      <section className="fb-finance-dashboard" aria-label="Dashboard dòng tiền">
        <section ref={overviewCardRef} className="fb-overview fb-finance-overview"><div className="fb-section-heading"><div><h2>{t.flowThisPeriod}</h2><p className="fb-section-note">{t.flowSub}</p></div>{periodControls}</div>
          <div className="r-summary fb-flow-summary-container">
            <div className="fb-flow-vertical-stack">
              <div className="fb-flow-row r-income" onClick={() => setModal("flowIncomeDetails")} role="button" tabIndex={0}>
                <div className="fb-flow-row-header">
                  <span className="fb-flow-row-label">
                    <ArrowUpRight size={18} />
                    <span>{t.totalIncome}</span>
                  </span>
                  <small>{t.fromAllWalletsInPeriod}</small>
                </div>
                <div className="fb-flow-row-amounts">
                  {incomeTotals.map((item) => (
                    <div key={item.currency} className="fb-flow-amount-line">
                      <b>+{formatHomeMoney(item.amount, item.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>

              <div className="fb-flow-row r-expense" onClick={() => setModal("flowExpenseDetails")} role="button" tabIndex={0}>
                <div className="fb-flow-row-header">
                  <span className="fb-flow-row-label">
                    <ArrowDownRight size={18} />
                    <span>{t.totalExpense}</span>
                  </span>
                  <small>{t.fromAllWalletsInPeriod}</small>
                </div>
                <div className="fb-flow-row-amounts">
                  {expenseTotals.map((item) => (
                    <div key={item.currency} className="fb-flow-amount-line">
                      <b>−{formatHomeMoney(item.amount, item.currency)}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fb-flow-footer-row">
              <p className="fb-currency-note">{t.currencyNote}</p>
              <button type="button" className="fb-flow-detail-link" onClick={() => setModal("flowComparisonChart")}>
                <span>{t.details}</span>
                <Info size={13} />
              </button>
            </div>
          </div>
        </section>

        {/* Production-grade Spending Trend card */}
        <section className="fb-activity fb-spending-dashboard" aria-labelledby="fb-spending-trend-heading">
          <div className="fb-section-heading">
            <div>
              <h2 id="fb-spending-trend-heading">{t.cardTitle}</h2>
              <p className="fb-section-note">{t.cardSubtitle}</p>
            </div>
            <button type="button" className="fb-view-transactions" onClick={openTransactionsWithFilters}>
              {t.viewTransactions}<ArrowRight size={15} />
            </button>
          </div>

          <div className="fb-chart-controls">
            <div className="fb-chart-date-bar">
              <div className="fb-chart-nav-cluster">
                <button
                  type="button"
                  className="fb-nav-btn prev"
                  aria-label={t.previousWeek}
                  onClick={() => { setDashboardWeek(shiftCalendarWeek(chartStart, -1)); setFocusedBucketKey(null); }}
                >
                  ‹
                </button>
                <div
                  className="fb-chart-range-pill"
                  role="button"
                  tabIndex={0}
                  title={t.selectWeek}
                  onClick={() => {
                    const input = dateInputRef.current;
                    if (input) {
                      if ("showPicker" in input && typeof input.showPicker === "function") {
                        try { input.showPicker(); return; } catch {}
                      }
                      input.focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      const input = dateInputRef.current;
                      if (input) {
                        if ("showPicker" in input && typeof input.showPicker === "function") {
                          try { input.showPicker(); return; } catch {}
                        }
                        input.focus();
                      }
                    }
                  }}
                >
                  <CalendarDays size={15} />
                  <span>{formattedWeekRange}</span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    aria-label={t.selectWeek}
                    value={dashboardWeek}
                    tabIndex={-1}
                    className="fb-hidden-date-input"
                    onChange={(event) => {
                      if (event.currentTarget.validity.valid && event.currentTarget.value) {
                        setDashboardWeek(calendarWeek(event.currentTarget.value).start);
                        setFocusedBucketKey(null);
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="fb-nav-btn next"
                  aria-label={t.nextWeek}
                  onClick={() => { setDashboardWeek(shiftCalendarWeek(chartStart, 1)); setFocusedBucketKey(null); }}
                >
                  ›
                </button>
                <button
                  type="button"
                  className="fb-chart-this-week-btn"
                  onClick={() => { setDashboardWeek(calendarWeek(localDateKey(new Date())).start); setFocusedBucketKey(null); }}
                >
                  {t.currentWeek}
                </button>
              </div>
            </div>

            <div className="fb-chart-filter-bar">
              {/* Type filter */}
              <div className="r-type-pills" role="radiogroup" aria-label={t.typeFilter}>
                <button type="button" role="radio" aria-checked={dashboardType === "all"} className={dashboardType === "all" ? "active" : ""} onClick={() => setDashboardType("all")}>{t.typeAll}</button>
                <button type="button" role="radio" aria-checked={dashboardType === "expense"} className={dashboardType === "expense" ? "active" : ""} onClick={() => setDashboardType("expense")}>{t.typeExpense}</button>
                <button type="button" role="radio" aria-checked={dashboardType === "income"} className={dashboardType === "income" ? "active" : ""} onClick={() => setDashboardType("income")}>{t.typeIncome}</button>
              </div>

              {/* Category filter */}
              <label className="fb-chart-select">
                <span className="sr-only">{t.categoryFilter}</span>
                <select aria-label={t.categoryFilter} value={dashboardCategory} onChange={(e) => setDashboardCategory(e.target.value)}>
                  <option value="all">{t.allCategories}</option>
                  {dashboardCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>

              <label className="fb-chart-select">
                <span className="sr-only">{t.accountFilter}</span>
                <select aria-label={t.accountFilter} value={wallet.id} onChange={(event) => { setWalletId(event.target.value); setDashboardCategory("all"); setFocusedBucketKey(null); }}>
                  {state.wallets.map((item) => <option key={item.id} value={item.id}>{walletName(item.name)} · {item.currency}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>
            </div>
          </div>

          {dashboardRecords.length === 0 && <p className="fb-week-empty-note" role="status">{t.emptyText}</p>}
          {(
            <>
              {/* Legend */}
              <div className="fb-chart-legend" aria-hidden="true">
                <span className={dashboardType === "expense" ? "is-muted" : ""}>
                  <i className="fb-chart-dot income" />{t.typeIncome}
                </span>
                <span className={dashboardType === "income" ? "is-muted" : ""}>
                  <i className="fb-chart-dot expense" />{t.typeExpense}
                </span>
              </div>

              {/* Grouped Columns Chart */}
              <div className="fb-chart" role="region" aria-label={t.cardTitle}>
                {focusedBucket && (
                  <div className="fb-chart-tooltip" role="tooltip">
                    <span className="fb-chart-tooltip-period">{focusedBucket.fullDateLabel}</span>
                    {dashboardType !== "expense" && <span>{t.summaryIncome}: {formatHomeMoney(focusedBucket.income, dashboardCurrency)}</span>}
                    {dashboardType !== "income" && <span>{t.summaryExpense}: {formatHomeMoney(focusedBucket.expense, dashboardCurrency)}</span>}
                    {dashboardType === "all" && <span>{t.summaryNet}: {formatHomeMoney(focusedBucket.income - focusedBucket.expense, dashboardCurrency, true)}</span>}
                    <span>{t.tooltipCount}: {focusedBucket.count}</span>
                  </div>
                )}

                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                  <defs>
                    <pattern id="fb-income-stripes" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                      <line x1="0" y1="0" x2="0" y2="6" stroke="#0d9488" strokeWidth="2.5" />
                      <line x1="3" y1="0" x2="3" y2="6" stroke="#ccfbf1" strokeWidth="3.5" />
                    </pattern>
                  </defs>

                  {/* Horizontal gridlines and left Y-axis ticks */}
                  {scale.ticks.map((tickVal) => {
                    const y = baselineY - (tickVal / niceMax) * plotHeight;
                    return (
                      <g key={tickVal}>
                        <line x1={marginLeft} x2={chartWidth - marginRight} y1={y} y2={y} className="fb-chart-gridline" />
                        <text x={marginLeft - 8} y={y + 3.5} textAnchor="end" className="fb-chart-tick">
                          {formatCompactMoney(tickVal, dashboardCurrency, lang)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Zero Baseline */}
                  <line x1={marginLeft} x2={chartWidth - marginRight} y1={baselineY} y2={baselineY} stroke="#94a3b8" strokeWidth="1.5" />

                  {/* Grouped Columns */}
                  {buckets.map((b, i) => {
                    const countB = buckets.length;
                    const bW = plotWidth / countB;
                    const centerX = marginLeft + (i + 0.5) * bW;

                    const both = dashboardType === "all";
                    const maxBarW = both ? Math.min(Math.max(6, (bW * 0.65 - 6) / 2), 34) : Math.min(Math.max(10, bW * 0.55), 54);
                    const gap = Math.min(6, maxBarW * 0.25);

                    const incH = b.income > 0 ? Math.max(3, (b.income / niceMax) * plotHeight) : 0;
                    const expH = b.expense > 0 ? Math.max(3, (b.expense / niceMax) * plotHeight) : 0;

                    const incX = both ? centerX - maxBarW - gap / 2 : centerX - maxBarW / 2;
                    const expX = both ? centerX + gap / 2 : centerX - maxBarW / 2;

                    const incY = baselineY - incH;
                    const expY = baselineY - expH;

                    const showLabel = countB <= 12 || i === 0 || i === countB - 1 || (countB <= 24 ? i % 2 === 0 : i % Math.ceil(countB / 8) === 0);

                    return (
                      <g
                        key={b.key}
                        tabIndex={0}
                        role="button"
                        aria-label={`${b.fullDateLabel}: ${t.summaryIncome} ${formatHomeMoney(b.income, dashboardCurrency)}, ${t.summaryExpense} ${formatHomeMoney(b.expense, dashboardCurrency)}`}
                        className="fb-bar-group"
                        onMouseEnter={() => setFocusedBucketKey(b.key)}
                        onMouseLeave={() => setFocusedBucketKey((k) => k === b.key ? null : k)}
                        onFocus={() => setFocusedBucketKey(b.key)}
                        onBlur={() => setFocusedBucketKey((k) => k === b.key ? null : k)}
                      >
                        {/* Income Bar */}
                        {dashboardType !== "expense" && incH > 0 && (
                          <rect x={incX} y={incY} width={maxBarW} height={incH} className="fb-chart-bar-income" />
                        )}

                        {/* Expense Bar */}
                        {dashboardType !== "income" && expH > 0 && (
                          <rect x={expX} y={expY} width={maxBarW} height={expH} className="fb-chart-bar-expense" />
                        )}

                        {/* X-axis label */}
                        {showLabel && (
                          <text x={centerX} y={baselineY + 16} textAnchor="middle" className="fb-chart-x-label">
                            {b.label}
                          </text>
                        )}
                        <text x={centerX} y={baselineY + 29} textAnchor="middle" className="fb-chart-x-label">
                          {b.key.slice(8)}/{b.key.slice(5, 7)}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Visually hidden accessible data table */}
                <table className="sr-only">
                  <caption>{t.tableCaption}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t.tableColPeriod}</th>
                      <th scope="col">{t.tableColIncome}</th>
                      <th scope="col">{t.tableColExpense}</th>
                      <th scope="col">{t.tableColNet}</th>
                      <th scope="col">{t.tableColCount}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.key}>
                        <td>{b.fullDateLabel}</td>
                        <td>{formatHomeMoney(b.income, dashboardCurrency)}</td>
                        <td>{formatHomeMoney(b.expense, dashboardCurrency)}</td>
                        <td>{formatHomeMoney(b.income - b.expense, dashboardCurrency, true)}</td>
                        <td>{b.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary line */}
              <div className="fb-chart-summary">
                <div className="fb-chart-summary-data">
                  <span>{t.summaryIncome} {formatHomeMoney(totalIncome, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryExpense} {formatHomeMoney(totalExpense, dashboardCurrency)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t.summaryNet} {formatHomeMoney(totalNet, dashboardCurrency, true)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{totalCount} {t.summaryTransactions}</span>
                </div>
                {dashboardSource === "sample" && <span className="fb-env-badge">{t.simulated}</span>}
              </div>
            </>
          )}
        </section>
        <section className="fb-wallet-flow-card" style={overviewHeight ? { height: `${overviewHeight}px`, maxHeight: `${overviewHeight}px` } : undefined}>
          <div className="fb-section-heading">
            <div>
              <h2>{t.walletFlowTitle}</h2>
              <p className="fb-section-note">{t.walletFlowSub}</p>
            </div>
            <button type="button" className="fb-view-transactions" onClick={openAddWalletModal}>
              <Plus size={15} />{t.addWallet}
            </button>
          </div>
          <div className="fb-wallet-flow-list">
            {walletFlows.map((flow) => (
              <button
                type="button"
                key={flow.wallet.id}
                className={flow.wallet.id === wallet.id ? "is-selected" : ""}
                onClick={() => { setWalletId(flow.wallet.id); setDashboardCategory("all"); setFocusedBucketKey(null); }}
              >
                <span>
                  <b>{walletName(flow.wallet.name)}</b>
                  <small>{flow.wallet.currency}</small>
                </span>
                <span className="fb-wallet-flow-numbers">
                  <small className="r-expense">{t.expShort}{formatHomeMoney(flow.expense, flow.wallet.currency)}</small>
                  <small className="r-income">{t.incShort}{formatHomeMoney(flow.income, flow.wallet.currency)}</small>
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <button type="button" className="fb-manage-wallets" onClick={() => openManageWalletModal(wallet.id)}>
            {t.manageWallets}<ArrowRight size={16} />
          </button>
        </section>
      </section>
      <div className="fb-workspace"><div className="fb-main-column">
        <section className="fb-overview"><div className="fb-section-heading"><h2>{t.flowThisPeriod}</h2>{periodControls}</div>
          <button type="button" className="r-summary" onClick={() => setModal("totals")} aria-label={t.viewCashFlowDetailsAria}><div className="r-summary-top"><span><small>{t.netChange}</small><b>{formatHomeMoney(income - expense, wallet.currency, true)}</b></span><span className="fb-detail-label">{t.details}<Info size={16} /></span></div><div className="r-summary-cards"><div className="r-expense"><span><ArrowDownRight size={18} />{t.cost}</span><b>{formatHomeMoney(expense, wallet.currency)}</b></div><div className="r-income"><span><ArrowUpRight size={18} />{t.income}</span><b>{formatHomeMoney(income, wallet.currency)}</b></div></div></button>
        </section>
        <section className="fb-activity"><div className="fb-section-heading"><h2>{t.txThisPeriod}</h2><div className="r-type-pills"><button type="button" className={type === "expense" ? "active" : ""} onClick={() => setType("expense")}>{t.cost}</button><button type="button" className={type === "income" ? "active" : ""} onClick={() => setType("income")}>{t.income}</button></div></div>
          {list.length === 0 ? <div className="fb-empty"><span className="fb-empty-icon"><ReceiptText size={26} /></span><h3>{type === "expense" ? t.noExpensesThisPeriod : t.noIncomesThisPeriod}</h3><p>{t.recordTxToTrackFlow}</p><button type="button" className="fb-empty-action" onClick={addTransaction}><Plus size={16} />{t.addTransaction}</button></div> : transactionRows}
        </section>
      </div><aside className="fb-side-column">{state.settings.totalBalance && <section className="fb-balance-card"><span className="fb-balance-icon"><Wallet size={20} /></span><p>{t.selectedWalletBalance}</p><h2>{formatHomeMoney(allBalance, wallet.currency)}</h2><small>{walletName(wallet.name)} · {wallet.currency}</small><div className="fb-balance-decor" aria-hidden="true"><span /><span /><span /><span /><span /></div><button type="button" onClick={() => openManageWalletModal(wallet.id)}>{t.manageWallets}<ArrowRight size={16} /></button></section>}
        <section className="fb-habit-card"><p className="fb-eyebrow">{t.habitEyebrow}</p><h3>{t.habitTitle}</h3><p>{t.habitSub}</p><button type="button" onClick={() => navigate("?tab=transactions")}>{t.viewTransactionsAction}<ArrowRight size={16} /></button></section>
      </aside></div>
      <button type="button" className="r-fab fb-mobile-add" aria-label={t.addTransaction} onClick={addTransaction}><Plus size={26} /></button>
    </>}
    {modal && <Modal
      title={modal === "period" ? t.periodModalTitle
        : modal === "search" ? t.searchModalTitle
        : modal === "wallet" ? t.selectWalletModalTitle
        : modal === "homeTotals" ? t.homeTotalsModalTitle
        : modal === "addWallet" ? t.addWalletModalTitle
        : modal === "flowIncomeDetails" ? t.flowIncomeModalTitle
        : modal === "flowExpenseDetails" ? t.flowExpenseModalTitle
        : modal === "flowComparisonChart" ? t.flowComparisonModalTitle
        : modal === "manageWallet" ? t.manageWalletModalTitle(walletName(state.wallets.find((w) => w.id === editingWalletId)?.name || wallet.name))
        : modal === "pickDay" ? t.pickDayModalTitle
        : modal === "pickWeek" ? t.pickWeekModalTitle
        : modal === "pickMonth" ? t.pickMonthModalTitle
        : modal === "pickYear" ? t.pickYearModalTitle
        : modal === "pickCustomRange" ? t.pickCustomRangeModalTitle
        : undefined}
      onClose={close}
      sheet={["period", "search", "wallet"].includes(modal)}
      wide={["flowComparisonChart", "manageWallet"].includes(modal)}
    >
      {modal === "period" && (
        <div className="r-period-options">
          {["Ngày", "Tuần", "Tháng", "Năm", "Mọi thời gian", "Phạm vi tùy chỉnh"].map((p) => (
            <button
              key={p}
              type="button"
              className={p === period ? "is-selected" : ""}
              onClick={() => {
                setPeriod(p);
                if (p === "Tuần") {
                  setWeekFromDate(day);
                }
                if (p === "Phạm vi tùy chỉnh") setModal("pickCustomRange");
                else if (p === "Ngày") setModal("pickDay");
                else if (p === "Tuần") setModal("pickWeek");
                else if (p === "Tháng") setModal("pickMonth");
                else if (p === "Năm") setModal("pickYear");
                else setModal("");
              }}
            >
              <CalendarDays size={22} />
              {periodDisplay(p)}
            </button>
          ))}
        </div>
      )}

      {modal === "pickDay" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">{t.pickDayDesc}</p>
          <div className="fb-picker-field">
            <label className="fb-picker-label" htmlFor="pick-day-input">{t.pickDayLabel}</label>
            <input
              id="pick-day-input"
              type="date"
              className="fb-input"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className={"fb-quick-date-btn " + (day === "2026-10-12" ? "active" : "")}
              onClick={() => setDay("2026-10-12")}
            >
              {t.today}
            </button>
            <button
              type="button"
              className={"fb-quick-date-btn " + (day === "2026-10-11" ? "active" : "")}
              onClick={() => setDay("2026-10-11")}
            >
              {t.yesterday}
            </button>
          </div>
          <div className="fb-picker-selected-preview">
            <span>{t.selectedDayLabel}</span>
            <b>{formatLocalizedDate(day)}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.closeButton}</button>
            <button type="button" className="r-primary" onClick={close}>{t.confirmButton}</button>
          </div>
        </div>
      )}

      {modal === "pickWeek" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">{t.pickWeekDesc}</p>
          <div className="fb-week-stepper">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => shiftWeek(-1)}
              aria-label={t.previousWeek}
            >
              ‹
            </button>
            <div className="fb-week-stepper-display">
              <span className="fb-week-stepper-label">{t.currentWeek}</span>
              <b>{formatLocalizedDate(from)} – {formatLocalizedDate(to)}</b>
            </div>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => shiftWeek(1)}
              aria-label={t.nextWeek}
            >
              ›
            </button>
          </div>
          <div className="fb-picker-field">
            <label className="fb-picker-label" htmlFor="pick-week-date">{t.pickWeekOrChooseDate}</label>
            <input
              id="pick-week-date"
              type="date"
              className="fb-input"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setWeekFromDate(e.target.value);
              }}
            />
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setDay("2026-10-12");
                setWeekFromDate("2026-10-12");
              }}
            >
              {t.thisWeek}
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setDay("2026-10-05");
                setWeekFromDate("2026-10-05");
              }}
            >
              {t.previousWeek}
            </button>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.closeButton}</button>
            <button type="button" className="r-primary" onClick={close}>{t.confirmButton}</button>
          </div>
        </div>
      )}

      {modal === "pickMonth" && (
        <div className="fb-date-picker-modal">
          <div className="fb-month-year-header">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year - 1)}
              aria-label={t.previousYearAria}
            >
              ‹
            </button>
            <span className="fb-year-display">{t.formatYearOnly(year)}</span>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year + 1)}
              aria-label={t.nextYearAria}
            >
              ›
            </button>
          </div>
          <div className="fb-month-grid">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                type="button"
                className={"fb-month-cell " + (i === month ? "active" : "")}
                onClick={() => setMonth(i)}
              >
                {t.monthNamesShort[i]}
              </button>
            ))}
          </div>
          <div className="fb-picker-selected-preview">
            <span>{t.selectedMonthLabel}</span>
            <b>{t.formatMonthYear(month, year)}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.closeButton}</button>
            <button type="button" className="r-primary" onClick={close}>{t.confirmButton}</button>
          </div>
        </div>
      )}

      {modal === "pickYear" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">{t.pickYearDesc}</p>
          <div className="fb-year-stepper">
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year - 1)}
              aria-label={t.previousYearAria}
            >
              ‹
            </button>
            <span className="fb-big-year">{year}</span>
            <button
              type="button"
              className="fb-stepper-btn"
              onClick={() => setYear(year + 1)}
              aria-label={t.nextYearAria}
            >
              ›
            </button>
          </div>
          <div className="fb-year-grid">
            {[2023, 2024, 2025, 2026, 2027, 2028].map((y) => (
              <button
                key={y}
                type="button"
                className={"fb-year-cell " + (y === year ? "active" : "")}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.closeButton}</button>
            <button type="button" className="r-primary" onClick={close}>{t.confirmButton}</button>
          </div>
        </div>
      )}

      {modal === "pickCustomRange" && (
        <div className="fb-date-picker-modal">
          <p className="fb-picker-subheading">{t.pickCustomRangeDesc}</p>
          <div className="fb-range-inputs">
            <div className="fb-picker-field">
              <label className="fb-picker-label" htmlFor="custom-from-date">{t.fromDate}</label>
              <input
                id="custom-from-date"
                type="date"
                className="fb-input"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="fb-picker-field">
              <label className="fb-picker-label" htmlFor="custom-to-date">{t.toDate}</label>
              <input
                id="custom-to-date"
                type="date"
                className="fb-input"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="fb-quick-date-row">
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-10-05");
                setTo("2026-10-12");
              }}
            >
              {t.period7dPast}
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-09-12");
                setTo("2026-10-12");
              }}
            >
              {t.period30dPast}
            </button>
            <button
              type="button"
              className="fb-quick-date-btn"
              onClick={() => {
                setFrom("2026-10-01");
                setTo("2026-10-31");
              }}
            >
              {t.thisMonth}
            </button>
          </div>
          <div className="fb-picker-selected-preview">
            <span>{t.rangePreviewLabel}</span>
            <b>{formatLocalizedDate(from)} – {formatLocalizedDate(to)}</b>
          </div>
          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.cancel}</button>
            <button type="button" className="r-primary" onClick={close}>{t.applyButton}</button>
          </div>
        </div>
      )}

      {modal === "search" && (
        <div className="r-form">
          <input
            aria-label={t.searchModalTitle}
            placeholder={t.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="r-primary" onClick={close}>
            {t.searchButton}
          </button>
          {search && (
            <button
              type="button"
              className="r-secondary"
              onClick={() => {
                setSearch("");
                close();
              }}
            >
              <X size={16} />
              {t.clearSearchButton}
            </button>
          )}
        </div>
      )}
      {modal === "wallet" && <div className="r-wallet-options">{state.wallets.map((w) => <button key={w.id} type="button" onClick={() => { setWalletId(w.id); close(); }} className={w.id === wallet.id ? "active" : ""}><Icon code="f555" />{walletName(w.name)}<span>{formatHomeMoney(w.initial, w.currency)}</span></button>)}</div>}
      {modal === "homeTotals" && (
        <div className="r-breakdown">
          <p><span>{t.totalAllWalletsBalance}</span>{walletBalanceTotals}</p>
          <p className="r-expense"><span>{t.totalExpenseFromWallets}</span>{formatTotals("expense")}</p>
          <p className="r-income"><span>{t.totalIncomeFromWallets}</span>{formatTotals("income")}</p>
          <p className="r-breakdown-total"><span>{t.netChange}</span>{formatTotals("net")}</p>
          <small className="fb-modal-note">{t.currencyNote}</small>
        </div>
      )}
      {modal === "totals" && (
        <div className="r-breakdown">
          <p className="r-expense"><span>{t.cost}</span>{formatHomeMoney(expense, wallet.currency)}</p>
          <p className="r-income"><span>{t.income}</span>{formatHomeMoney(income, wallet.currency)}</p>
          <p><span>{t.transfer}</span>{formatHomeMoney(records.filter((r) => r.type === "transfer").reduce((a, r) => a + r.amount, 0), wallet.currency)}</p>
          <p className="r-breakdown-total"><span>{t.totalSum}</span>{formatHomeMoney(income - expense, wallet.currency, true)}</p>
        </div>
      )}

      {modal === "addWallet" && (
        <form className="fb-add-wallet-form" onSubmit={handleCreateWallet}>
          <p className="fb-modal-subheading">{t.addWalletDesc}</p>

          <div className="fb-form-group">
            <label className="fb-form-label">{t.walletTypeLabel}</label>
            <div className="r-two-options">
              <button
                type="button"
                className={newWalletType === "cash" ? "active" : ""}
                onClick={() => setNewWalletType("cash")}
              >
                <Wallet size={16} />
                <span>{t.walletTypeCash}</span>
              </button>
              <button
                type="button"
                className={newWalletType === "credit" ? "active" : ""}
                onClick={() => setNewWalletType("credit")}
              >
                <ReceiptText size={16} />
                <span>{t.walletTypeCredit}</span>
              </button>
            </div>
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-name">{t.walletNameLabel}</label>
            <input
              id="new-wallet-name"
              type="text"
              required
              placeholder={t.walletNamePlaceholder}
              value={newWalletName}
              onChange={(e) => setNewWalletName(e.target.value)}
              className="fb-input"
            />
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-currency">{t.walletCurrencyLabel}</label>
            <select
              id="new-wallet-currency"
              value={newWalletCurrency}
              onChange={(e) => setNewWalletCurrency(e.target.value)}
              className="fb-select"
            >
              {t.currencyOptionsList.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="fb-form-group">
            <label className="fb-form-label" htmlFor="new-wallet-initial">
              {newWalletType === "credit" ? t.unsettledBalanceLabel : t.initialBalanceLabel}
            </label>
            <input
              id="new-wallet-initial"
              type="number"
              step="any"
              placeholder="0"
              value={newWalletAmount}
              onChange={(e) => setNewWalletAmount(e.target.value)}
              className="fb-input"
            />
          </div>

          {newWalletType === "credit" && (
            <div className="fb-form-group">
              <label className="fb-form-label" htmlFor="new-wallet-limit">{t.creditLimitLabel}</label>
              <input
                id="new-wallet-limit"
                type="number"
                step="any"
                required
                placeholder={t.creditLimitPlaceholder}
                value={newWalletLimit}
                onChange={(e) => setNewWalletLimit(e.target.value)}
                className="fb-input"
              />
            </div>
          )}

          <div className="fb-modal-actions">
            <button type="button" className="r-secondary" onClick={close}>{t.cancel}</button>
            <button type="submit" className="r-primary">{t.saveWallet}</button>
          </div>
        </form>
      )}

      {modal === "flowIncomeDetails" && (
        <div className="fb-flow-details-modal">
          <div className="fb-tx-modal-summary-pill">
            <span>{t.periodPrefix}<b>{selectedPeriodText}</b></span>
            <div className="fb-tx-modal-totals">
              {incomeTotals.length === 0 ? (
                <b className="r-income">+0 {wallet.currency || "VND"}</b>
              ) : (
                incomeTotals.map((item) => (
                  <b key={item.currency} className="r-income">
                    +{formatHomeMoney(item.amount, item.currency)}
                  </b>
                ))
              )}
            </div>
          </div>
          {incomeList.length === 0 ? (
            <div className="fb-modal-empty-state">
              <ReceiptText size={38} />
              <h4>{t.emptyIncomeTitle}</h4>
              <p>{t.emptyIncomeDesc(selectedPeriodText)}</p>
              <button type="button" className="r-primary fb-modal-cta" onClick={addTransaction}>
                <Plus size={16} />{t.addIncomeTxBtn}
              </button>
            </div>
          ) : (
            <div className="fb-tx-modal-list">
              {incomeList.map((tx) => {
                const w = state.wallets.find((item) => item.id === tx.wallet);
                const curr = w?.currency || wallet.currency || "VND";
                const localizedCat = resolveCategoryDisplayName(tx.category, lang);
                return (
                  <button
                    key={tx.id}
                    type="button"
                    className="fb-tx-modal-item"
                    onClick={() => navigate("editTransaction?id=" + tx.id)}
                  >
                    <span className="fb-tx-modal-icon r-income">
                      <ArrowUpRight size={18} />
                    </span>
                    <div className="fb-tx-modal-info">
                      <b>{tx.title || localizedCat}</b>
                      <small>{localizedCat} · {w ? walletName(w.name) : ""}{w?.archived ? t.archivedWalletSuffix : ""} · {formatLocalizedDate(tx.date)}</small>
                    </div>
                    <b className="fb-tx-modal-amount r-income">
                      +{formatHomeMoney(tx.amount, curr)}
                    </b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal === "flowExpenseDetails" && (
        <div className="fb-flow-details-modal">
          <div className="fb-tx-modal-summary-pill">
            <span>{t.periodPrefix}<b>{selectedPeriodText}</b></span>
            <div className="fb-tx-modal-totals">
              {expenseTotals.length === 0 ? (
                <b className="r-expense">−0 {wallet.currency || "VND"}</b>
              ) : (
                expenseTotals.map((item) => (
                  <b key={item.currency} className="r-expense">
                    −{formatHomeMoney(item.amount, item.currency)}
                  </b>
                ))
              )}
            </div>
          </div>
          {expenseList.length === 0 ? (
            <div className="fb-modal-empty-state">
              <ReceiptText size={38} />
              <h4>{t.emptyExpenseTitle}</h4>
              <p>{t.emptyExpenseDesc(selectedPeriodText)}</p>
              <button type="button" className="r-primary fb-modal-cta" onClick={addTransaction}>
                <Plus size={16} />{t.addExpenseTxBtn}
              </button>
            </div>
          ) : (
            <div className="fb-tx-modal-list">
              {expenseList.map((tx) => {
                const w = state.wallets.find((item) => item.id === tx.wallet);
                const curr = w?.currency || wallet.currency || "VND";
                const localizedCat = resolveCategoryDisplayName(tx.category, lang);
                return (
                  <button
                    key={tx.id}
                    type="button"
                    className="fb-tx-modal-item"
                    onClick={() => navigate("editTransaction?id=" + tx.id)}
                  >
                    <span className="fb-tx-modal-icon r-expense">
                      <ArrowDownRight size={18} />
                    </span>
                    <div className="fb-tx-modal-info">
                      <b>{tx.title || localizedCat}</b>
                      <small>{localizedCat} · {w ? walletName(w.name) : ""}{w?.archived ? t.archivedWalletSuffix : ""} · {formatLocalizedDate(tx.date)}</small>
                    </div>
                    <b className="fb-tx-modal-amount r-expense">
                      −{formatHomeMoney(tx.amount, curr)}
                    </b>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal === "flowComparisonChart" && (
        <div className="fb-flow-chart-modal">
          <div className="fb-donut-summary-bar">
            <div>
              <span>{t.totalIncomeWithPeriod(selectedPeriodText)}</span>
              <div className="fb-flow-amounts-wrap">
                {incomeTotals.length === 0 ? (
                  <b className="r-income">+0 {wallet.currency || "VND"}</b>
                ) : (
                  incomeTotals.map((it) => (
                    <b key={it.currency} className="r-income">+{formatHomeMoney(it.amount, it.currency)}</b>
                  ))
                )}
              </div>
            </div>
            <div>
              <span>{t.totalExpenseWithPeriod(selectedPeriodText)}</span>
              <div className="fb-flow-amounts-wrap">
                {expenseTotals.length === 0 ? (
                  <b className="r-expense">−0 {wallet.currency || "VND"}</b>
                ) : (
                  expenseTotals.map((et) => (
                    <b key={et.currency} className="r-expense">−{formatHomeMoney(et.amount, et.currency)}</b>
                  ))
                )}
              </div>
            </div>
          </div>

          {currencies.length > 1 && (
            <div className="fb-donut-currency-switcher">
              <span>{t.donutCurrencySwitcherLabel}</span>
              <div className="r-type-pills">
                {currencies.map((curr) => (
                  <button
                    key={curr}
                    type="button"
                    className={activeDonutCurrency === curr ? "active" : ""}
                    onClick={() => setSelectedDonutCurrency(curr)}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fb-donut-grid">
            <SvgDonut
              type="income"
              items={donutIncomeBreakdown.items}
              total={donutIncomeTotal}
              currency={activeDonutCurrency}
              lang={lang}
            />
            <SvgDonut
              type="expense"
              items={donutExpenseBreakdown.items}
              total={donutExpenseTotal}
              currency={activeDonutCurrency}
              lang={lang}
            />
          </div>
        </div>
      )}

      {modal === "manageWallet" && (() => {
        const targetWallet = state.wallets.find((w) => w.id === editingWalletId) || wallet;
        const targetTxs = state.transactions.filter((t) => t.wallet === targetWallet.id || t.targetWallet === targetWallet.id);
        const hasTxs = targetTxs.length > 0;
        const currentBal = targetWallet.initial + state.transactions.reduce((a, t) => a + (t.wallet === targetWallet.id ? (t.type === "income" ? t.amount : -t.amount) : t.targetWallet === targetWallet.id ? t.amount : 0), 0);

        return (
          <div className="fb-manage-wallet-modal">
            <div className="fb-modal-tab-bar">
              <button
                type="button"
                className={`fb-tab-btn ${manageWalletTab === "details" ? "active" : ""}`}
                onClick={() => setManageWalletTab("details")}
              >
                <Settings size={15} />
                <span>{t.walletInfoTab}</span>
              </button>
              <button
                type="button"
                className={`fb-tab-btn ${manageWalletTab === "categories" ? "active" : ""}`}
                onClick={() => setManageWalletTab("categories")}
              >
                <FolderTree size={15} />
                <span>{t.categoryManagerTab}</span>
              </button>
            </div>

            {targetWallet.archived && (
              <div className="fb-wallet-archived-banner">
                <Ban size={16} />
                <div>
                  <b>{t.walletArchivedBannerTitle}</b>
                  <p>{t.walletArchivedBannerDesc}</p>
                </div>
              </div>
            )}

            {manageWalletTab === "details" && (
              <form className="fb-wallet-edit-form" onSubmit={handleSaveWalletInfo}>
                <div className="fb-form-group">
                  <label className="fb-form-label" htmlFor="edit-wallet-name">{t.walletNameLabel}</label>
                  <input
                    id="edit-wallet-name"
                    type="text"
                    className="fb-input"
                    placeholder={isSentinelWalletName(targetWallet.name) ? t.mainWallet : targetWallet.name}
                    value={editWalletName}
                    onChange={(e) => setEditWalletName(e.target.value)}
                  />
                </div>

                <div className="fb-form-group">
                  <label className="fb-form-label">{t.walletTypeLabel}</label>
                  <div className="r-two-options">
                    <button
                      type="button"
                      className={editWalletType === "cash" ? "active" : ""}
                      onClick={() => setEditWalletType("cash")}
                    >
                      <Wallet size={16} />
                      <span>{t.walletTypeCash}</span>
                    </button>
                    <button
                      type="button"
                      className={editWalletType === "credit" ? "active" : ""}
                      onClick={() => setEditWalletType("credit")}
                    >
                      <ReceiptText size={16} />
                      <span>{t.walletTypeCredit}</span>
                    </button>
                  </div>
                </div>

                {editWalletType === "credit" && (
                  <div className="fb-form-group">
                    <label className="fb-form-label" htmlFor="edit-wallet-limit">{t.creditLimitLabel}</label>
                    <input
                      id="edit-wallet-limit"
                      type="number"
                      step="any"
                      required
                      placeholder={t.creditLimitPlaceholder}
                      className="fb-input"
                      value={editWalletLimit}
                      onChange={(e) => setEditWalletLimit(e.target.value)}
                    />
                  </div>
                )}

                <div className="fb-form-group">
                  <div className="fb-form-label-row">
                    <label className="fb-form-label" htmlFor="edit-wallet-currency">{t.currencyUnitLabel}</label>
                    {hasTxs && (
                      <span className="fb-locked-badge">
                        <Lock size={12} /> {t.lockedBadge}
                      </span>
                    )}
                  </div>
                  {hasTxs ? (
                    <input
                      id="edit-wallet-currency"
                      type="text"
                      disabled
                      className="fb-input fb-input-locked"
                      value={`${editWalletCurrency} (${targetWallet.currency})`}
                    />
                  ) : (
                    <select
                      id="edit-wallet-currency"
                      value={editWalletCurrency}
                      onChange={(e) => setEditWalletCurrency(e.target.value)}
                      className="fb-select"
                    >
                      {t.currencyOptionsList.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {hasTxs && (
                    <p className="fb-helper-text">
                      {t.lockedCurrencyHelper}
                    </p>
                  )}
                </div>

                <div className="fb-form-group">
                  <div className="fb-form-label-row">
                    <label className="fb-form-label" htmlFor="edit-wallet-initial">
                      {editWalletType === "credit" ? t.initialBalanceLabelCredit : t.initialBalanceLabelCash}
                    </label>
                    {hasTxs && (
                      <span className="fb-locked-badge">
                        <Lock size={12} /> {t.lockedBadge}
                      </span>
                    )}
                  </div>
                  <input
                    id="edit-wallet-initial"
                    type="number"
                    step="any"
                    disabled={hasTxs}
                    className={`fb-input ${hasTxs ? "fb-input-locked" : ""}`}
                    value={editWalletInitial}
                    onChange={(e) => setEditWalletInitial(e.target.value)}
                  />
                  {hasTxs ? (
                    <p className="fb-helper-text">
                      {t.lockedInitialBalanceHelperPrefix}<b>{t.lockedInitialBalanceHelperHighlight}</b>{t.lockedInitialBalanceHelperSuffix}
                    </p>
                  ) : (
                    <p className="fb-helper-text">{t.unlockedInitialBalanceHelper}</p>
                  )}
                </div>

                {hasTxs && (
                  <div className="fb-balance-reconcile-card">
                    <div className="fb-reconcile-info">
                      <div className="fb-reconcile-header">
                        <SlidersHorizontal size={16} />
                        <b>{t.reconcileCardTitle}</b>
                      </div>
                      <p>
                        {t.reconcileCurrentBookPrefix}<strong>{formatHomeMoney(currentBal, targetWallet.currency)}</strong>{t.reconcileCurrentBookSuffix}
                      </p>
                    </div>

                    {!isReconciling ? (
                      <button
                        type="button"
                        className="fb-reconcile-btn"
                        onClick={() => {
                          setIsReconciling(true);
                          setNewActualBalance(currentBal.toString());
                        }}
                      >
                        <SlidersHorizontal size={14} />
                        <span>{t.reconcileTriggerButton}</span>
                      </button>
                    ) : (
                      <div className="fb-reconcile-form-box">
                        <div className="fb-form-group">
                          <label className="fb-form-label" htmlFor="actual-balance-input">
                            {t.reconcileActualBalanceLabel(targetWallet.currency)}
                          </label>
                          <input
                            id="actual-balance-input"
                            type="number"
                            step="any"
                            required
                            className="fb-input"
                            value={newActualBalance}
                            onChange={(e) => setNewActualBalance(e.target.value)}
                            placeholder={t.reconcileActualBalancePlaceholder}
                          />
                        </div>
                        <div className="fb-reconcile-actions">
                          <button
                            type="button"
                            className="r-secondary"
                            onClick={() => {
                              setIsReconciling(false);
                              setNewActualBalance("");
                            }}
                          >
                            {t.cancelButton}
                          </button>
                          <button
                            type="button"
                            className="r-primary"
                            onClick={handleConfirmAdjustment}
                          >
                            {t.confirmAdjustmentButton}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="fb-modal-actions">
                  <button type="button" className="r-secondary" onClick={close}>{t.closeButton}</button>
                  <button type="submit" className="r-primary">{t.saveChangesButton}</button>
                </div>

                <div className="fb-wallet-danger-zone">
                  <div className="fb-danger-zone-header">
                    <AlertTriangle size={15} />
                    <span>{t.dangerZoneHeader}</span>
                  </div>
                  <p className="fb-danger-zone-desc">
                    {hasTxs
                      ? targetWallet.archived
                        ? t.dangerZoneDescArchived
                        : t.dangerZoneDescHasTxs(targetTxs.length)
                      : t.dangerZoneDescNoTxs}
                  </p>
                  <button
                    type="button"
                    className={targetWallet.archived ? "fb-restore-wallet-btn" : "fb-archive-wallet-btn"}
                    onClick={handleArchiveOrDeleteWallet}
                  >
                    {targetWallet.archived ? (
                      <>
                        <RotateCcw size={15} />
                        <span>{t.reactivateWalletBtn}</span>
                      </>
                    ) : hasTxs ? (
                      <>
                        <Ban size={15} />
                        <span>{t.unlinkWalletBtn}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={15} />
                        <span>{t.deleteWalletPermanentBtn}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {manageWalletTab === "categories" && (
              <div className="fb-cat-manage-box">
                <div className="fb-cat-type-toggle">
                  <button
                    type="button"
                    className={`fb-cat-toggle-btn ${catType === "expense" ? "active" : ""}`}
                    onClick={() => handleSwitchCatType("expense")}
                  >
                    <ArrowDownRight size={14} />
                    <span>{t.catTabExpense}</span>
                  </button>
                  <button
                    type="button"
                    className={`fb-cat-toggle-btn ${catType === "income" ? "active" : ""}`}
                    onClick={() => handleSwitchCatType("income")}
                  >
                    <ArrowUpRight size={14} />
                    <span>{t.catTabIncome}</span>
                  </button>
                </div>

                <form className="fb-cat-add-form" onSubmit={handleAddCategory}>
                  <button
                    type="button"
                    className="fb-cat-icon-select-btn"
                    title={t.catChooseIconTooltip}
                    onClick={() => {
                      setIconPickerTarget("new");
                      setIsPickingIcon(isPickingIcon && iconPickerTarget === "new" ? false : true);
                    }}
                  >
                    <span>{newCatIcon}</span>
                  </button>
                  <input
                    type="text"
                    required
                    placeholder={catType === "income" ? t.catInputPlaceholderIncome : t.catInputPlaceholderExpense}
                    className="fb-input fb-cat-add-input"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                  />
                  <button type="submit" className="r-primary fb-cat-add-btn">
                    <Plus size={15} />
                    <span>{t.catAddButton}</span>
                  </button>
                </form>

                {isPickingIcon && (
                  <div className="fb-emoji-picker-box">
                    <div className="fb-emoji-picker-header">
                      <span>{iconPickerTarget === "new" ? (newCatName ? t.emojiPickerHeaderFor(newCatName) : t.emojiPickerHeaderNewCategory) : t.emojiPickerHeaderFor(editCatTitle || editingCatName || "")}</span>
                      <button type="button" className="fb-emoji-close-btn" onClick={() => setIsPickingIcon(false)} aria-label={t.emojiPickerCloseAriaLabel}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="fb-emoji-groups-scroll">
                      {iconGroups.map(([groupName, emojis]) => (
                        <div key={groupName} className="fb-emoji-group">
                          <span className="fb-emoji-group-title">{(t.emojiGroupNames as Record<string, string>)[groupName] || groupName}</span>
                          <div className="fb-emoji-grid">
                            {emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`fb-emoji-btn ${((iconPickerTarget === "new" ? newCatIcon : editCatIcon) === emoji) ? "active" : ""}`}
                                onClick={() => {
                                  if (iconPickerTarget === "new") {
                                    setNewCatIcon(emoji);
                                  } else {
                                    setEditCatIcon(emoji);
                                  }
                                  setIsPickingIcon(false);
                                }}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="fb-cat-list">
                  {state.categories
                    .filter((c) => {
                      const meta = state.categoryMeta?.[c];
                      return !meta || meta.type === catType;
                    })
                    .map((cat) => {
                      const meta = state.categoryMeta?.[cat];
                      const isArchived = meta?.archived;
                      const isEditing = editingCatName === cat;
                      const txCount = state.transactions.filter((t) => t.category === cat).length;
                      const localizedCatName = cat === "Chưa được phân loại" ? t.uncategorizedCategory : cat;

                      if (isEditing) {
                        return (
                          <form key={cat} className="fb-cat-edit-inline-form" onSubmit={handleSaveEditCat}>
                            <button
                              type="button"
                              className="fb-cat-icon-select-btn"
                              title={t.catEditIconTitle}
                              onClick={() => {
                                setIconPickerTarget("edit");
                                setIsPickingIcon(isPickingIcon && iconPickerTarget === "edit" ? false : true);
                              }}
                            >
                              <span>{editCatIcon}</span>
                            </button>
                            <input
                              type="text"
                              required
                              className="fb-input fb-cat-add-input"
                              value={editCatTitle}
                              onChange={(e) => setEditCatTitle(e.target.value)}
                            />
                            <button type="submit" className="fb-cat-action-btn fb-cat-save-btn" title={t.catEditSaveTitle}>
                              <Check size={15} />
                            </button>
                            <button type="button" className="fb-cat-action-btn fb-cat-cancel-btn" title={t.catEditCancelTitle} onClick={handleCancelEditCat}>
                              <X size={15} />
                            </button>
                          </form>
                        );
                      }

                      return (
                        <div key={cat} className={`fb-cat-item ${isArchived ? "is-archived" : ""}`}>
                          <div className="fb-cat-item-left">
                            <span className="fb-cat-icon-badge">
                              {categoryIcon(cat, state.categoryMeta)}
                            </span>
                            <div className="fb-cat-name-wrap">
                              <span className="fb-cat-name">{localizedCatName}</span>
                              {txCount > 0 && <small className="fb-cat-tx-badge">{t.catTxCountBadge(txCount)}</small>}
                              {isArchived && <span className="fb-cat-archived-tag">{t.catArchivedTag}</span>}
                            </div>
                          </div>
                          <div className="fb-cat-item-actions">
                            {!isArchived ? (
                              <>
                                <button
                                  type="button"
                                  className="fb-cat-edit-btn"
                                  title={t.catEditTooltip(localizedCatName)}
                                  onClick={() => handleStartEditCat(cat)}
                                >
                                  <Pencil size={14} />
                                </button>
                                {cat !== "Chưa được phân loại" && (
                                  <button
                                    type="button"
                                    className="fb-cat-delete-btn"
                                    title={t.catDeleteTooltip(localizedCatName)}
                                    onClick={() => handleDeleteCategory(cat)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="fb-cat-restore-btn"
                                  title={t.catRestoreTooltip(localizedCatName)}
                                  onClick={() => handleDeleteCategory(cat)}
                                >
                                  <RotateCcw size={14} />
                                  <span>{t.catRestoreBtnText}</span>
                                </button>
                                <button
                                  type="button"
                                  className="fb-cat-delete-btn"
                                  title={t.catReassignDeleteTooltip(txCount)}
                                  onClick={() => handleReassignAndDelete(cat)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </Modal>}
    {calendarLedgerOpen && (
      <CalendarLedgerModal
        onClose={() => setCalendarLedgerOpen(false)}
        navigate={navigate}
      />
    )}
  </div>;
}
