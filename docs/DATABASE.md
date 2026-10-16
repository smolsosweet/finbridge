# Cơ sở dữ liệu FinBridge

## Nguồn dữ liệu

Người dùng đã đăng nhập đọc và ghi dữ liệu tài chính qua `/api/workspace` vào PostgreSQL. Trình duyệt giữ bản đang chỉnh sửa trong bộ nhớ để giao diện phản hồi ngay; có trạng thái đang lưu/đã lưu/lỗi. Dữ liệu tài chính không được ghi tiếp vào localStorage. Chế độ demo local là ngoại lệ có chủ đích.

Database local hiện dùng tên `finbridge_auth`; tên này có từ giai đoạn đăng nhập, nhưng hiện chứa cả dữ liệu nghiệp vụ. Không cần tạo database khác để lưu danh mục hay giao dịch.

## Các bảng chính

| Dữ liệu | Bảng PostgreSQL |
| --- | --- |
| Người dùng, phương thức đăng nhập, phiên | `user`, `account`, `session`, `verification` |
| Trạng thái đóng tài khoản | `finbridge_account_lifecycle` |
| Ví, số dư ban đầu, loại tiền | `finbridge_wallets` |
| Danh mục thu/chi, biểu tượng, trạng thái | `finbridge_categories` |
| Danh mục được gán cho từng ví | `finbridge_wallet_categories` |
| Danh mục phụ | `finbridge_category_children` |
| Giao dịch thu/chi/chuyển nội bộ | `finbridge_transactions` |
| Ngân sách và chu kỳ | `finbridge_budgets` |
| Mục tiêu khác | `finbridge_goals` |
| Khoản chi cố định và lịch lặp | `finbridge_fixed_expenses` |
| Người nhận chuyển khoản đã lưu cho từng khoản | `finbridge_fixed_expense_recipients` |
| Mẫu giao dịch định kỳ | `finbridge_recurring_transactions` |
| Cài đặt, tên xưng hô, mức dự phòng | `finbridge_preferences` |
| Quy tắc phân loại | `finbridge_categorization_rules` |
| Hội thoại và tin nhắn giao dịch/lập kế hoạch | `finbridge_conversations`, `finbridge_chat_messages` |
| Giao dịch nháp trong chat | `finbridge_transaction_drafts` |
| Thiết lập lần đầu đã hoàn tất/bản đang nhập | `finbridge_onboarding`, `finbridge_onboarding_drafts` |
| Điều kiện cảnh báo, gồm cả thực tế và dự báo | `finbridge_alert_rules` |
| Lịch sử cảnh báo, trạng thái gửi email | `finbridge_safety_events` |
| Phiên bản cấu hình cảnh báo | `finbridge_safety_changes` |
| Revision hiện tại và lịch sử workspace | `finbridge_workspaces`, `finbridge_workspace_revisions` |

Các bảng tài chính có `user_id`, khóa chính ghép `(user_id, id)`, thời gian tạo/cập nhật và `deleted_at`. Quan hệ ví–danh mục–giao dịch–ngân sách dùng khóa ngoại ghép theo chủ sở hữu. `finbridge_safety` giữ trạng thái tính toán và hàng đợi logic của bộ cảnh báo. Các bảng `*_limits` phục vụ giới hạn tần suất ghi.

Các trường nghiệp vụ cần truy vấn có cột riêng; số tiền dùng `NUMERIC(20,4)`, không dùng SQL float. JSONB `data` giữ metadata của các tính năng hiện có. Workspace và revision JSONB được ghi trong cùng transaction để hỗ trợ đối chiếu/khôi phục, còn màn hình đọc các bản ghi từ bảng nghiệp vụ. JavaScript vẫn dùng number và từ chối số vượt giới hạn hoặc cần làm tròn quá 4 chữ số thập phân; đây chưa phải sổ cái kế toán ngân hàng.

## Xem bằng pgAdmin4

1. Kết nối server PostgreSQL local như trước, cổng **5434**.
2. Mở **Databases → finbridge_auth → Schemas → public → Tables**.
3. Nhấp phải **Tables → Refresh** nếu danh sách đang cũ.
4. Nhấp phải `finbridge_categories` → **View/Edit Data → All Rows**.
5. Tạo danh mục trong app, chờ trạng thái **Đã lưu vào database**, rồi Refresh bảng.

Query Tool có thể xem dữ liệu chưa bị xóa mềm:

```sql
SELECT id, user_id, name, category_type, archived, created_at
FROM public.finbridge_categories
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

SELECT id, user_id, wallet_id, category_id, title, amount, direction, occurred_on
FROM public.finbridge_transactions
WHERE deleted_at IS NULL
ORDER BY occurred_on DESC;
```

pgAdmin dùng tài khoản quản trị có thể thấy dữ liệu nhiều người dùng; không đưa thông tin kết nối quản trị vào frontend hay tài liệu công khai.

## Dữ liệu cũ và cập nhật schema

- Chạy `npm run auth:migrate` sau khi khởi động PostgreSQL. Migration bổ sung bảng, không reset tài khoản hay tạo giao dịch giả.
- Khi tài khoản chưa có workspace trên server nhưng có dữ liệu cũ thuộc chính tài khoản đó ở trình duyệt, app yêu cầu **Chuyển vào database** một lần. Bản local được giữ nguyên; không tự nhập dữ liệu không rõ chủ sở hữu.
- Thử trên trình duyệt mới sau khi nhập: ví, danh mục, ngân sách và giao dịch sẽ được tải lại từ server.
- Lưu bị lỗi: giữ tab mở, tải bản chưa lưu nếu cần và thử lại. Hai thiết bị sửa cùng revision sẽ nhận xung đột; tải bản chưa lưu trước khi mở bản database. Chưa có tự động gộp thay đổi hay cộng tác thời gian thực.
- Xóa khỏi giao diện đặt `deleted_at`; sửa giữ bản revision trước. Đóng tài khoản khóa truy cập, không xóa các bản ghi tài chính.
- Dữ liệu cá nhân được lưu để vận hành tính năng; khi triển khai phải có chính sách lưu trữ/retention phù hợp và sao lưu độc lập. Lịch sử revision không thay thế backup.

## Triển khai

Ứng dụng và PostgreSQL là hai dịch vụ. Khi deploy, cấu hình `DATABASE_URL` bằng biến môi trường bí mật và chạy migration trước khi phục vụ người dùng. Git không chứa dữ liệu database local; chuyển dữ liệu thật sang server cần quy trình backup/restore riêng. HTTPS, TLS database, quyền database tối thiểu, backup có kiểm tra khôi phục, giám sát dung lượng và chính sách retention vẫn phải cấu hình ở môi trường triển khai.

Kiểm thử database chỉ được chạy với `AUTH_TEST_DATABASE_URL` trỏ tới `finbridge_auth_test` trên localhost. Các fixture dùng tài khoản tổng hợp và được dọn sau bài test.
