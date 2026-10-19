# BÁO CÁO KỸ THUẬT: KIẾN TRÚC & NĂNG LỰC TỰ PHÁT TRIỂN HỆ THỐNG AI TÀI CHÍNH FINBRIDGE
**Dự án:** FinBridge Personal Finance Workspace  
**Tác giả:** Đội ngũ phát triển FinBridge  
**Chủ đề:** *Chứng minh bản quyền thiết kế thuật toán, xử lý ngôn ngữ tự nhiên (NLU) tiếng Việt và hệ thống tài chính xác thực — Phản biện luận điểm "AI API Wrapper thuần túy".*

---

## 1. TỔNG QUAN VẤN ĐỀ (EXECUTIVE SUMMARY)

Một ngộ nhận phổ biến khi đánh giá các ứng dụng tích hợp Trí tuệ Nhân tạo hiện nay là: **"Chỉ cần lấy API của Google Gemini hay OpenAI rồi truyền câu chat vào là xong, không có hàm lượng kỹ thuật tự làm."**

Trong lĩnh vực **Tài chính cá nhân (Fintech)**, cách tiếp cận "API Wrapper ngây thơ" (gửi trực tiếp dữ liệu và nhận câu trả lời dạng văn bản thô từ LLM) **hoàn toàn thất bại và nguy hiểm**, bởi 4 tử huyệt cố hữu của Mô hình Ngôn ngữ Lớn:
1. **Ảo giác số học (Mathematical Hallucination):** LLM là mô hình xác suất từ ngữ (token prediction), tính toán số học rất kém, thường xuyên tính sai số dư, sai lãi suất, sai tỷ lệ phần trăm và làm tròn số ẩu.
2. **Trôi dạt tiền tệ (Cross-Currency Drift):** LLM tự ý quy đổi tỷ giá ảo (ví dụ gộp 100 USD và 2 triệu VND thành một con số vô nghĩa) thay vì cách ly ví nghiêm ngặt.
3. **Mất an toàn dữ liệu (Uncontrolled Side-Effects):** Nếu cho phép AI tự ý ghi dữ liệu vào cơ sở dữ liệu dựa trên câu chat, chỉ một hiểu lầm nhỏ có thể xóa sạch lịch sử giao dịch hoặc ghi đè số dư ví của người dùng.
4. **Không hiểu tiếng lóng tài chính địa phương (Vietnamese Financial Slang):** Các API quốc tế mặc định không hiểu các cách nói của người Việt như: *"ăn trưa 45k"*, *"bắn cho mẹ 2 củ"*, *"sửa lại thành 3 loét"*, *"đóng học phí 5 triệu ví phụ"*.

**Tuyên ngôn kỹ thuật của FinBridge:**  
Trong FinBridge, **Google Gemini chỉ là một mắt xích nhỏ (Component) trong tầng Giải mã Ngôn ngữ (NLU)**. Toàn bộ:
- Bộ giải mã tiếng lóng tài chính Việt Nam (Custom Regex & Rule-based Tokenizer),
- Động cơ toán học xác thực (Deterministic Financial Calculation Engine),
- Máy trạng thái quản trị ngữ cảnh hội thoại (14-state Intent Machine),
- Cơ chế kiểm soát 2 bước (Two-Phase Commit Staging),
- Pipeline nhận diện hóa đơn (Vision OCR) & Giọng nói (Speech),
- Cùng bộ kiểm thử tự động 74 kịch bản kiểm thử độc lập (74/74 PASS 100%),

👉 **Đều do tác giả tự thiết kế, lập trình và tinh chỉnh 100% bằng TypeScript và NodeJS.**

---

## 2. BẰNG CHỨNG 1: KIẾN TRÚC HYBRID ĐỘC QUYỀN (AI NLU + DETERMINISTIC ENGINE)

