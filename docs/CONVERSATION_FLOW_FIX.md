# Kiểm tra và sửa luồng hội thoại FinBridge — 2026-10-18

## Nguyên nhân đã xác minh

1. `Transactions.tsx` bắt câu trả lời danh mục trước khi phân biệt khoản chi mới. Hàm lấy tên danh mục nhận gần như mọi câu ngắn, có thể biến cả một câu thành tên danh mục. Cách gắn mục tiêu còn dựa vào phản hồi gần nhất thay vì ID đang được thao tác.
2. `transaction-drafts.ts` chưa nhận `học thêm` trong nhánh dự phòng. Quy tắc mua sắm dùng từ `mua` quá rộng; phép khớp danh mục lấy kết quả đầu tiên, không biểu diễn trường hợp nhiều danh mục cùng phù hợp.
3. API assistant chỉ có các nhóm ý định rộng, chưa có thao tác danh mục. Yêu cầu xóa danh mục có thể bị hiểu thành xóa giao dịch. API cũng chưa nhận toàn bộ bản nháp hoặc bản vá theo ID; schema cũ từ chối trường `newCategory` của bản nháp đã được tạo đúng trên giao diện.
4. Danh mục do client gửi được dùng làm ngữ cảnh ngay, chưa thay bằng dữ liệu hiện tại của tài khoản trên server. Một số thông báo thành công xuất hiện ngay sau thay đổi trong bộ nhớ, trước khi bộ ghi workspace xác nhận lưu.
5. Cách xóa danh mục trong màn hình quản lý cũ chỉ cập nhật danh sách và một phần tham chiếu, không di chuyển đầy đủ ngân sách, chi cố định, khoản định kỳ và bản nháp.

Đối chiếu bằng cách chạy helper nguyên bản từ Git commit `2b83aef` với fixture danh mục tổng hợp (không thay file đang làm việc):

| Câu | Kết quả helper nguyên bản |
| --- | --- |
| `học thêm 100k` | `type=null`, `category=null` |
| `tôi mua bánh mì 10k` | `category=Mua sắm` |
| `tôi mua nước 20k` | `category=Mua sắm` |

## Luồng hiện tại

- LLM trả về thao tác có cấu trúc, được kiểm tra bằng Zod: tạo giao dịch; sửa bản nháp; trả lời thông tin thiếu; tra cứu; phân tích; mô phỏng; liệt kê/tạo/đổi tên/gộp/xóa danh mục; xóa giao dịch; kiến thức tài chính; yêu cầu chưa rõ.
- Các kiểm tra xác định ngăn thao tác danh mục đi vào xóa giao dịch, và ngăn một khoản mua mới ghi đè bản nháp trước. Các cách diễn đạt chưa nhận diện được vẫn đi qua LLM, không phải danh sách câu hỏi cố định.
- Mỗi bản nháp giữ ID riêng. `activeDraftId` ghi mục đang thao tác; `clarifyingDraftId` ghi mục còn thiếu thông tin. Khi nhiều mục phù hợp, chat cho chọn đúng bản nháp. Bản vá chỉ sửa trường được yêu cầu; phản hồi cũ không ghi đè bản nháp vừa bị chỉnh sửa.
- Lựa chọn danh mục lấy từ workspace hiện tại, phân biệt loại thu/chi và trạng thái lưu trữ. Một kết quả rõ ràng được tự gán; nhiều kết quả hoặc thiếu danh mục sẽ hiện lựa chọn tương tác.
- Tạo danh mục trong giao dịch vẫn là tạm thời cho tới khi xác nhận giao dịch. Tạo danh mục riêng, đổi tên, gộp và xóa đều có xem trước và xác nhận.
- Danh mục chưa được sử dụng có thể được gỡ. Danh mục đang có giao dịch, kế hoạch hoặc bản nháp sẽ được lưu trữ và ẩn khỏi lựa chọn mới. Lịch sử và các số tiền không bị xóa. Danh mục lưu trữ vẫn dùng được khi tra cứu lịch sử.
- Đổi tên/gộp cập nhật đồng thời tham chiếu trong giao dịch, ngân sách/mục tiêu, chi cố định, khoản định kỳ, ví, bản nháp và ngữ cảnh tài chính của hội thoại.
- Mọi thay đổi dùng `updateState()` và workspace writer hiện có. Không thêm kho lưu giao dịch hoặc API ghi dữ liệu song song. Writer giữ revision và mutation ID khi thử lưu lại; chat chỉ báo thành công sau khi lưu được xác nhận. Dữ liệu nguồn thay đổi sau khi xem trước thì phải xem lại tác động.
- Xác nhận xóa giao dịch cũng chờ writer xác nhận, giữ danh sách ID đã áp dụng khi cần thử lưu lại, và không báo đã xóa trong trạng thái lưu thất bại.
- API lấy danh mục, ví và dữ liệu tài chính từ tài khoản được xác thực; kiểm tra origin và tài khoản ở các đường đi liên quan. LLM không ghi dữ liệu. Phép tính mô phỏng của tài khoản chạy bằng dịch vụ TypeScript trên server; demo cục bộ tiếp tục tính từ workspace demo trong trình duyệt.
- Reset hội thoại hủy yêu cầu chat đang chạy. Phản hồi thuộc phiên hội thoại hoặc tài khoản cũ bị bỏ qua. Thử gửi lại một yêu cầu lỗi giữ batch ID để tránh bản nháp trùng.

