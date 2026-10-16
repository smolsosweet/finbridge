# Kiểm tra nghiệp vụ Planning — 16/10/2026

Phạm vi: ngân sách, khoản cố định, ghi nhận thanh toán, chuẩn bị chuyển khoản QR,
ngưỡng an toàn, thông báo, lưu PostgreSQL và cách ly tài khoản. Không audit tính
năng AI Simulator; chỉ chạy hồi quy phần dùng chung, không gọi nhà cung cấp AI.

## Logic được áp dụng

| Phần | Quy tắc |
| --- | --- |
| Ngân sách | Hạn mức theo ví, tiền tệ, danh mục và kỳ tính từ ngày bắt đầu. Thu nhập và chuyển tiền không phải chi tiêu ngân sách. |
| Khoản cố định | Tạo độc lập hoặc liên kết ngân sách. Tạo/sửa/tạm dừng kế hoạch không tự tạo giao dịch hay chuyển tiền. |
| Hạn mức còn lại | Hạn mức trừ các khoản chi thực tế trong kỳ đến ngày xem. |
| Còn lại sau khoản cố định | Hạn mức trừ đã chi, rồi trừ các kỳ cố định chưa thanh toán trong kỳ ngân sách. Không phải số dư ngân hàng. |
| Đã chi | Người dùng xác nhận đúng kỳ phải trả; tạo một giao dịch hoặc liên kết giao dịch đã ghi. Một khoản/kỳ chỉ có một giao dịch đang hiệu lực. |
| Thanh toán sớm/khác số tiền | Theo liên kết khoản/kỳ, không đoán từ số tiền/ngày. Ghi đúng số tiền, ngày và ví thực tế; cho dùng ví khác cùng tiền tệ. |
| Quá hạn | Khoản chưa thanh toán vẫn được nhắc khi sang tháng. Tạm dừng kế hoạch sẽ ngừng lịch nhắc; không xóa giao dịch trước đó. |
| QR/ngân hàng | Đọc ảnh trên thiết bị; kiểm tra cấu trúc, CRC và tiền tệ. Người dùng kiểm tra người nhận trước khi mở liên kết ngân hàng được cho phép. Mở app ngân hàng không chứng minh thanh toán thành công. |
| Cảnh báo thực tế | Chi đã ghi chạm/vượt ngưỡng ngân sách. Dự phòng ví cảnh báo khi số dư ghi nhận thấp hơn mức đặt. |
| Cảnh báo dự báo | Ước tính theo tốc độ chi đã ghi; cần ít nhất ba ngày trong kỳ và có giao dịch khi kỳ chưa kết thúc. Không cộng thêm khoản dự kiến vào tốc độ này. |
| Đọc thông báo | Chỉ đổi trạng thái đã đọc; không tự xử lý rủi ro, trả tiền hay tạm dừng quy tắc. |

Ví dụ: hạn mức 1.000 USD, đã chi 850 USD, còn khoản cố định 50 USD chưa trả:
còn sử dụng sau khoản cố định là 100 USD. Nếu thực trả 45 USD từ đúng ví ngân sách:
đã chi thành 895 USD, khoản chưa trả thành 0 USD, còn 105 USD.
Các khoản không liên kết ngân sách vẫn được theo dõi ở lịch và cảnh báo của ví;
chúng không tự lấy hạn mức của một ngân sách bất kỳ.

## Các lỗi đã sửa trong lần kiểm tra này

1. Bỏ suy đoán đã trả dựa trên giao dịch cùng số tiền/danh mục và ngày gần nhau.
2. Sửa số tiền còn dùng sau khoản chưa trả, trạng thái thiếu hạn mức và cách diễn đạt EN/VI/ZH.
3. Giữ khoản quá hạn; không bỏ sót kỳ kế tiếp sau lịch sử hơn 400 kỳ đã thanh toán.
4. Phân loại chi cố định thực tế theo liên kết đã xác nhận; giữ được phân loại khi bỏ kế hoạch.
5. Cho tạo khoản cố định khi chưa có ngân sách; không tự liên kết ngân sách đầu tiên.
6. Form chỉ đóng sau khi máy chủ lưu thành công. Lỗi lưu giữ nội dung để thử lại với cùng ID.
7. Thêm kiểm tra nghiệp vụ ở server: số tiền dương/độ chính xác tiền tệ, kỳ, liên kết ví/danh mục;
   chặn đổi tiền tệ làm diễn giải lại số tiền lịch sử hoặc khoản cố định đang liên kết.
