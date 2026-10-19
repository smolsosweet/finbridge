# BÁO CÁO TOÀN DIỆN: CÁC LUỒNG NGHIỆP VỤ & HỆ THỐNG TÁC VỤ AI ỨNG DỤNG FINBRIDGE
> **Mục đích tài liệu:** Cung cấp bức tranh toàn cảnh, kiến trúc chi tiết, phân rã 10 tác vụ AI chuyên sâu, 9 luồng người dùng (User Flows) và toàn bộ tính năng của nền tảng **FinBridge** để AI (ChatGPT / Gemini / Claude) có thể đọc, hiểu sâu và hỗ trợ phân tích, phát triển hoặc kiểm thử dự án.

---

## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

### 1.1. FinBridge là gì?
**FinBridge** là một không gian làm việc quản lý tài chính cá nhân đa ngôn ngữ (**Tiếng Việt**, **Tiếng Anh**, **Tiếng Trung**; mặc định là Tiếng Anh), đa tiền tệ (**VND**, **USD**, **EUR**, **GBP**, **CNY**, v.v.), hỗ trợ người dùng theo dõi dòng tiền, lập ngân sách, quản lý lịch thanh toán định kỳ, mô phỏng kịch bản tương lai và hỗ trợ chuyển tiền quốc tế trong môi trường sandbox.

### 1.2. Nguyên tắc cốt lõi (Core Architectural Boundary)
* **Quản lý ví thủ công (Manually Tracked Wallets):** FinBridge **không** kết nối trực tiếp với tài khoản ngân hàng thực và **không** tự ý di chuyển tiền thực tế của người dùng. Mọi số dư, giao dịch, chuyển quỹ đều do người dùng tự ghi nhận hoặc xác nhận.
* **Không tự ý quy đổi tỷ giá gộp (Currency Isolation):** Mỗi ví gắn liền với một đơn vị tiền tệ cố định. FinBridge không tự động cộng gộp 100 USD và 2,000,000 VND thành một số dư hỗn tạp, giúp dữ liệu sổ cái kế toán luôn minh bạch và chính xác.
* **Kiến trúc công nghệ (Tech Stack):**
  - **Frontend & Server:** Next.js 16 (App Router, Turbopack), React 19, TypeScript.
  - **Styling:** CSS Modules, Tailwind CSS, Base UI (`@base-ui/react`), Lucide React Icons.
  - **Cơ sở dữ liệu:** PostgreSQL với mô hình quan hệ chặt chẽ (`wallets`, `transactions`, `categories`, `goals`/`budgets`, `fixed_expenses`, `rules`, `safety_rules`, v.v.).
  - **Xác thực:** Better-Auth, mã hóa mật khẩu Argon2, Google OAuth 2.0, Brevo HTTPS Email OTP.
  - **Trí tuệ nhân tạo:** Google Gemini SDK (`@google/genai`) kết hợp thuật toán tính toán kế toán xác thực (Deterministic Engine).
  - **Chế độ Demo Cục bộ (Local Demo Mode):** Hỗ trợ cờ `FINBRIDGE_DEMO_MODE=true` với các In-Memory Fallback Repositories giúp trải nghiệm mượt mà không bắt buộc khởi chạy toàn bộ dịch vụ ngoài.

---