## Các file của thay đổi này

| File | Vai trò |
| --- | --- |
| `src/components/sites/rolly/replica/Transactions.tsx` | Định tuyến UI, mục tiêu theo ID, lựa chọn danh mục, xem trước/xác nhận, trạng thái lưu và retry |
| `src/components/sites/rolly/replica/Categories.tsx` | Dùng chung quy tắc đổi tên/xóa, giữ phạm vi tạo danh mục của ví đang chọn |
| `src/components/sites/rolly/replica/store.ts` | Ngữ cảnh hội thoại và thao tác danh mục; yêu cầu writer sẵn sàng khi cần xác nhận lưu |
| `src/lib/conversation-intent.ts` | Các ý định, schema bản vá, ranh giới thao tác và phân giải mục tiêu |
| `src/lib/category-operations.ts` | Kiểm tra, tác động, phát hiện dữ liệu cũ, di chuyển tham chiếu và lưu trữ danh mục |
| `src/lib/category-operation-copy.ts` | Nhãn và thông báo EN/VI/ZH cho thao tác danh mục |
| `src/lib/transaction-drafts.ts` | Nhận diện ngữ cảnh danh mục, phân biệt khớp rõ/rối/chưa biết, dự phòng khoản chi |
| `src/lib/chat-local-plan.ts` | Giữ ngữ cảnh giả định cho câu nối tiếp, không dùng lại số dư đã tính |
| `src/app/api/ai/assistant/route.ts` | Schema thao tác, ngữ cảnh theo tài khoản, xác thực đầu ra và bản vá |
| `src/app/api/ai/scenario-planner/route.ts` | Dữ liệu theo tài khoản và phép tính mô phỏng xác định trên server |
| `src/lib/workspace-model.ts`, `src/lib/finance-tables.ts` | Lưu/đọc lại ID đang thao tác và tham chiếu danh mục trong hội thoại hiện có |
| `scripts/verify-conversation.mjs` | Kiểm thử hành vi và các guard bằng dữ liệu tổng hợp |
| `scripts/verify-assistant-route.mjs` | Gọi Route Handler thật với provider và tài khoản tổng hợp trong bộ nhớ |
| `scripts/verify-conversation-postgres.mjs` | Kiểm thử quan hệ dữ liệu trên database local cách ly |
| `scripts/verify-localization.cjs` | Bỏ mock helper không còn đầy đủ; dùng helper thật để kiểm tra render |
| `package.json` | Thêm lệnh kiểm thử hội thoại |