8. Kiểm tra server đối với liên kết thanh toán mới: khoản đang áp dụng, ví hoạt động,
   đúng danh mục, lịch và tiền tệ; ngày thanh toán không nằm trong tương lai.
9. Đọc liên kết thanh toán từ cột database chính thức, không phụ thuộc bản JSON cũ.
10. Chặn tab tài khoản cũ đọc/ghi Safety khi cookie đã chuyển sang tài khoản khác.
11. GET Safety tính lại giá trị hiện tại mà không sửa revision, lịch sử hay gửi email.
12. Thông báo lỗi khi không làm mới được Safety; dịch nội dung nhắc tài chính theo ngôn ngữ đã chọn.
13. Tách hộp thoại khỏi thẻ có CSS transform bằng portal vào gốc app, giữ theme;
    sửa lỗi hộp thoại thanh toán lệch vị trí và nút đóng không ổn định.
14. Giữ đúng độ chính xác của tiền tệ có ba chữ số thập phân trong tính ngân sách/số dư.

## Database và bảo vệ dữ liệu

- Tài khoản đăng nhập dùng bảng PostgreSQL cho ví, danh mục, liên kết danh mục–ví,
  giao dịch, ngân sách, khoản cố định, người nhận, cài đặt, quy tắc và lịch sử cảnh báo.
  Xem [cấu trúc database](DATABASE.md).
- Server lấy chủ sở hữu từ session, kiểm tra origin và header phát hiện đổi tài khoản.
  Header này không cấp quyền. Truy vấn có điều kiện chủ sở hữu và tham số SQL.
- Khóa ngoại ghép theo tài khoản, transaction database, revision và mutation ID bảo vệ
  quan hệ, chống ghi đè giữa thiết bị và chống tạo trùng khi thử lại.
- Lỗi kiểm tra/lưu rollback toàn bộ; không để ngân sách và giao dịch lưu một nửa.
- Bỏ dữ liệu khỏi giao diện dùng soft delete; revision giữ bản trước. Đóng tài khoản
  chặn đọc/ghi và email, không xóa cứng lịch sử tài chính.
- Cảnh báo có giới hạn tần suất, lịch sử và hàng đợi email. Email chỉ tới email hiện tại
  đã xác minh của tài khoản, nội dung chung, không gửi số dư/tên ví cho nhà cung cấp.

## Cách chạy kiểm tra

Kết quả lần kiểm tra: các nhóm kiểm thử Planning, PostgreSQL, thanh toán, Safety,
thông báo và ba kịch bản trình duyệt bên dưới đã đạt; TypeScript và production build
thành công. Lint các module nghiệp vụ/hộp thoại vừa sửa đạt. Hồi quy onboarding đạt
22 kiểm tra, scenario phần dùng chung đạt 14; localization đạt 38, còn 2 TODO có sẵn
ở ví/chat ngoài phạm vi này. Không khẳng định lint toàn repository đã sạch.

Các bài PostgreSQL và trình duyệt chỉ chấp nhận database local `finbridge_auth_test`.
Tài khoản, số tiền, QR và người nhận đều là fixture; không tác động dữ liệu người dùng,
không gửi email thật, không chuyển tiền hay gọi AI thật.