Thay vì để Gemini tự "đoán" số dư hay tính toán chi tiêu, FinBridge tách đôi bài toán:
- **Gemini:** Chỉ chịu trách nhiệm trích xuất cấu trúc ý định (Intent) và tham số (Parameters: ngày nào, ví nào, danh mục nào, số tiền bao nhiêu).
- **Custom FinBridge Engine:** Nhận các tham số đó và thực hiện tính toán số học chính xác tuyệt đối trên tập dữ liệu kế toán thực tế.

```
[User Message] ──> [Vietnamese NLU Pre-processor] 
                         │ (Lọc tiếng lóng, mốc ngày)
                         ▼
             [Gemini 2.5 Flash / Flash Lite]
                         │ (Chỉ trích xuất Intent & JSON Params)
                         ▼
           [Zod Schema Validator & Self-Healing]
                         │ (Chống ảo giác, chuẩn hóa kiểu)
                         ▼
        [Deterministic Calculation Engine (Tự viết)]
        ├── trackedBalance()             ──> Tính số dư ví chính xác đến từng xu
        ├── budgetSummary()              ──> Phân bổ hạn mức, trừ chi thực & khoản cố định
        ├── calculateScenario()          ──> Mô phỏng kịch bản What-If, trần chi ngày
        └── formatTransactionMoney()     ──> Định dạng VND/USD/EUR cách ly
                         ▼
      [Two-Phase Commit Staging UI (Xem trước)] ──> [Xác nhận ghi vào Postgres]
```

### Minh chứng mã nguồn:
* **File:** `src/lib/financial-chat.ts`  
  Hàm `answerFinancialQuery()` tự duyệt qua toàn bộ mảng giao dịch kế toán, tính toán số dư thực tế `trackedBalance()`, tổng thu, tổng chi, phân loại ví theo loại tiền tệ riêng biệt. Không cho phép LLM tham gia vào phép tính cộng/trừ.
* **File:** `src/lib/scenario-planner.ts`  
  Hàm `calculateScenario()` tự tính toán tốc độ chi tiêu theo chu kỳ (spending pace), dự báo nguy cơ thâm hụt tiền mặt theo ngày, và tính toán hạn mức chi tiêu hàng ngày an toàn (`safeDailyAllowance`).

---

## 3. BẰNG CHỨNG 2: BỘ XỬ LÝ NGÔN NGỮ TIẾNG VIỆT & TIẾNG LÓNG TÀI CHÍNH TỰ XÂY DỰNG

FinBridge sở hữu bộ tiền xử lý và chuẩn hóa ngôn ngữ tiếng Việt chuyên biệt cho thói quen chi tiêu của người Việt Nam.

### A. Nhận diện số tiền và tiếng lóng:
Tự viết các biểu thức chính quy (Regex) và logic bóc tách tại `src/lib/transaction-drafts.ts` và `src/lib/scenario-planner.ts`:
- Đơn vị hàng nghìn: `30k`, `50k`, `100k`, `45 nghìn`, `50 ngàn`, `5 chục`, `5 xị`.
- Đơn vị hàng triệu: `1 củ`, `2 củ rưỡi`, `1.5 triệu`, `2 chai`, `3 loét`.
- Tự động chuyển đổi thành số thực nguyên vẹn: `1 củ` ➔ `1,000,000`; `50k` ➔ `50,000`.

### B. Bóc tách nhiều giao dịch trong một câu:
Người dùng có thể gõ một câu chứa nhiều khoản chi:
> *"Sáng ăn phở 45k, trưa ăn cơm tấm 50k, chiều uống trà sữa 35k"*

Hệ thống tự nhận diện các mốc phân tách ngữ cảnh và sinh ra **3 bản nháp giao dịch độc lập** thay vì gộp chung thành một số tiền sai lệch.

