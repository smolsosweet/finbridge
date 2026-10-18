# Triển khai FinBridge: Render + PostgreSQL

Hướng dẫn dành cho repo `smolsosweet/finbridge`, cập nhật ngày 18/10/2026.
Code đang ở nhánh `feature/compact-business-workspace`. Không cần merge main để triển khai nhánh này.

## 1. Phạm vi lần triển khai đầu

Dùng một Render Web Service chạy Next.js và một Render Postgres lưu dữ liệu.
Brevo gửi email xác minh, đặt lại mật khẩu; Google cung cấp đăng nhập OAuth.
Gemini là tùy chọn riêng cho các tính năng AI. Frankfurter không cần cài repo hoặc API key.

Đây là bản online để team kiểm tra và trình diễn cuộc thi. Build thành công chưa xác nhận
đã đủ mọi yêu cầu vận hành với dữ liệu tài chính thật. Repo vẫn ghi nhận vấn đề cần
kiểm tra ở proxy/giới hạn đăng nhập: xem `docs/auth/AUTH_FLOW_ACCEPTANCE_2026-10-14.md`.
Cần xác nhận proxy không cho người gọi tự thay địa chỉ để vượt giới hạn, có bảo vệ
chống lạm dụng phù hợp và kiểm tra khôi phục backup trước khi mở rộng cho người dùng thật.

Lần đầu nên tạo database cloud mới rồi đăng ký tài khoản thử trên website online.
Push Git chỉ đưa code lên GitHub; tài khoản và dữ liệu PostgreSQL ở máy bạn không tự chuyển lên.
Không đưa database mẫu chứa thông tin cá nhân lên môi trường công khai.

## 2. Chọn gói và chuẩn bị

Chuẩn bị tài khoản GitHub, Render, Google Cloud và tài khoản Brevo hiện có.

- Web Service trả phí hỗ trợ pre-deploy migration và tránh cơ chế ngủ của web Free.
- Postgres trả phí phù hợp để giữ dữ liệu lâu dài và có tính năng phục hồi/backup.
- Free web dùng để thử, có thể ngủ khi không có truy cập. Free Postgres hết hạn sau 30 ngày,
  không có backup do Render quản lý. Kiểm tra giá hiện trên Dashboard trước khi tạo dịch vụ.
- Cron cảnh báo là một dịch vụ tính phí riêng nếu dùng Render Cron Job.

Không cần mua tên miền ngay; dùng địa chỉ HTTPS `*.onrender.com` trước.
Tên `finbridge-preview` trong hướng dẫn chỉ là ví dụ; dùng URL Render thực sự cấp cho bạn.

