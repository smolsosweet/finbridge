# Kiểm tra bản nộp FinBridge

Mục tiêu: bản Next.js/React + PostgreSQL (Neon), triển khai trên Vercel.
URL dự kiến: https://finbridge-orcin-phi.vercel.app
Không dùng hồ sơ Spring/H2 để mô tả bản này.

## Trước khi gộp main

1. Nhánh feature/ai-postgres-quota chứa các commit local theo tính năng.
   Đối chiếu origin/main trước khi merge; bảo toàn thay đổi của teammate.
2. Tạo Neon branch riêng từ production trong Neon Console. Preview dùng DATABASE_URL
   của branch đó, không dùng database production làm nơi chạy test.
3. Trên branch Neon: chạy npm run ai:quota:migrate để xem target, rồi chạy lại với
   -- --apply --confirm-target=HOST:PORT/DATABASE. Migration quota chỉ thêm bảng/
   index và control row nếu chưa có; không reset bộ đếm, tài khoản hoặc tiền.
4. Thêm quota/model/auth/email variables vào Vercel Preview trước; xem .env.example
   và AI_QUOTAS.md. Canonical BETTER_AUTH_URL phải trùng origin đang thử.
   Với Google OAuth, callback phải đăng ký đúng origin Preview hoặc tắt thử Google
   và dùng email demo. Không thay production URL sang URL nhánh chỉ để thử.
5. Deploy Preview từ commit đã ghi lại. Kiểm tra /api/release.commit khớp SHA.
   Chạy check:release với --url=PREVIEW_ORIGIN --sha=FULL_SHA.

## Bộ cấu hình production cần đối chiếu

- DATABASE_URL: Neon PostgreSQL có TLS; lưu dưới dạng server-only secret.
- BETTER_AUTH_URL: canonical HTTPS; BETTER_AUTH_SECRET; Google client ID/secret
  (auth factory hiện yêu cầu cả hai biến này ngay cả khi dùng email login).
- AUTH_EMAIL_MODE=brevo, BREVO_API_KEY, AUTH_EMAIL_FROM là sender đã xác minh.
- GEMINI_API_KEY; model text/audio thực tế và hạn mức trong cùng AI Studio project.
- AI_QUOTA_SERVER_DAILY_POINTS=300, AI_QUOTA_SERVER_DAILY_REQUESTS=300,
  AI_QUOTA_SERVER_MINUTE_REQUESTS=6, AI_QUOTA_USER_DAILY_POINTS=60,
  AI_QUOTA_USER_MINUTE_POINTS=6, AI_QUOTA_COOLDOWN_SECONDS=60.
- FINBRIDGE_DEMO_MODE không được true; chuyển tiền production mặc định khóa.
- SAFETY_EMAIL_ENABLED=false cho tới khi scheduler và gửi thư được thử thật.
- Fluid Compute bật; đối chiếu function maxDuration, đặc biệt receipt=60s, worker=180s.

check:deployment kiểm tra cấu hình trong môi trường lệnh đang chạy, không tự đọc
Vercel. Tùy chọn -- --database chỉ SELECT trong READ ONLY transaction và kiểm tra
tên bảng. Không in credentials, email người dùng hay dữ liệu tài chính.

## Thử Preview bằng dữ liệu giả

- Dùng mailbox chưa đăng ký: signup → nhận thư Brevo → bấm xác minh → login.
  HTTP 200 ở signup không chứng minh email đã gửi, nhất là email đã tồn tại.
- Gửi lại email với tài khoản chưa xác minh; xác nhận Brevo Sent/Delivered và inbox.
- Thử cả bảy route AI khi đã đăng nhập/xác minh. Ghi thời gian thực tế.
- Ở Preview đặt quota nhỏ để thử 429/Retry-After và nhập tay; sau đó hoàn lại profile.
  Không đốt quota production để thử giới hạn.
- Không đăng nhập/chưa xác minh/origin sai không được gọi Gemini.
- Ảnh điện thoại được thu nhỏ; file quá lớn, transcript dài và Gemini 429 không làm
  mất dữ liệu nhập tay. Thử micro/camera và đăng nhập Google sau security headers.
- Tạo hai account giám khảo bằng công cụ có guard trong DEMO_ACCOUNTS.md; thử login
  từ máy/mạng khác. Credential chỉ chia sẻ qua kênh nộp riêng.

## Sau khi Preview đạt

Migration quota trên production → biến Production → merge main → deploy.
Lưu FULL_SHA, URL deployment cụ thể, canonical alias, thời điểm và kết quả CI.
CI chạy push/PR vào main, có unit, PostgreSQL và build, không dùng Neon production.
CI gần nhất đã đối chiếu qua GitHub API: main ac411b342867b5fbdc4854b7610b591b068ae016,
conclusion=success: https://github.com/smolsosweet/finbridge/actions/runs/39224786894 .
Đó là kết quả main trước các commit local mới; chưa có CI remote cho nhánh chưa push.
Endpoint /api/release là dấu commit trong build; dashboard Vercel vẫn là nguồn để
xác nhận deployment URL, project, alias và trạng thái Ready.

| Mốc | SHA | URL deployment | Thời điểm | Kết quả |
| --- | --- | --- | --- | --- |
| main đối chiếu local | ac411b342867b5fbdc4854b7610b591b068ae016 | Chưa đối chiếu Vercel | 2026-10-19 | Chỉ fetch Git |
| Preview chứa các tính năng mới | Điền khi deploy | Chưa deploy | Chưa chạy | Pending |
| Production sau merge | Điền khi deploy | Chưa deploy | Chưa chạy | Pending |

Ở lần chuẩn bị này chưa push theo yêu cầu chủ dự án. Trình duyệt công cụ mở Vercel
gặp trang Login; không có phiên đăng nhập Vercel/Neon để xác minh cấu hình cloud.
Không được ghi các hàng Pending thành Passed dựa vào kết quả test local.

## Hồ sơ và video

Mô tả đúng: ví theo dõi thủ công; AI tạo đề xuất/nháp cần xác nhận; tính toán do code;
chuyển tiền quốc tế là sandbox và có thể bị khóa trong bản production.
Không tuyên bố chuyển tiền ngân hàng thật, Delegated Mode, Policy Guard, audit chain,
601 test, pentest/red-team/mutation hoặc bộ đánh giá Gemini của bản Spring.
Quyền dùng giao diện/tài sản Rolly còn cần chủ dự án cung cấp chứng cứ; xem
PROVENANCE_REVIEW.md. Privacy nêu Gemini Free, nhà cung cấp và đóng tài khoản
không xóa vĩnh viễn; chưa có lịch purge/backup deletion.
Video nên dùng dữ liệu giả và giải thích rõ luồng nhập tay khi AI hết lượt.
