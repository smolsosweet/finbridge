# Finn: tạo ví, ngân sách và chi phí cố định trong chat

## Luồng người dùng

- Nhắn “Tạo ví giúp mình”, “Tạo ngân sách ăn uống” hoặc “Tạo ngân sách và chi phí cố định giúp mình”. Có thể cung cấp nhiều thông tin ngay trong câu đầu.
- Finn hỏi **một trường còn thiếu mỗi lượt**. Lựa chọn ví, ngân sách liên kết, tiền tệ, danh mục và chu kỳ có nút chọn từ dữ liệu hiện có. Người dùng cũng có thể trả lời bằng văn bản hoặc bản chép giọng nói.
- Khi đủ thông tin, Finn hiển thị toàn bộ thông tin đã thu thập để kiểm tra. Có thể nhắn yêu cầu chỉnh sửa hoặc hủy.
- Bấm **Xác nhận tạo**, hoặc trả lời xác nhận ngay sau màn hình xem lại. Chỉ lúc này mới thêm dữ liệu vào workspace. “Có/yes” sau một câu hỏi không liên quan không được dùng để xác nhận đề xuất cũ.
- Có thể tạo tối đa sáu mục trong một đề xuất. Ví/ngân sách mới có ID ổn định để ngân sách/chi phí mới có thể tham chiếu trong cùng lần xác nhận.

## Dữ liệu và quyền

- Tái sử dụng `Wallet`, `Goal(kind=budget)`, `FixedExpense`, `updateState()` và `flushWorkspace(true)`; không có kho dữ liệu tài chính song song.
- `workspace-actions.ts` kiểm tra đối tượng bằng schema hiện có, `validBudget()` và `validFixedExpense()`. Kiểm tra lại theo workspace hiện tại khi xác nhận; không tự đổi tiền tệ và không ghi vào ví đã lưu trữ.
- Số dư ban đầu, số tiền và các ngày chưa biết phải được hỏi, không mặc định thành số không hoặc ngày hôm nay. Hạn mức tín dụng được hỏi cho ví tín dụng. Danh mục chi và ngày đến hạn được kiểm tra với ví/ngân sách liên quan.
- Lịch chi cố định hỗ trợ một lần, hàng tuần, hàng năm và theo chu kỳ tháng (1–12 tháng); có thể giữ yêu cầu đầu/cuối tháng và số ngày nhắc trước. Lịch mới **không phải** một giao dịch đã thanh toán.
- Lưu đề xuất và tiến trình trong message của hội thoại hiện có. Reload khi đang lưu chuyển trạng thái sang thử lại; ID ổn định và cờ đã áp dụng tránh thêm bản ghi lần nữa. Chỉ báo đã lưu sau khi cơ chế persistence hiện có xác nhận thành công.
- Route `/api/ai/workspace-actions` chỉ phân tích và kiểm tra đề xuất. Tài khoản thật dùng dữ liệu server theo session, origin và owner header. Context từ browser chỉ dùng trong demo local được bật rõ ràng. Việc lưu vẫn qua API workspace với revision/idempotency/ownership hiện có.
- SDK và API key ở server. Không cấp quyền thanh toán, kết nối ngân hàng hoặc thực hiện các thao tác phá hủy ngoài các luồng xác nhận đã có.

## File chính

- `src/lib/workspace-actions.ts`: schema, câu hỏi còn thiếu, kiểm tra và áp dụng đề xuất đã xác nhận.
- `src/app/api/ai/workspace-actions/route.ts`: Gemini hiểu yêu cầu/chỉnh sửa, các nút lựa chọn có thể xử lý trực tiếp không cần gọi model.
- `WorkspaceActionCard.tsx`, `Transactions.tsx`: hội thoại, lựa chọn, xem lại, xác nhận, hủy và retry.
- `conversation-intent.ts`, route assistant và `store.ts`: ý định tạo mới và metadata của hội thoại.

Kiểm tra triển khai: TypeScript, ESLint các file liên quan và `npm run build` đã đạt; route `/api/ai/workspace-actions` có trong production build. Chưa kiểm thử với tài khoản/dịch vụ AI thật, chưa ghi dữ liệu tài chính thật và chưa chạy bộ kiểm thử tự động cho tính năng mới trong lượt này. Thay đổi ở workspace local; chưa phát hành lên main/Vercel.
