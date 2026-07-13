# Hướng Dẫn Demo & Báo Cáo — AI Bus Booking System

Tài liệu này dành cho buổi demo/vấn đáp với giảng viên. Làm theo đúng thứ tự.

## 1. Chuẩn bị (trước buổi demo)

- Node.js >= 22, Docker Desktop đang chạy.
- Cổng trống: `3000` (web), `4000` (gateway), `4010` (MCP), `8080` (nginx), `5432`, `6379`, `5672`, `9092`.
  - **Lưu ý:** nếu đang chạy lab khác (vd. container `redis_w09`, `rabbitmq_w09`) sẽ trùng cổng 6379/5672 — dừng chúng trước: `docker stop redis_w09 rabbitmq_w09`.
- Chatbot AI (tool calling qua model) cần `OPENAI_API_KEY` trong `.env`. Không có key vẫn demo được chatbot ở chế độ gọi tool trực tiếp.

## 2. Khởi động toàn bộ hệ thống

```bash
npm install          # lần đầu
npm run dev:all      # bật infra (docker) + 11 process service/worker/web
```

Chờ banner `SYSTEM IS READY FOR DEMO!` (~35s). Nếu cần làm lại từ đầu (xóa sạch dữ liệu): `npm run dev:reset`.

| Thành phần | URL |
|---|---|
| Web (khách) | http://localhost:3000 |
| Admin portal | http://localhost:3000/admin/login |
| GraphQL Gateway | http://localhost:4000/graphql |
| MCP Server | http://localhost:4010/mcp |
| Nginx reverse proxy (rate limit 10 req/s/IP) | http://localhost:8080 |
| RabbitMQ management | http://localhost:15672 (guest/guest) |

## 3. Tài khoản & dữ liệu demo

Xem chi tiết trong [DEMO_DATA.md](DEMO_DATA.md). Tóm tắt:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@example.com | admin123 |
| Staff (check-in) | staff@example.com | staff123 |
| Customer | customer@example.com | customer123 |

## 4. Kịch bản demo theo 5 module của giảng viên

### Module 1 — Tìm kiếm chuyến & danh mục
1. Vào http://localhost:3000, nhập **TP.HCM → Da Lat** (autocomplete hiện gợi ý), chọn ngày có chuyến (xem DEMO_DATA.md), bấm Tìm chuyến.
2. Trình bày: bộ lọc (giờ, giá, nhà xe), sắp xếp (giá thấp nhất / sớm nhất), số ghế trống.
3. Chọn ngày không có chuyến → hệ thống **gợi ý ngày gần nhất**.
4. Mở chi tiết chuyến → điểm đón/trả, chính sách hủy, **SEO title** (view-source thấy metadata "Vé xe TP.HCM đi Đà Lạt ngày ...").
5. Nói thêm: mỗi lượt tìm ghi Kafka `search-events` (topic cho analytics), kết quả phổ biến cache Redis (`cacheHit`).

### Module 2 — Chọn ghế & giữ chỗ thời gian thực
1. Trong trang chi tiết chuyến, chọn 1 ghế trống → bấm giữ ghế.
2. Trình bày: đếm ngược TTL 5 phút, ghế chuyển `HELD` realtime qua **GraphQL Subscription** (mở 2 tab cùng chuyến để thấy tab kia cập nhật).
3. **Race condition:** mở 2 trình duyệt, cùng chọn 1 ghế, bấm giữ gần như đồng thời → chỉ 1 bên thành công (Redis Lua `SET NX EX` + Postgres `FOR UPDATE`). Có test tự động: `npm run test:seat:race`.

### Module 3 — Đặt vé, thanh toán mô phỏng, vé & thông báo
1. Từ ghế đang giữ → Checkout: nhập email + thông tin hành khách (guest, không cần đăng nhập).
2. Trang thanh toán → bấm **"Thanh toán thành công"**.
3. Trang xác nhận hiện mã booking; sau vài giây Ticket Worker (RabbitMQ `booking.paid`) sinh vé điện tử HTML + QR mô phỏng `bookingCode-ticketId`; Email Worker ghi log "gửi email".
4. Tra cứu vé: http://localhost:3000/lookup bằng **mã booking + email** (bắt buộc đủ cả hai).
5. Nói thêm: state machine `PENDING_PAYMENT → PAID → TICKET_ISSUED`; quá hạn thanh toán tự `EXPIRED` và nhả ghế.

### Module 4 — Quản trị & vận hành
1. Đăng nhập http://localhost:3000/admin/login bằng **staff** → chỉ thấy trang Bookings/Check-in (phân quyền STAFF).
2. Check-in booking `BK202606240001` tại Boarding Desk → trạng thái thành `CHECKED_IN`.
3. Đăng xuất, đăng nhập **admin** → đủ menu: Dashboard, Trips, Routes, Vehicles, Locations, Bookings, Event Logs.
4. Demo CRUD chuyến, **khóa ghế không bán** (Block Seats với lý do), đổi trạng thái chuyến, xem Event Logs.

### Module 5 — Analytics, Chatbot AI & MCP
1. Admin Dashboard: doanh thu ngày, vé theo tuyến, top tuyến tìm kiếm, tỷ lệ booking thành công (từ Kafka consumer + bảng `analytics_daily`, có **idempotency bằng eventId** chống đếm trùng).
2. Chatbot (widget trên web): hỏi "Tìm chuyến TP.HCM đi Đà Lạt ngày mai", hỏi chính sách hủy vé (bot trích **nguồn** `bus://policy/cancellation`), tra booking bằng mã + email.
3. MCP Server — demo bằng curl:

```bash
curl -s http://localhost:4010/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

curl -s http://localhost:4010/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_trips","arguments":{"origin":"TP.HCM","destination":"Da Lat","departureDate":"2026-07-16"}}}'

curl -s http://localhost:4010/mcp -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"resources/read","params":{"uri":"bus://policy/cancellation"}}'
```

## 5. Chạy kiểm thử (chứng minh chất lượng)

```bash
npm run test:unit                # 120+ unit tests across shared, web, services, workers, readiness
npm run test:seat:race           # chứng minh chống race condition ghế
npm run test:analytics:integration  # Kafka producer -> consumer + dedup eventId
npm run test:web:e2e             # Playwright: luồng khách đặt vé + admin/staff (cần hệ thống đang chạy infra)
```

## 6. Reset dữ liệu demo giữa các lần chạy

```bash
# Trả ghế A04 + booking BK202606240001 về trạng thái ban đầu (sau demo check-in/block)
docker exec bus-postgres psql -U bus_app -d bus_booking -c "
  update trip_seats set status='AVAILABLE', block_reason=null where seat_label='A04' and trip_id='00000000-0000-4000-8004-000000000001';
  update bookings set status='TICKET_ISSUED' where booking_code='BK202606240001';
  delete from bookings where contact_email like 'e2e-%@example.com';"
```

Reset toàn bộ (xóa hết dữ liệu, seed lại): `npm run dev:reset`.

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| `EADDRINUSE 50051..50056` | Service cũ còn chạy — tắt process node cũ rồi chạy lại |
| Redis/RabbitMQ không lên | Trùng cổng với container lab khác — `docker stop redis_w09 rabbitmq_w09` |
| Kafka Exited(1) | Kafka bật trước Zookeeper — `docker start bus-kafka` lại sau vài giây |
| Chatbot báo `AI_PROVIDER_UNCONFIGURED` | Thiếu `OPENAI_API_KEY` — vẫn demo được bằng nút gọi tool trực tiếp |
| Trang admin trống với staff | Đúng thiết kế: STAFF chỉ có quyền check-in |