### C. Phân giải mốc thời gian tương đối (Relative Date Resolution):
Hệ thống tự động tính toán ngày kế toán chính xác theo múi giờ thiết bị (`Asia/Ho_Chi_Minh`):
- *"Hôm qua"* ➔ `today - 1 day`
- *"Thứ 2 tuần trước"* ➔ Ngày cụ thể dạng `YYYY-MM-DD`
- *"Tháng này"* ➔ `2026-10-01` đến `today` (và chặn trên tại ngày hiện tại để không tính nhầm giao dịch tương lai vào lịch sử thực chi).

---

## 4. BẰNG CHỨNG 3: MÁY TRẠNG THÁI HỘI THOẠI & ĐIỀU PHỐI Ý ĐỊNH (14 CONVERSATION INTENTS)

Không biến chatbot thành một cửa sổ hỏi đáp chung chung, tác giả đã lập trình một bộ phân loại ý định (Intent Classifier) tại `src/lib/conversation-intent.ts` gồm **14 trạng thái nghiệp vụ tài chính**:

| Mã ý định (Intent) | Mô tả hành vi do code tự xử lý |
| :--- | :--- |
| `create_transaction` | Tạo mới bản nháp giao dịch từ văn bản |
| `update_pending_transaction` | Người dùng chỉnh sửa bản nháp vừa tạo (*"sửa lại ví Tiền mặt"*) |
| `answer_clarification` | Trả lời câu hỏi làm rõ khi giao dịch thiếu dữ kiện |
| `query_financial_data` | Tra cứu số dư, thu chi các ví |
| `analyze_spending` | Phân tích danh mục chi nhiều nhất, tỷ trọng % chi |
| `simulate_financial_scenario` | Mô phỏng kịch bản chi tiêu giả định trong tương lai |
| `category_savings` | Ước tính số tiền tiết kiệm nếu cắt giảm X% danh mục |
| `create_category` | Tạo danh mục mới ngay trong chat |
| `rename_category` | Đổi tên danh mục và tự động cập nhật lịch sử tham chiếu |
| `merge_categories` | Gộp 2 danh mục làm một |
| `delete_category` | Xóa danh mục và chuyển các giao dịch cũ về an toàn |
| `delete_transactions` | Tìm kiếm và tạo danh sách xác nhận xóa giao dịch qua lời nói |
| `general_finance_question` | Giải thích kiến thức tài chính cơ bản |
| `unsupported_or_ambiguous_request` | Từ chối an toàn khi câu hỏi mơ hồ, yêu cầu làm rõ |

### Nhớ ngữ cảnh nối tiếp (Contextual Follow-up):
Khi người dùng hỏi tiếp:
> Câu 1: *"Nếu mỗi ngày tiêu 300k thì cuối tháng có thiếu tiền không?"*  
> Câu 2: *"Thế nếu giảm xuống 200k thì sao?"*

Code tự động nhận diện đây là câu hỏi nối tiếp, kế thừa ví đã chọn và các khoản chi cố định từ Câu 1, chỉ cập nhật tham số `dailyLimit: 200000` và tính toán lại ngay lập tức mà không bắt người dùng phải nhập lại từ đầu.

---

## 5. BẰNG CHỨNG 4: KIẾN TRÚC BẢN NHÁP 2 GIAI ĐOẠN (TWO-PHASE COMMIT STAGING)

Một sản phẩm phần mềm tài chính chuyên nghiệp không bao giờ cho phép AI tự động chèn thẳng dòng dữ liệu vào database kế toán.

Tác giả đã lập trình quy trình **Xác thực 2 pha (Two-Phase Commit)**:
1. **Pha 1 - Staging (Tạo bản nháp):**  
   AI chỉ được phép tạo đối tượng `TransactionDraft` với mảng cờ `needsReview: ["amount", "wallet", "category"]`.  
   Nếu người dùng nhắc đến danh mục mới chưa từng có, code tạo danh mục tạm thời (`staged category`) chỉ tồn tại trong phiên chat.