Nguồn: [Render Free](https://render.com/docs/free),
[backup PostgreSQL](https://render.com/docs/postgresql-backups).

## 3. Tạo PostgreSQL trên cloud

1. Vào Render Dashboard, chọn **New + > Postgres**.
2. Name: `finbridge-db`. Database: `finbridge`. User: dùng tên Render tạo hoặc tên riêng.
3. Region: chọn vùng phù hợp và ghi lại; web phải ở cùng account và region.
4. PostgreSQL: chọn phiên bản được Render hỗ trợ; nếu định restore dữ liệu cũ,
   xác nhận tương thích phiên bản với bản backup trước.
5. Chọn compute/storage phù hợp, bấm Create Database, đợi **Available**.
6. Mở **Connect** và phân biệt:
   - Internal Database URL: web Render cùng vùng sử dụng.
   - External Database URL: pgAdmin trên máy bạn sử dụng.
7. Trong Networking, thay quyền truy cập external mặc định rộng bằng IP công cộng
   của máy quản trị `/32`, hoặc tắt external nếu không dùng pgAdmin. Không dùng IP LAN
   như `192.168.x.x` làm IP cho cloud. IP mạng nhà đổi thì cập nhật allow list.

Cất connection string trong nơi quản lý mật khẩu. Không gửi nó vào chat hoặc commit.

### TLS cho kết nối của ứng dụng

Mã hiện dùng thư viện `pg`; không có cấu hình SSL riêng. Tham số TLS nằm trong DATABASE_URL.

Với Internal URL của Render, thêm `sslmode=require&uselibpqcompat=true` vào query string.
Ví dụ chỉ minh họa định dạng:

```text
postgresql://USER:PASSWORD@INTERNAL_HOST:5432/finbridge?sslmode=require&uselibpqcompat=true
```

Nếu URL đã có dấu `?`, thêm các tham số mới bằng `&`, tránh lặp `sslmode`.
Internal TLS của Render dùng chứng chỉ tự ký: chế độ này mã hóa kết nối trong private
network, không cung cấp kiểm tra tên máy chủ như `verify-full`. Tham số `uselibpqcompat`
phù hợp cách xử lý sslmode của phiên bản pg hiện cài trong repo.

Khi kết nối external, dùng hostname đầy đủ và `sslmode=verify-full` để mã hóa và
kiểm tra chứng chỉ/tên máy chủ. Không khắc phục lỗi TLS bằng `sslmode=disable`.

Nguồn: [Render Postgres: kết nối, TLS và networking](https://render.com/docs/postgresql-creating-connecting).

## 4. Tạo Web Service

1. Render Dashboard > **New + > Web Service**.
2. Kết nối GitHub, chọn `smolsosweet/finbridge`.
3. Branch: **feature/compact-business-workspace**.
4. Runtime/Language: **Node**, không chọn Static Site.
5. Root Directory: để trống vì package.json nằm ở gốc repo.
6. Region: cùng vùng với PostgreSQL.
7. Auto-Deploy: **Off** trong lần cấu hình đầu. Sau khi kiểm tra xong có thể bật
   On Commit; mọi push vào nhánh được chọn sẽ có khả năng đưa giao diện mới lên web.
8. Chọn gói web. Hướng dẫn pre-deploy bên dưới dùng web trả phí.
9. Build Command:

```bash
npm ci --include=dev && npm run build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/
```

10. Start Command:

```bash
node .next/standalone/server.js
```

Repo bật `output: standalone`. Hai thao tác copy sau build cần thiết để server phục vụ
CSS, JavaScript, mascot và các ảnh trong public. Các lệnh này chạy trên Linux của Render.
Không dùng `npm run dev` để phục vụ bản online.

Nguồn: [Render cho Next.js](https://render.com/docs/deploy-nextjs-app).
Cách đóng gói standalone được đối chiếu với tài liệu phiên bản Next.js đang cài trong repo.

## 5. Điền Environment trên Render

Chỉ điền secret trong Render Dashboard. Không upload `.env.local` vào GitHub.

| Biến | Giá trị |
| --- | --- |
| NODE_VERSION | `24` (giới hạn trong Node 24) |
| NODE_ENV | `production` |
| HOSTNAME | `0.0.0.0` |
| DATABASE_URL | Internal Database URL đã cấu hình TLS ở bước 3 |
| BETTER_AUTH_URL | URL HTTPS chính xác của web, ví dụ `https://finbridge-preview.onrender.com` |
| BETTER_AUTH_SECRET | Chuỗi ngẫu nhiên mới cho môi trường online, ít nhất 32 ký tự |
| GOOGLE_CLIENT_ID | OAuth Client ID cho môi trường online |
| GOOGLE_CLIENT_SECRET | OAuth Client Secret tương ứng |
| AUTH_EMAIL_MODE | `brevo` |
| BREVO_API_KEY | API key Brevo đang dùng để gửi transactional email |
| AUTH_EMAIL_FROM | Chỉ địa chỉ sender đã Verified trong Brevo |
| GEMINI_API_KEY | API key Gemini nếu muốn tính năng AI hoạt động |
| GEMINI_TRANSACTION_MODEL | Model được tài khoản Gemini hỗ trợ; repo mặc định `gemini-3.1-flash-lite` |
| FINBRIDGE_ENABLE_TRANSFER_SANDBOX | `true` cho bản trình diễn có chuyển thử; `false` để tắt chuyển thử |
| FINBRIDGE_DEMO_MODE | `false` |
| SAFETY_EMAIL_ENABLED | `false` lúc đầu; bật sau bước scheduler |

Render tự cấp PORT; không cố định cổng localhost. BETTER_AUTH_URL là origin, không có
`/app`, query string hay đường dẫn login. Nếu Render cấp URL khác tên dự kiến,
đổi biến này theo URL thật và redeploy trước khi thử đăng nhập.

Không cấu hình AUTH_TEST_DATABASE_URL trên web online. Không dùng AUTH_EMAIL_MODE=local:
code từ chối chế độ đó ở production. Nếu dùng Brevo API thì không cần SMTP_USER/SMTP_PASSWORD.

Có thể tạo secret bằng chức năng Generate trên dịch vụ quản lý secret hoặc chạy trên
máy riêng và lưu kết quả trực tiếp vào trình quản lý mật khẩu:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Tạo secret riêng cho auth và cron. Sau khi đã có tài khoản trên cloud, giữ ổn định
BETTER_AUTH_SECRET: nó tham gia mã hóa token OAuth và thông tin lifecycle, không phải
biến nên thay mỗi lần deploy. Backup secret phải được quản lý cùng kế hoạch khôi phục.

Nguồn: [chọn phiên bản Node trên Render](https://render.com/docs/node-version).

## 6. Google OAuth và Brevo

1. Vào Google Cloud Console, chọn project OAuth.
2. Trong **Google Auth Platform > Clients** (hoặc APIs & Services > Credentials),
   tạo/chọn OAuth client loại **Web application**. Nên có client riêng cho online.
3. Authorized JavaScript origins: thêm origin HTTPS của web.
4. Authorized redirect URIs: thêm chính xác:

```text
https://YOUR-APP.onrender.com/api/auth/callback/google
```

5. Thay YOUR-APP bằng URL thật; giữ nguyên phần callback. Lưu lại.
6. Nếu consent app đang Testing, cấu hình người dùng thử theo Audience của Google.
   Khi phát hành rộng, xử lý trạng thái publishing/verification theo những scope
   thực sự xin quyền và yêu cầu trên Console. Không xin quyền Gmail/Drive để đăng nhập cơ bản.
7. Đặt client ID/secret tương ứng vào Render.
8. Trong Brevo, kiểm tra sender vẫn Verified, tài khoản được phép gửi transactional email.
   Dùng API key trong mục API Keys. Với tên miền riêng, hoàn tất xác thực DNS theo Brevo.
9. Email xác minh/reset online phải chứa URL HTTPS của web, không phải localhost.

Nguồn: [Google OAuth cho web server](https://developers.google.com/identity/protocols/oauth2/web-server),
[Brevo transactional email](https://developers.brevo.com/docs/send-a-transactional-email).

## 7. Khởi tạo đầy đủ bảng database và deploy

Với Web Service trả phí, mở Settings > Build & Deploy, đặt **Pre-Deploy Command**:

```bash
npm run auth:migrate
```

Lệnh này đã bao gồm auth, lifecycle đóng tài khoản, onboarding, workspace, bảng tài chính,
ngưỡng/cảnh báo, chuyển tiền thử và ước tính tỷ giá. Tên auth:migrate là tên lịch sử;
không phải chỉ khởi tạo mỗi bảng user. Không cần chạy một loạt INSERT/CREATE TABLE thủ công.

Trong lần khởi tạo, DATABASE_URL cần quyền owner/migration để tạo bảng/index.
Chạy migration trước khi cho người dùng ghi dữ liệu. Với database đã có dữ liệu,
backup trước khi thay schema; không chạy nhiều migration đồng thời.

Bấm **Manual Deploy > Deploy latest commit**. Trình tự mong đợi:
Build thành công > schema migrated > server khởi động > trạng thái Live.
Nếu lỗi ở migration, sửa nguyên nhân và deploy lại; không xóa database để thử lại.

Pre-deploy command chỉ có trên các loại dịch vụ Render hỗ trợ (trong đó có web trả phí).
Nếu dùng web Free, thực hiện migration riêng từ máy quản trị với External URL/TLS trước
khi mở web, hoặc dùng công cụ migration có môi trường riêng. Không đổi `.env.local` đang
phục vụ localhost sang cloud chỉ để chạy thử; điều đó dễ khiến bạn ghi nhầm database.

Đối với vận hành thật, tách credential migration khỏi credential ứng dụng: role chạy app
chỉ có quyền dữ liệu cần thiết, không sở hữu schema và không có DROP/ALTER. Đây là bước
hardening cần xác nhận riêng; pre-deploy dùng chung DATABASE_URL là cấu hình khởi tạo bản
kiểm thử, chưa phải sự tách quyền hoàn chỉnh. Khi tách quyền phải cập nhật quy trình cấp
quyền cho bảng mới và chạy lại kiểm thử đóng tài khoản/auth/workspace, không chỉ kiểm tra login.

Nguồn: [Render deploy và pre-deploy](https://render.com/docs/deploys).

## 8. Kết nối pgAdmin4 với database online

1. Render database > Connect: lấy hostname, port, database name, username và password external.
2. Thêm IP công cộng máy bạn vào Networking allow list nếu chưa có.
3. pgAdmin > Servers > Register > Server.
4. General > Name: `FinBridge Render` để phân biệt với localhost.
5. Connection > Host: hostname external đầy đủ; Port: `5432`; Maintenance database:
   tên database cloud; Username/Password: thông tin cloud. Không dùng `localhost`/`5434`.
6. Parameters/SSL (tùy phiên bản pgAdmin) > SSL mode: `verify-full`.
   Nếu client cần CA root, cấu hình trust store/CA phù hợp rồi kết nối; không tắt SSL.
7. Save > Databases > database của bạn > Schemas > public > Tables > Refresh.
8. Sau migration sẽ có các bảng auth và nhiều bảng `finbridge_*`.
9. Đăng ký trên web rồi xem user, finbridge_wallets, finbridge_transactions,
   finbridge_budgets, finbridge_fixed_expenses để đối chiếu. Dùng SELECT khi kiểm tra;
   không chỉnh trực tiếp password hash, emailVerified hay trạng thái account.

pgAdmin chỉ là công cụ quản lý; không phải database server và không cần mở máy bạn
để web online hoạt động. Backup/download có thể chứa toàn bộ thông tin tài khoản:
chỉ lưu nơi riêng tư, không đặt trong repo.

## 9. Scheduler cho ngưỡng an toàn và email

Web không tự chạy định kỳ chỉ nhờ có biến môi trường. Dự án có endpoint POST
`/api/internal/safety`; cần scheduler để đánh giá cả khi user không mở trình duyệt.

1. Tạo SAFETY_CRON_SECRET ngẫu nhiên riêng, ít nhất 32 ký tự, đặt vào Web Service.
2. Render > New + > Cron Job, chọn repo và nhánh hiện tại, Node 24, cùng vùng.
3. Schedule: `*/5 * * * *` (5 phút/lần). Render dùng UTC; lịch này không cần đổi múi giờ.
4. Cron Environment: BETTER_AUTH_URL = origin HTTPS của web; SAFETY_CRON_SECRET =
   cùng secret với Web Service. Cron HTTP này không cần database URL hoặc Brevo key.
5. Build Command của cron: `true` vì chỉ dùng curl có sẵn ở native runtime.
6. Command của cron (chạy trong shell Render):

```bash
curl --fail --silent --show-error --connect-timeout 10 --max-time 240 --request POST --header "Authorization: Bearer $SAFETY_CRON_SECRET" "$BETTER_AUTH_URL/api/internal/safety"
```

7. Redeploy web để nhận secret; bấm Trigger Run ở cron, kiểm tra trạng thái thành công.
8. Bật SAFETY_EMAIL_ENABLED=true trên web, redeploy; tạo quy tắc bật email bằng tài khoản
   đã xác minh và dữ liệu thử do bạn kiểm soát. Kiểm tra lần chạy, queue và Brevo logs.
9. Có cảnh báo trong app không đồng nghĩa email đã đến inbox. Không dùng curl --verbose
   hoặc in request header khi debug vì Authorization chứa secret.

Worker hiện xử lý tối đa 50 account và 10 email mỗi lần. Khi có nhiều người dùng cần
đánh giá lại tần suất/công suất và thời gian xử lý. Email xác minh/reset không cần cron này.

Nguồn: [Render Cron Jobs](https://render.com/docs/cronjobs), `docs/safety/SAFETY_ALERTS.md`.

## 10. Kiểm tra bản online trước khi chia sẻ

- Signup email > nhận email HTTPS đúng domain > xác minh > login > logout.
- Google login > onboarding > tạo ví/giao dịch/ngân sách > reload vẫn còn.
- Đổi trình duyệt hoặc thiết bị: đăng nhập cùng account xem đúng dữ liệu.
- Account B không thấy dữ liệu account A.
- Quên mật khẩu: email đến, lưu mật khẩu mới thành công; mật khẩu cũ bị từ chối.
- Đóng một tài khoản thử với phiên mới: đăng xuất ngay, không truy cập lại dữ liệu cũ.
- Chuông là nơi xem cảnh báo; liên kết ví mở đúng ví được nhắc tới.
- Tỷ giá: nguồn/ngày lấy có hiển thị; lưu ước tính rồi reload vẫn còn bản cũ.
- Nếu bật sandbox: quote > review > approve > complete có một biên nhận;
  tiền theo dõi trong ví không tự đổi. Đây vẫn là chuyển thử, chưa kết nối đối tác chuyển tiền thật.
- Có API key Gemini hợp lệ thì kiểm tra AI trên dữ liệu thử; nếu không, ghi nhận tính năng AI chưa khả dụng.
- Theo dõi 5xx, lỗi auth, queue email và mức sử dụng database. Tránh đưa token/reset link vào log công khai.

## 11. Backup, dữ liệu local và các lần deploy tiếp theo

Tạo logical backup từ Render trước migration lớn; tải bản sao về kho riêng và thử restore
vào database khác. Rollback code không tự rollback schema hoặc dữ liệu.

Muốn giữ dữ liệu local: dùng pgAdmin Backup (Custom) rồi Restore vào database cloud mới,
kiểm tra version/quyền/schema và bí mật mã hóa đi kèm trước. Không restore đè cloud đã có
người dùng. Dữ liệu/secret từ local có thể chứa thông tin riêng và tài khoản thử: việc chuyển
cần một kế hoạch migration riêng, không phải thao tác bắt buộc của lần deploy đầu.

Khi teammate chỉnh UI:

1. Commit/push lên nhánh tính năng.
2. Chạy kiểm tra; nếu vẫn deploy nhánh đó và auto-deploy Off, chọn Manual Deploy.
3. Khi team sẵn sàng phát hành từ main, merge được duyệt rồi đổi Branch của web/cron sang main.
4. Giữ nguyên database và auth secret; không tạo lại database mỗi khi cập nhật UI.
5. Khi mua domain riêng: thêm domain trên Render, đợi DNS/TLS, đổi BETTER_AUTH_URL,
   thêm OAuth origins/callback tương ứng, cập nhật cron rồi redeploy và thử login/email lại.

Các lỗi thường gặp:

| Hiện tượng | Kiểm tra |
| --- | --- |
| redirect_uri_mismatch | Google callback có đúng HTTPS origin và /api/auth/callback/google |
| AUTH_PROVIDER_ERROR, không lưu dữ liệu | DATABASE_URL, TLS, region/private host, migration đã chạy |
| Đăng ký không có email | AUTH_EMAIL_MODE, sender Verified, Brevo key/quyền gửi, logs, spam |
| Email trỏ localhost | BETTER_AUTH_URL trên Render và đã redeploy sau khi đổi |
| Thiếu ảnh/mascot/CSS | Hai lệnh copy public và .next/static sau build |
| Server không bind port | HOSTNAME=0.0.0.0, dùng PORT Render cấp, đúng start command |
| AI 503 | GEMINI_API_KEY, model/quota/quyền tài khoản Gemini, không phải lỗi PostgreSQL |
| Không chuyển thử được | FINBRIDGE_ENABLE_TRANSFER_SANDBOX=true cho bản trình diễn |
| Không có email cảnh báo định kỳ | Cron POST + secret, SAFETY_EMAIL_ENABLED, opt-in của rule |
| Không thấy tài khoản local trên web | Database cloud mới độc lập; đăng ký lại trên web online |

Hướng dẫn này chuẩn bị cấu hình; chưa tạo dịch vụ, chưa trả phí và chưa deploy thay bạn.