| Lệnh | Nội dung |
| --- | --- |
| `npm run test:planning` | 9 trường hợp: tính tiền, tránh trừ trùng, quá hạn, lịch dài, tiền tệ, dữ liệu giả mạo, ngôn ngữ. |
| `npm run test:planning:postgres` | 5 luồng: lưu/tải, rollback API, cột thanh toán chính thức, tab sai tài khoản, GET không ghi. |
| `npm run test:workspace:postgres` | 11 kiểm tra bảng, tài khoản, đồng thời, thử lại, soft delete, đóng tài khoản. |
| `npm run test:bill-payments` | 9 kiểm tra QR, ghi nhận, trả trước, liên kết và chống trùng. |
| `npm run test:bill-payments:postgres` | 8 kiểm tra người nhận, ghi đồng thời, khóa unique, rollback và lịch sử. |
| `npm run test:safety` / `npm run test:safety:postgres` | 16 + 14 kiểm tra tính ngưỡng, nhóm thực tế/dự báo, cách ly, hàng đợi và đóng tài khoản. |
| `npm run test:proactive-alerts` / `npm run test:notification-center` | 7 + 7 kiểm tra nhắc và trạng thái đọc. |
| `node scripts/verify-planning.cjs` | Handler thực của form tạo/sửa/tạm dừng, kiểm tra dữ liệu đang thay đổi. |
| `npm run test:notification-center:ui` | Trình duyệt: chuông chung, thất bại/thử lại, lịch sử, ngân sách, tạo khoản độc lập, desktop/mobile. |
| `scripts/verify-bill-payments-ui.mjs` | Trình duyệt: QR, người nhận, chuyển app, ghi một lần, lỗi lưu/thử lại, liên kết giao dịch, EN/VI/ZH. |
| `scripts/verify-safety-ui.mjs` | Trình duyệt: cấu hình nhiều ngưỡng thực tế/dự báo, pause/resume, danh mục mới, trình duyệt thứ hai. |

Hai script UI cuối chạy với Node strip-types và loader như script UI trong package.json.

## Giới hạn và việc cần làm khi triển khai

- Kiểm tra này là kiểm thử code và workflow, không thay thế pentest/kiểm toán bảo mật độc lập.
- Số dư là sổ người dùng tự ghi; chưa đồng bộ hay đối soát ngân hàng. Phải thử deep link
  trên điện thoại/ngân hàng mục tiêu trước khi quảng bá hỗ trợ thanh toán.
- Nút đã thanh toán xác nhận hoàn tất một kỳ. Chưa có quy trình theo dõi thanh toán
  từng phần/trả góp cho cùng kỳ; không nên diễn giải một khoản ghi nhận thành đối soát ngân hàng.
- Email chạy nền cần scheduler POST `/api/internal/safety`, secret và cấu hình gửi thư;
  bật biến môi trường không tự tạo scheduler. Local test dùng sender giả lập, chưa chứng minh
  thư thật vào inbox. Chi tiết tại [Safety Alerts](safety/SAFETY_ALERTS.md).
- Nhắc tài chính tính từ dữ liệu hiện tại và lưu trạng thái đọc; lịch sử sự kiện ngưỡng được
  lưu riêng. Cảnh báo dự phòng hiện theo số dư ghi nhận; không phải dự báo dự phòng sau mọi nghĩa vụ.
- Giới hạn bản hiện tại: 50 ví, 500 ngân sách/mục tiêu, 500 khoản cố định, 20.000 giao dịch;
  workspace ghi theo revision toàn bộ, chưa phải sổ cái ngân hàng hay đồng bộ cộng tác thời gian thực.
- API lịch sử ngưỡng hiện tải 100 sự kiện gần nhất; sự kiện cũ vẫn nằm trong PostgreSQL.
  Chỉ số chưa đọc và thao tác theo ID trong chuông đang dựa trên tập đã tải. Cần phân trang
  lịch sử và tổng số chưa đọc từ server trước khi dùng các chỉ số này như thống kê toàn bộ
  lịch sử dài hạn. Đây là giới hạn còn lại, không phải mất dữ liệu database.
- Trước production cần cấu hình HTTPS/TLS database, sao lưu và thử khôi phục, theo dõi lỗi worker,
  hạn mức email và chính sách lưu giữ dữ liệu. Không tuyên bố đạt chứng nhận tuân thủ từ các test này.

## Bàn giao chỉnh UI

Giữ các công thức, liên kết khoản/kỳ và điều kiện xác nhận. Không tự ghi “đã thanh toán”
khi mở app ngân hàng. Không bỏ trạng thái lỗi/chờ lưu, guard session/origin/owner/revision,
hoặc biến dữ liệu PostgreSQL thành dữ liệu chỉ lưu localStorage. Chạy lại các kiểm tra trên
sau khi Antigravity đổi form/hộp thoại/nút điều hướng.