2. **Pha 2 - User Confirmation (Người dùng duyệt & Cam kết):**  
   Giao diện hiển thị các thẻ Draft Card trực quan trên màn hình. Người dùng có quyền:
   - Đổi ví bằng một chạm (nút bấm pill)
   - Sửa số tiền
   - Bấm **"Xác nhận lưu"** thì hàm `validateAndCommitDrafts()` mới chính thức ghi giao dịch vào PostgreSQL/Workspace.
   - Bấm **"Bỏ qua"** thì danh mục tạm và giao dịch nháp lập tức bị hủy bỏ, bảo vệ cơ sở dữ liệu sạch sẽ 100%.

---

## 6. BẰNG CHỨNG 5: PIPELINE THỊ GIÁC MÁY TÍNH (OCR HÓA ĐƠN) & GIỌNG NÓI (SPEECH)

Hệ thống xử lý đa phương thức không phải chỉ truyền raw data mà qua các bước tinh lọc kỹ thuật:

* **Quét hóa đơn (`src/app/api/ai/receipt-drafts/route.ts`):**  
  - Giới hạn tệp an toàn phía client (tối đa 5MB, định dạng ảnh hợp lệ).
  - Chuyển đổi base64 Data URL.
  - Áp dụng Zod schema chặt chẽ để lọc rác: chỉ nhận về đúng schema `{ title, amount, category, date, walletId, needsReview }`.
* **Ghi âm giọng nói (`src/app/api/ai/speech-transcription/route.ts`):**  
  - Điều khiển Web Audio API `MediaRecorder` ở trình duyệt.
  - Kiểm tra MIME type tương thích trên cả iOS và Android (`audio/webm`, `audio/mp4`, `audio/wav`).
  - Chuyển âm thanh thành câu lệnh văn bản đẩy thẳng vào ô chat của Finn.

---

## 7. BẰNG CHỨNG 6: CƠ CHẾ TỰ BẢO VỆ & PHÒNG THỦ DỮ LIỆU (SELF-HEALING SCHEMAS)

Để phòng ngừa trường hợp model AI trả về phản hồi bị lỗi định dạng Markdown fences (```json ... ```) hoặc thiếu trường:
* Tác giả tự viết hàm `cleanJsonText()`: Bóc tách lớp vỏ markdown, loại bỏ các đoạn văn bản dư thừa trước và sau JSON.
* Viết hàm `normalizePlannerResponse()`: Tự động phát hiện trường bị thiếu, ép kiểu số tiền dạng chuỗi `"300000"` về số nguyên `300000`, thiết lập giá trị fallback mặc định an toàn.
* Ngăn chặn tuyệt đối việc crash ứng dụng khi Gemini gặp lỗi mạng hoặc trả về dữ liệu bất thường.

---

## 8. BẰNG CHỨNG 7: KẾT QUẢ KIỂM THỬ TỰ ĐỘNG TOÀN DIỆN (74/74 TESTS PASS 100%)

Mọi dòng code xử lý AI đều đi kèm bài kiểm thử đơn vị và tích hợp (Unit & Integration Tests) được thực thi độc lập:

| Bộ kiểm thử | Số test | Tình trạng | Phạm vi chức năng kiểm tra |
| :--- | :---: | :---: | :--- |
| **`test:scenario-planner`** | **21 tests** | **21/21 PASS** | Dự báo tài chính, hạn mức chi tiêu hàng ngày, tính toán thâm hụt, cách ly tiền tệ |
| **`verify-ai-planner-upgrade`** | **20 tests** | **20/20 PASS** | Phân tích tiếng Việt lóng (`k`/`củ`), tự làm sạch JSON, câu hỏi kép, nhớ kịch bản follow-up |
| **`test:transaction-ai`** | **25 tests** | **25/25 PASS** | Bóc tách giao dịch từ tin nhắn, danh mục tạm thời, sửa số tiền, chọn ví tự động theo tiền tệ |
| **`test:proactive-alerts`** | **8 tests** | **8/8 PASS** | Bắt cảnh báo vượt ngân sách, hóa đơn sắp đến hạn, tính toán dòng tiền âm |
| **TỔNG CỘNG** | **74 tests** | **74/74 PASS (100%)** | Toàn bộ các luồng AI đều có kiểm thử tự động xác thực |