## 2. BẢN ĐỒ 9 LUỒNG NGHIỆP VỤ (CORE USER FLOWS)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LUỒNG 1: XÁC THỰC (AUTH)                        │
│        Google OAuth / Email + Password / Quên mật khẩu / Đăng xuất     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  LUỒNG 2: THIẾT LẬP LẦN ĐẦU (ONBOARDING)               │
│  7 bước: Tên -> Ngôn ngữ -> Ví chính & Số dư mở -> Ví phụ -> Danh mục  │
│          -> Chi phí cố định (ràng buộc trần số dư) -> Ngưỡng an toàn   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   KHÔNG GIAN LÀM VIỆC CHÍNH (MAIN WORKSPACE)           │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ LUỒNG 3: DASHBOARD│ LUỒNG 4: SỔ CÁI   │ LUỒNG 5: KẾ HOẠCH & HÓA ĐƠN    │
│ • Thẻ dòng tiền   │ • Lịch sử thu/chi │ • Hạn mức ngân sách (Budgets)  │
│ • Carousel Ví     │ • Chuyển quỹ ví   │ • Lịch chi cố định (Schedule)  │
│ • Biểu đồ tuần    │ • Lịch kế toán    │ • Quét & Tạo mã VietQR         │
│ • Hoạt động gần   │ • Thao tác xóa    │ • Xác nhận đã trả (không trừ x2│
├───────────────────┴───────────────────┴────────────────────────────────┤
│ LUỒNG 6: HỆ THỐNG TRỢ LÝ AI CHATBOT (10 TÁC VỤ AI TOÀN DIỆN)          │
│ • Nhận diện tiếng Việt lóng (300k, 1 củ) & tách nhiều giao dịch / 1 câu│
│ • Nhận diện giọng nói (Micro) & Quét ảnh hóa đơn (Vision OCR)          │
│ • Phân loại 14 Intent & Duyệt bản nháp 2 pha (Two-Phase Commit)        │
│ • Tra cứu số dư chuẩn xác & Mô phỏng kịch bản What-If (Scenario)       │
│ • Quản lý danh mục & Xóa giao dịch qua ngôn ngữ tự nhiên               │
│ • Gợi ý chi tiêu chủ động (Proactive Feed) & Tự chữa lành Schema       │
├────────────────────────────────────────────────────────────────────────┤
│ LUỒNG 7: NGƯỠNG AN TOÀN & TRUNG TÂM THÔNG BÁO (SAFETY & NOTIFICATIONS) │
│ • Sàn dự trữ ví (Reserve floor) & Dự báo vượt ngân sách (Pace forecast)│
│ • Hộp thư thông báo hợp nhất: phân biệt Đã đọc (Read) vs Đã xử lý      │
├────────────────────────────────────────────────────────────────────────┤
│ LUỒNG 8: SANDBOX CHUYỂN TIỀN DU HỌC QUỐC TẾ (INTERNATIONAL TRANSFERS)  │
│ • Tỷ giá tham chiếu FX hàng ngày & Bóc tách chi phí minh bạch          │
│ • Mô phỏng tạo lệnh, phê duyệt và xuất biên lai lưu trữ                │
├────────────────────────────────────────────────────────────────────────┤
│ LUỒNG 9: CÀI ĐẶT & ĐA NGÔN NGỮ (SETTINGS & LOCALIZATION)               │
│ • Đổi tên, giao diện Sáng/Tối, đồng bộ chuẩn 3 ngôn ngữ (EN/VI/ZH)     │
│ • Xuất/Sao lưu dữ liệu, đóng tài khoản an toàn (Account Closure)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. CHI TIẾT 10 TÁC VỤ AI CỐT LÕI (AI CAPABILITIES & TASKS)

Hệ thống AI của FinBridge không phải là một chatbot gọi API đơn thuần, mà là một **kiến trúc Hybrid (AI NLU + Động cơ Toán học Xác thực)** gồm 10 tác vụ cụ thể:

### Tác vụ 1: Bóc tách giao dịch từ ngôn ngữ tự nhiên (Natural Language Transaction Extraction)
* **API Route:** [`/api/ai/transaction-drafts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/transaction-drafts/route.ts) & [`/api/ai/assistant`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/assistant/route.ts)
* **Model:** Gemini 2.5 Flash / Flash Lite (với `responseSchema` ép kiểu chặt chẽ).
* **Đặc tả hoạt động:**
  - Nhận diện các cách diễn đạt tiếng lóng tài chính Việt Nam: `300k`, `500 nghìn`, `1 củ`, `2 củ rưỡi`, `5 lít`, `5 chục`, `5 xị`, `1.5 triệu`.
  - Phân tách tự động nhiều giao dịch trong cùng 1 câu: *"Sáng ăn phở 45k, trưa cơm tấm 50k, tối cafe 35k"* ➔ Tạo 3 bản nháp giao dịch độc lập.
  - Phân giải ngày tương đối: *"hôm qua"*, *"thứ 2 tuần trước"*, *"tháng này"* dựa trên múi giờ thực tế của thiết bị (`Asia/Ho_Chi_Minh`).
  - Tự động đoán danh mục phù hợp (ví dụ: *"phở", "cơm sườn"* ➔ *"Ăn uống"*).

### Tác vụ 2: Thị giác máy tính quét hóa đơn (Multimodal Receipt OCR & Extraction)
* **API Route:** [`/api/ai/receipt-drafts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/receipt-drafts/route.ts)
* **Model:** Gemini 2.5 Flash Multimodal Vision (`ThinkingLevel.LOW`).
* **Đặc tả hoạt động:**
  - Nhận diện ảnh chụp từ camera hoặc file tải lên (JPEG, PNG, HEIC, WebP, dung lượng tối đa 5MB).
  - Trích xuất thông tin: Tên cửa hàng/dịch vụ, ngày giờ in hóa đơn, tổng tiền thanh toán, và các món chi tiết.
  - Gắn nhãn các trường cần người dùng rà soát lại (`needsReview: ["wallet", "category"]`).

### Tác vụ 3: Chuyển đổi giọng nói thành văn bản (Speech-to-Text Transcription)
* **API Route:** [`/api/ai/speech-transcription`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/speech-transcription/route.ts)
* **Model:** Gemini Audio Processing.
* **Đặc tả hoạt động:**
  - Nhận dữ liệu âm thanh trực tiếp từ `MediaRecorder` của trình duyệt (`audio/webm`, `audio/mp4`, `audio/wav`).
  - Nhận diện chính xác giọng nói tiếng Việt, tiếng Anh và tiếng Trung.
  - Trả về câu lệnh văn bản sạch và tự động kích hoạt bóc tách giao dịch.

### Tác vụ 4: Phân loại ý định hội thoại đa tầng (Multi-turn Intent Classification)
* **Thư viện logic:** [`src/lib/conversation-intent.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/conversation-intent.ts)
* **Model & Thuật toán:** Gemini 2.5 Flash kết hợp bộ lọc Heuristic Rule-based.
* **Đặc tả hoạt động:**
  - Quản lý chính xác **14 trạng thái ý định (Intents)**:
    1. `create_transaction`: Ghi nhận giao dịch mới.
    2. `update_pending_transaction`: Sửa bản nháp hiện có (*"sửa lại thành 30k"*, *"khoản đó thuộc ví Tiền mặt"*).
    3. `answer_clarification`: Trả lời câu hỏi làm rõ của AI.
    4. `query_financial_data`: Hỏi số dư các ví, tổng thu chi trong kỳ.
    5. `analyze_spending`: Phân tích cơ cấu chi tiêu, xếp hạng danh mục.
    6. `simulate_financial_scenario`: Mô phỏng kịch bản giả định What-If.
    7. `category_savings`: Tính toán khoản tiền tiết kiệm khi giảm X% danh mục.
    8. `list_categories`: Liệt kê danh mục đang có.
    9. `create_category`: Tạo danh mục mới ngay trong cuộc trò chuyện.
    10. `rename_category`: Đổi tên danh mục và tự động cập nhật lịch sử tham chiếu.
    11. `merge_categories`: Gộp 2 danh mục làm một.
    12. `delete_category`: Xóa danh mục và chuyển các giao dịch cũ về an toàn.
    13. `delete_transactions`: Tìm và xóa giao dịch qua lệnh tự nhiên.
    14. `general_finance_question` & `unsupported_or_ambiguous_request`: Trả lời kiến thức hoặc từ chối yêu cầu không rõ ràng.

### Tác vụ 5: Động cơ trả lời câu hỏi tài chính xác thực (Deterministic Financial Query Engine)
* **Thư viện logic:** [`src/lib/financial-chat.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/financial-chat.ts)
* **Đặc tả hoạt động:**
  - Chống 100% ảo giác số học (Hallucination) của LLM: **Gemini không được phép tự tính toán số dư hay cộng trừ tiền**.
  - Toàn bộ phép tính số dư `trackedBalance()`, tổng chi `total()`, tình trạng ngân sách `budgetSummary()` do thuật toán TypeScript tự chạy trực tiếp trên mảng giao dịch kế toán thực tế của người dùng.
  - Hỗ trợ câu hỏi kép: *"Tháng này tôi tiêu nhiều nhất vào khoản nào? Có gì bất thường không?"* ➔ Tự động kết hợp 2 action `top_category` và `anomalies` trong một câu trả lời duy nhất.

### Tác vụ 6: Mô phỏng kịch bản tương lai & Trần chi tiêu ngày (What-If Scenario Simulator)
* **API Route:** [`/api/ai/scenario-planner`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/scenario-planner/route.ts)
* **Thư viện logic:** [`src/lib/scenario-planner.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/scenario-planner.ts)
* **Đặc tả hoạt động:**
  - Mô phỏng câu hỏi: *"Nếu mỗi ngày tôi tiêu 300k thì cuối tháng còn tiền không?"*.
  - Lấy số dư hiện có + thu nhập sắp nhận - số tiền đã chi thực tế - các chi phí cố định chưa trả (`unpaid commitments`).
  - Tính toán số ngày còn lại trong tháng (`daysLeft`), phát hiện thâm hụt tiền mặt (`cash shortfall`).
  - Tính trần chi tiêu an toàn mỗi ngày (`safeDailyAllowance`).
  - Hỗ trợ kịch bản tiếp nối (Follow-up): *"Thế nếu giảm xuống 200k/ngày?"* ➔ Kế thừa ví và bối cảnh trước đó, tính toán lại tức thì.

### Tác vụ 7: Quản trị danh mục & Xóa giao dịch an toàn qua hội thoại
* **Thư viện logic:** [`src/lib/category-operations.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/category-operations.ts) & [`src/lib/transaction-deletion.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/transaction-deletion.ts)
* **Đặc tả hoạt động:**
  - Cho phép người dùng ra lệnh bằng ngôn ngữ tự nhiên: *"Đổi tên danh mục Ăn ngoài thành Ăn uống"* hoặc *"Xóa các khoản chi hôm qua"*.
  - Nguyên tắc phòng thủ: Tạo bảng đối soát xác nhận (Confirmation Section) hiển thị số giao dịch bị ảnh hưởng và nút bấm xác nhận rõ ràng trước khi ghi vào database.

### Tác vụ 8: Tạo gợi ý tài chính chủ động (Proactive Insights & Alerts Feed)
* **API Route:** [`/api/ai/proactive-feed`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/app/api/ai/proactive-feed/route.ts)
* **Thư viện logic:** [`src/lib/proactive-alerts.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/proactive-alerts.ts)
* **Model:** Gemini 3.1 Flash Lite.
* **Đặc tả hoạt động:**
  - Nhận các sự kiện tài chính do thuật toán phát hiện (vượt ngân sách, tốc độ tiêu tiền quá nhanh, hóa đơn sắp đến hạn).
  - Sử dụng AI để sinh lời văn giải thích ngắn gọn, đồng cảm và gợi ý hành động thiết thực theo ngôn ngữ người dùng (VI/EN/ZH).

### Tác vụ 9: Kế hoạch chi tiêu cục bộ tức thì (Local Offline Spending Plan)
* **Thư viện logic:** [`src/lib/chat-local-plan.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/chat-local-plan.ts)
* **Đặc tả hoạt động:**
  - Cung cấp phản hồi tóm tắt kế hoạch chi tiêu ngay lập tức khi người dùng bấm *"Xem kế hoạch chi tiêu"* trong khung chat mà không cần đợi gọi API mạng.

### Tác vụ 10: Tự chữa lành dữ liệu & Chuẩn hóa Schema (Self-Healing & Resilience)
* **Thư viện logic:** `cleanJsonText` & `normalizePlannerResponse` trong [`src/lib/scenario-planner.ts`](file:///c:/Users/ADMIN/Documents/FinBridge/finbridge/src/lib/scenario-planner.ts)
* **Đặc tả hoạt động:**
  - Tự động bóc tách các khối markdown code fences (```json ... ```) bị model trả thừa.
  - Sửa lỗi các trường bị thiếu, ép kiểu số tiền dạng chuỗi `"300000"` về số nguyên `300000`.
  - Tự động fallback sang câu trả lời an toàn khi model gặp lỗi mạng hoặc trả về dữ liệu bất thường, bảo vệ ứng dụng không bao giờ bị crash.

---

## 4. MA TRẬN 74 BÀI KIỂM THỬ TỰ ĐỘNG CHO AI (TEST SUITES EVIDENCE)

Toàn bộ 10 tác vụ AI trên đều được bảo chứng bởi hệ thống kiểm thử tự động độc lập:

| Bộ kiểm thử | Số test | Tình trạng | Phạm vi chức năng kiểm tra |
| :--- | :---: | :---: | :--- |
| **`test:scenario-planner`** | **21 tests** | **21/21 PASS** | Dự báo tài chính, hạn mức chi tiêu hàng ngày, tính toán thâm hụt, cách ly tiền tệ |
| **`verify-ai-planner-upgrade`** | **20 tests** | **20/20 PASS** | Phân tích tiếng Việt lóng (`k`/`củ`), tự làm sạch JSON, câu hỏi kép, nhớ kịch bản follow-up |
| **`test:transaction-ai`** | **25 tests** | **25/25 PASS** | Bóc tách giao dịch từ tin nhắn, danh mục tạm thời, sửa số tiền, chọn ví tự động theo tiền tệ |
| **`test:proactive-alerts`** | **8 tests** | **8/8 PASS** | Bắt cảnh báo vượt ngân sách, hóa đơn sắp đến hạn, tính toán dòng tiền âm |
| **TỔNG CỘNG** | **74 tests** | **74/74 PASS (100%)** | Toàn bộ các luồng AI đều có kiểm thử tự động xác thực |

---

## 5. BẢNG TỔNG KẾT TÍNH NĂNG TOÀN DỰ ÁN CHO CHATGPT

| Phân hệ | Tính năng chính | Nguyên tắc kỹ thuật cốt lõi |
| :--- | :--- | :--- |
| **Xác thực (Auth)** | Google OAuth, Email/Password (Argon2), Quên mật khẩu OTP. | Cách ly tài khoản (`userId`), bảo vệ session cookie an toàn. |
| **Khởi tạo (Onboarding)** | Hướng dẫn 7 bước: Tên, Ngôn ngữ, Ví, Danh mục, Khoản cố định, Mức sàn. | Ràng buộc chi cố định <= số dư mở ví; lưu bản nháp tránh mất dữ liệu. |
| **Dashboard** | Thẻ tổng thu chi, Carousel ví, biểu đồ tuần, hoạt động gần. | Không gộp tỷ giá ngoại tệ; phân tách tiền tệ rành mạch. |
| **Sổ cái (Ledger)** | Lọc đa chiều, tìm kiếm toàn văn, chuyển quỹ ví, lịch kế toán Calendar. | Bảo toàn mốc ngày kế toán, không lệch giờ nửa đêm. |
| **Kế hoạch (Planning)** | Ngân sách tháng, lịch chi cố định, mã VietQR, xác nhận đã trả. | Chống trừ trùng chi phí: xác nhận trả mới chuyển thành chi thực tế. |
| **AI Chatbot (Finn)** | 10 tác vụ AI: Nhận diện tiếng Việt lóng, giọng nói, quét hóa đơn, duyệt bản nháp 2 pha, dự báo ngày. | Kiến trúc Hybrid: Gemini hiểu ngôn ngữ, TypeScript tính toán 100%. |
| **Ngưỡng an toàn (Safety)**| Sàn dự trữ ví, cảnh báo tốc độ chi tiêu, hộp thư thông báo chuông. | Phân biệt thông báo "Đã đọc" vs "Đã xử lý sự cố". |
| **Sandbox Chuyển tiền** | Tỷ giá tham chiếu FX, bóc tách chi phí, duyệt lệnh, biên lai nội bộ. | Môi trường mô phỏng an toàn cho du học sinh, không chuyển tiền thật. |
| **Đa ngôn ngữ (i18n)** | Đồng bộ Tiếng Anh (mặc định), Tiếng Việt, Tiếng Trung trên toàn hệ thống. | Tự động thích ứng cả giao diện, thông báo và tin nhắn trả lời của AI. |