Các thay đổi có sẵn từ các lượt trước trong working tree được giữ nguyên.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run typecheck` | Đạt |
| ESLint các file TypeScript liên quan | Đạt |
| `npm run test:conversation` | 25/25 đạt (chạy lại sau sửa xếp hạng danh mục) |
| `npm run test:transaction-ai` | 20/20 đạt |
| `npm run test:workspace` | 4/4 đạt |
| `npm run test:planning` | 9/9 đạt |
| `npm run test:bill-payments` | 9/9 đạt |
| `npm run test:scenario-planner` | 19/19 đạt |
| `npm run test:localization` | 38 đạt, 2 TODO đã có sẵn |
| `git diff --check` | Đạt |
| `npm run test:conversation:postgres` | Chặn trước khi kết nối: thiếu `AUTH_TEST_DATABASE_URL` |
| `npm run build -- --webpack` | Thất bại: không phân giải được `fonts.googleapis.com`; selector toàn cục có sẵn trong `SafetyAlerts.module.css` không hợp lệ với CSS Modules pure mode |

Ca kiểm thử bao gồm học thêm, bánh mì/nước liên tiếp, danh mục rối hoặc không tồn tại, xóa/đổi tên/gộp, di chuyển tham chiếu, sửa một trong hai bản nháp, hủy riêng, xác nhận lặp, câu nối tiếp, API lỗi, sai tài khoản/origin, phản hồi model sai loại thao tác, danh mục lưu trữ và mô phỏng không thay đổi dữ liệu thật.

## Giới hạn xác minh

### Kiểm tra trước khi đẩy main / Vercel (2026-10-18)

- `git fetch origin main`: nền code local và remote cùng `2b83aef`, không có commit remote mới để merge tại thời điểm kiểm tra.
- `npm run build` mặc định (Next.js 16.4.1 / Turbopack / Node 24.21.0) **đã hoàn tất thành công**, bao gồm TypeScript, thu thập dữ liệu trang và prerender. Chạy build với quyền mạng để tải Google Fonts; lượt bị giới hạn mạng đã dừng khi không tiến triển.
- Sửa lỗi CSS Modules có sẵn: chuyển selector theme toàn cục khỏi `SafetyAlerts.module.css` sang `SafetyTheme.css`; vẫn giữ biến theme scoped cho `.page` và `.detailsModalContent` cùng biến cho portal dialog. Build cuối không còn cảnh báo parse CSS.
- Kiểm thử lại: hội thoại 26/26, giao dịch 25/25, scenario 21/21, workspace 4/4, ngôn ngữ 38 đạt và 2 TODO có sẵn. Không chạy database production hay gửi dữ liệu tài khoản thật sang provider để kiểm thử.
- Full `npm run lint` chưa đạt: 18 lỗi có sẵn (explicit any / require trong Safety API và TransactionHistory; đồng bộ state trong effect tại SafetyAlerts, AuthCard, WelcomeScreen, Dashboard), kèm cảnh báo biến chưa dùng. Không tắt quy tắc lint hoặc đổi luồng auth để che lỗi. Build production độc lập đã đạt.
- Quét các file chuẩn bị commit không thấy đường dẫn env/backup/log hoặc mẫu key riêng phổ biến. `.env.local` không được đưa lên Git. Không thay dependency hoặc thêm migration database.
- Build local không xác nhận biến môi trường, database production, quota AI hay kết quả deploy trên Vercel. Workflow GitHub hiện chỉ nhắm `master`; không được coi là bằng chứng CI thành công cho `main`.

### Giải thích phép tính dự báo, bỏ phần giới hạn khuôn mẫu (2026-10-18)

- Đối chiếu ví dụ người dùng bằng `calculateScenario()`: khoản chi 837.000 VND đến ngày 18/10 cho tốc độ 46.500 VND/ngày; 19–31/10 là 13 ngày, chi thêm 604.500 VND; số dư hiện tại 9.163.000 VND còn dự kiến 8.558.500 VND. Đây là kiểm thử dữ liệu tổng hợp khớp các con số được cung cấp, chưa xác nhận dữ liệu tài khoản thực tế hay các khoản cố định ngoài ví dụ.
- Lỗi câu hỏi “bạn tính số tiền đó như nào”: tác vụ `explain` vốn là giải thích danh mục cao nhất, không phải giải thích phép tính mô phỏng. Thêm `scenario-explanation.ts` nhận diện câu hỏi về phép tính ngay sau dự báo và diễn giải chính `ScenarioResult` đã hiển thị. Lưu snapshot giải thích trong message hiện có (`scenarioExplanation`), không gửi số liệu tính toán này cho model. Hội thoại cũ không có snapshot được tính lại bằng cùng hàm từ workspace hiện tại và ghi rõ là tính lại.
- Không có thay đổi công thức số dư/dự báo, không ghi giao dịch/ngân sách. Số tiền được định dạng theo EN/VI/ZH, có mức chi/ngày, số ngày, chi dự kiến, điều chỉnh ròng và phép trừ ra kết quả. Dữ liệu thiếu vẫn được thông báo ngắn, không coi dự báo là chắc chắn.
- Bỏ mục Giả định/giới hạn mặc định và dòng mô phỏng khuôn mẫu khỏi câu trả lời mới. Một dòng mô tả cơ sở dự báo vẫn được giữ. Renderer ẩn phần giới hạn chung trong tin nhắn cũ; cảnh báo cụ thể về dữ liệu vẫn hiện, không gắn tiêu đề giới hạn.
- Kiểm tra: `test:scenario-planner` 21/21, `test:transaction-ai` 25/25, `test:conversation` 26/26; TypeScript và ESLint đạt. Hai assertion cũ của scenario test được cập nhật sang định dạng ISO/locale đã áp dụng ở lượt trước, giữ nguyên các giá trị số cần xác minh.

### Hỏi tiếp về danh mục và trình bày câu trả lời (2026-10-18)

- Triệu chứng được tái hiện bằng Route Handler thật với provider giả lập: sau tổng thu chi, model có thể tiếp tục trả `spending_summary` cho câu hỏi “đã chi cho những danh mục nào”. Trước đây ứng dụng không sửa sự không khớp này; `explain` chỉ hiển thị một danh mục và `top_category` tối đa năm danh mục, nên không phù hợp để liệt kê đầy đủ.
- Thêm tác vụ `category_breakdown` dùng phép cộng theo đơn vị nhỏ nhất của tiền tệ trên giao dịch thực tế trong kỳ, tách riêng từng ví. Hiển thị tất cả danh mục có phát sinh, số tiền, tỷ trọng, số giao dịch và tổng đối chiếu; loại thu nhập/chuyển khoản khỏi chi tiêu. Không thêm dữ liệu hay đổi số dư.
- `resolveFinancialFollowup()` sửa tác vụ tổng hợp bị lặp cho các câu hỏi phân bổ rõ ràng, giữ kỳ trước khi không được thay đổi; không chép số tiền cũ. Prompt có hướng dẫn phân biệt tổng chi, danh mục đã chi, xếp hạng và danh sách giao dịch. Các yêu cầu khác vẫn dùng định tuyến có cấu trúc của model; không khẳng định bao phủ mọi cách nói.
- Tiền được định dạng theo EN/VI/ZH với mã ISO rõ ràng. Tổng hợp ghi rõ số khoản chi thay vì con số trong ngoặc không nhãn. Hai tác vụ đơn giản bỏ các tiêu đề khuôn mẫu dư thừa.
- `FinancialChatAnswer.tsx` render đoạn văn, danh sách, nhấn mạnh số tiền và phần giả định có thể mở rộng. React escape toàn bộ nội dung, không diễn giải HTML hay liên kết do model tạo.
- File chính: `src/lib/financial-chat.ts`, `src/app/api/ai/assistant/route.ts`, `Transactions.tsx`, `FinancialChatAnswer.tsx`, `replica.css`. Bổ sung kiểm thử tại `scripts/verify-transaction-ai.mjs` và `scripts/verify-assistant-route.mjs`.
- Kết quả lượt này: giao dịch/tài chính 25/25; hội thoại/Route Handler 26/26; TypeScript và ESLint các file nguồn thay đổi đạt. Kiểm tra kỳ trước, biên ngày, thu nhập không tăng số khoản chi, trên năm danh mục, nhiều tiền tệ, dữ liệu mới thay thế kết quả cũ, không thay đổi dữ liệu và ba ngôn ngữ. Provider giả lập; chưa kiểm chứng dịch vụ AI thật, số tiền 837.000 VND của tài khoản người dùng hay bố cục trình duyệt thật (điều khiển trình duyệt bị tắt).

### Sửa hồi quy nhận diện danh mục (2026-10-18)

#### Đóng lựa chọn sau khi gắn danh mục

- `categoryResolutionDraftIds()` trước đây giữ khung lựa chọn nếu message còn `categoryChoiceDraftIds`, kể cả bản nháp đã có danh mục hoặc danh mục mới tạm thời. Nay kiểm tra trạng thái bản nháp hiện tại trước, nên cả hội thoại cũ cũng không mở lại bước đã hoàn tất.
- `Transactions.tsx` bổ sung chọn ví trực tiếp trong thẻ nếu còn thiếu ví và không có khung chọn ví riêng. Vẫn kiểm tra tiền tệ và yêu cầu người dùng xác nhận; không tự ghi danh mục/giao dịch khi chưa chọn ví.
- Thêm kiểm thử hóa đơn y tế: đóng khung danh mục, giữ nguyên tiền/ngày, chặn ví USD cho khoản VND, chọn ví VND rồi lưu Y tế cùng giao dịch một lần. Kiểm tra một bản nháp đã giải quyết không làm ẩn lựa chọn của bản nháp khác. Giao dịch 22/22, hội thoại 25/25 đạt. Chưa kiểm chứng giao diện trình duyệt thật trong lượt này.

- Nguyên nhân: bộ phân giải trước đây coi mọi tên chứa cùng từ khóa là ngang nhau. Khi `Thức ăn & Đồ uống`, `ăn uông` và `trong danh mục ăn uống luôn` cùng hoạt động, ngay cả “ăn cơm 25k” cũng thành mơ hồ; Route Handler bỏ kết quả danh mục của model. Fixture bánh mì/nước trước đó lưu trữ hai tên phụ nên không phát hiện hồi quy.
- Sửa trong `resolveDraftCategory()`: ưu tiên nhãn danh mục hoàn chỉnh thay vì câu dài chỉ chứa từ khóa, rồi ưu tiên nhãn bao phủ miền đầy đủ. Các nhãn có cùng mức bằng chứng vẫn yêu cầu lựa chọn. Không sửa/xóa danh mục của người dùng. Lựa chọn tên chính xác của người dùng vẫn được giữ nguyên.
- Kiểm thử mới giữ tất cả danh mục phụ hoạt động: cơm, bánh mì, nước, trà sữa, tiếng Anh/Trung; nhãn ngang mức, danh mục lưu trữ và sai loại. Route Handler thật được kiểm tra với model giả lập trả đúng, sai hoặc thiếu danh mục; vẫn trả `25000 VND`, đúng ngày và danh mục chuẩn, không ghi giao dịch.
- Chạy lại: hội thoại 25/25, giao dịch 20/20, TypeScript đạt. ESLint file thư viện đạt; hai script `.mjs` bị cấu hình ESLint bỏ qua và được thực thi bằng Node test runner. Chưa kiểm chứng dịch vụ AI thật hay giao diện trình duyệt trong lượt sửa hồi quy này.

- Các kiểm thử Route Handler dùng provider giả lập; chưa đo độ chính xác ngôn ngữ hay độ trễ của dịch vụ LLM thật trong lượt này. Việc phân giải cách nói chưa có tín hiệu rõ vẫn phụ thuộc LLM và có thể cần hỏi lại.
- Chưa chạy được vòng ghi/đọc PostgreSQL mới. Bộ test chỉ chấp nhận database local có tên `finbridge_auth_test`; không dùng database ứng dụng để thay thế.
- Chưa kiểm tra thao tác UI đầy đủ trên trình duyệt trong lượt này vì FinBridge không còn là tab Chrome đang hoạt động. Không xác nhận xóa/gộp hoặc tạo giao dịch trên dữ liệu thật để kiểm thử.
- Chưa xác nhận build production thành công vì hai lỗi build nêu trên. Không đổi CSS của tính năng Safety hoặc cách dùng font để che lỗi này.