### Chi tiết các bộ kiểm thử:
1. **Bộ kiểm thử Nâng cấp AI Planner & Xử lý tiếng Việt (`scripts/verify-ai-planner-upgrade.mjs` - 20 tests):**
   - *Test 1:* Phân tích tiếng lóng tài chính Việt Nam (`k`, `củ`, `nghìn`, `triệu`).
   - *Test 2:* Tự động làm sạch JSON bị bọc markdown code fences.
   - *Test 3:* Tính toán ngày cuối tháng và phân giải ngày tương đối.
   - *Test 4-9:* Chuẩn hóa dữ liệu mô hình và cơ chế tự phục hồi (resilient fallback).
   - *Test 10-11:* Mô phỏng hạn mức chi tiêu hàng ngày và cảnh báo thâm hụt.
   - *Test 12:* Câu hỏi kép phức hợp (*"Tháng này tiêu nhiều nhất vào đâu? Có gì bất thường không?"*).
   - *Test 13-14:* Cập nhật kịch bản nối tiếp (giảm 300k xuống 200k/ngày).
   - *Test 15-20:* Cách ly đa tiền tệ và không nhầm lẫn giữa chi phí cố định và hạn mức.

2. **Bộ kiểm thử Mô phỏng kịch bản tài chính (`scripts/verify-scenario-planner.mjs` - 21 tests):**
   - Kiểm tra tính toán số dư không làm sai lệch dữ liệu gốc.
   - Đảm bảo giao dịch tương lai không bị tính nhầm vào chi tiêu hiện tại.
   - Đảm bảo tính toán độc lập từng loại tiền tệ (VND, USD).
   - Xác thực trần chi tiêu an toàn theo chu kỳ ngày.

3. **Bộ kiểm thử Bóc tách & Xử lý giao dịch AI (`test:transaction-ai` - 25 tests):**
   - Tách nhiều giao dịch trong 1 câu thoại (*"sáng 45k, trưa 50k"*).
   - Tạo và khôi phục danh mục tạm thời (Staged Categories).
   - Sửa đổi số tiền và đổi ví bằng ngôn ngữ tự nhiên.
   - Phân giải tự động ví nguồn theo loại tiền tệ.

4. **Bộ kiểm thử Cảnh báo tài chính chủ động (`test:proactive-alerts` - 8 tests):**
   - Nhận diện ngưỡng vượt ngân sách tháng.
   - Bắt các hóa đơn cố định sắp đến hạn trong vòng 7 ngày.
   - Tính toán dòng tiền khả dụng và cảnh báo dòng tiền âm.

---

## 9. KẾT LUẬN

Hệ thống AI Chatbot của FinBridge là một **công trình kỹ thuật phần mềm hoàn chỉnh** được thiết kế bài bản:
1. **Không phụ thuộc mù quáng vào API:** Sử dụng LLM đúng sở trường (hiểu ngôn ngữ) và chặn đứng sở đoản (tính toán số học).
2. **Sở hữu thuật toán tự viết chuyên sâu:** Hàng ngàn dòng code TypeScript cho bộ máy tính toán kế toán, xử lý tiếng lóng tiếng Việt, và quản trị máy trạng thái hội thoại.
3. **An toàn tài chính tuyệt đối:** Cơ chế duyệt bản nháp 2 pha đảm bảo tiền và dữ liệu của người dùng luôn nằm dưới quyền kiểm soát của con người.

Báo cáo này là bằng chứng rõ ràng chứng minh FinBridge là sản phẩm của năng lực tự nghiên cứu, làm chủ công nghệ và tối ưu hóa chuyên sâu cho người dùng Việt Nam.
