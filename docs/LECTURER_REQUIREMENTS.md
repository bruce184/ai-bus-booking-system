# Yêu Cầu Nghiệp Vụ - Giảng Viên Spec

Dưới đây là các yêu cầu nghiệp vụ gốc được cung cấp bởi Giảng Viên dành cho dự án Hệ thống đặt vé xe khách liên tỉnh tích hợp AI.

## Tổng Quan Hệ Thống

Hệ thống đặt vé xe khách liên tỉnh tích hợp AI.
- **Người dùng**: Có thể tìm chuyến xe từ tỉnh/thành A đến tỉnh/thành B, chọn ngày đi, lọc chuyến, chọn ghế trên sơ đồ xe, nhập thông tin hành khách, thanh toán mô phỏng và nhận vé điện tử.
- **Admin**: Có thể quản lý tuyến, xe, chuyến, đặt chỗ, check-in hành khách và xem báo cáo doanh thu.
- **AI Chatbot**: Hỗ trợ tìm chuyến, giải thích chính sách vé và tra cứu trạng thái booking.
- **MCP Server**: Cung cấp một MCP Server để AI client bên ngoài có thể gọi tool tra cứu chuyến và booking.
- **Công nghệ bắt buộc**: GraphQL, gRPC, Microservices, RabbitMQ/Kafka, Redis, Nginx, NextJS, AI SDK và MCP Server.

## 1. Các Vai Trò Người Dùng

### 1.1. Guest Customer
- Tìm chuyến, chọn ghế, nhập thông tin hành khách.
- Thanh toán mô phỏng và nhận vé qua email.
- Không bắt buộc đăng ký / đăng nhập.

### 1.2. Registered Customer
- Thừa hưởng tất cả quyền lợi của Guest Customer.
- Xem lịch sử đặt vé.
- Lưu thông tin hành khách thường dùng.
- Hủy vé theo chính sách.

### 1.3. Admin
- Quản lý tuyến xe, bến xe/điểm dừng, xe và cấu hình sơ đồ ghế.
- Tạo chuyến xe, gán xe, cấu hình giá vé, giờ đi/đến.
- Kích hoạt hoặc tạm khóa chuyến xe.
- Xem danh sách đặt chỗ (bookings) theo chuyến.
- Check-in hành khách.
- Khóa ghế không bán.
- Xem báo cáo doanh thu & event logs.

### 1.4. Check-in Staff
- Có thể là vai trò đơn giản thuộc nhóm Admin.
- Tra cứu vé bằng mã booking hoặc mã QR code mô phỏng.
- Đánh dấu hành khách đã lên xe.

---

## 2. Các Chức Năng Cần Có

- Tìm chuyến xe theo điểm đi, điểm đến, ngày đi.
- Autocomplete tỉnh/thành hoặc bến xe.
- Lọc chuyến theo giờ đi, giá, nhà xe, số ghế còn trống.
- Xem chi tiết chuyến và sơ đồ ghế.
- Chọn ghế với cập nhật trạng thái ghế gần thời gian thực.
- Giữ ghế tạm thời trong Redis bằng TTL (ví dụ: 5 phút).
- Đặt vé với tài khoản hoặc guest checkout.
- Thanh toán mô phỏng.
- Sinh vé điện tử dạng HTML/PDF đơn giản.
- Gửi email mô phỏng hoặc ghi log email.
- Admin CRUD tuyến, xe, chuyến.
- Admin check-in hành khách.
- Dashboard doanh thu và số lượng booking.
- Chatbot AI hỗ trợ tìm chuyến và hỏi chính sách.
- MCP Server cung cấp tool tra cứu chuyến và booking.

---

## 3. Các Phân Hệ/Module Chính

### 3.1. Module 1 — Tìm kiếm Chuyến đi & Danh mục Dịch vụ
- **Tìm kiếm**: Điểm đi, điểm đến, ngày đi.
- **Autocomplete**: Ví dụ: "TP.HCM", "Đà Lạt", "Nha Trang", "Cần Thơ".
- **Hiển thị**: Giờ đi, giờ đến, nhà xe, loại xe, giá vé, số ghế còn lại.
- **Bộ lọc & Sắp xếp**:
  - Lọc theo khoảng giờ, giá vé, nhà xe, loại xe, số ghế trống.
  - Sắp xếp theo giá thấp nhất, giờ đi sớm nhất, thời gian di chuyển ngắn nhất.
- **Trang chi tiết chuyến**: Xem điểm đón, điểm trả, chính sách hủy vé và sơ đồ ghế.
- **Caching**: Lưu các lượt tìm kiếm phổ biến vào Redis.
- **Analytics**: Ghi event tìm kiếm vào Kafka topic `search-events` phục vụ analytics.
- **SEO**: Trang tuyến xe chứa metadata SEO (ví dụ: title "Vé xe TP.HCM đi Đà Lạt ngày 20/06").
- **Gợi ý**: Gợi ý ngày gần nhất nếu ngày được chọn không còn chuyến.
- **Dữ liệu mẫu**:
  - Tỉnh/thành: TP.HCM, Đà Lạt, Nha Trang, Cần Thơ, Đà Nẵng, Hà Nội.
  - Bến xe: Miền Đông, Miền Tây, Liên tỉnh Đà Lạt, Nha Trang phía Nam.
  - Nhà xe: Phương Trang Demo, Thanh Bưởi Demo, Kumho Demo.
  - Loại xe: ghế ngồi 29 chỗ, giường nằm 34 chỗ, limousine 22 chỗ.

### 3.2. Module 2 — Chọn Chỗ ngồi & Quản lý Kho chỗ theo Thời gian thực
- **Trạng thái ghế**:
  - `AVAILABLE`: Ghế còn trống.
  - `HELD`: Ghế đang giữ tạm thời.
  - `BOOKED`: Ghế đã thanh toán/xác nhận.
  - `BLOCKED`: Ghế bị khóa bởi admin.
- **Đặt chỗ & Giữ ghế (Hold Seats)**:
  - Hiển thị sơ đồ ghế theo loại xe.
  - Gọi mutation `holdSeats` khi người dùng chọn ghế.
  - Seat Inventory Service gọi gRPC kiểm tra tính trống của ghế.
  - Ghi holds vào Redis với TTL (ví dụ: 5 phút).
  - Trả lỗi nếu ghế đã bị giữ/đặt.
  - Hiển thị đếm ngược thời gian giữ ghế trên UI.
  - Hết TTL, ghế tự động trở về `AVAILABLE`.
- **Đồng bộ thời gian thực**: Trạng thái thay đổi được cập nhật thông qua GraphQL Subscription.
- **Race Condition**: Hệ thống phải đảm bảo việc xử lý đồng thời (concurrency) sao cho 2 người đặt cùng 1 ghế thì chỉ 1 người thành công.

### 3.3. Module 3 — Đặt vé, Giả lập Thanh toán, Vé & Thông báo
- **Booking state machine**:
  ```text
  DRAFT -> PENDING_PAYMENT -> PAID -> TICKET_ISSUED -> CHECKED_IN -> COMPLETED
  PENDING_PAYMENT -> EXPIRED
  PAID -> CANCELLED
  ```
- **Thông tin hành khách**: Họ tên, SĐT, email, số giấy tờ tùy thân (mỗi ghế gắn với 1 hành khách).
- **Thanh toán mô phỏng**: Nút "Thanh toán thành công" hoặc "Thanh toán thất bại".
- **Xác nhận đặt vé**: Gọi gRPC để xác nhận ghế, gửi event `booking.paid` qua RabbitMQ.
- **Workers**:
  - Ticket Worker nhận event sinh vé điện tử (gồm mã booking, mã vé, hành khách, tuyến, giờ đi, số ghế, biển số xe, QR code mô phỏng `bookingCode-ticketId` và chính sách).
  - Email Worker ghi log gửi email.
- **Hủy vé**: Cho phép hủy nếu chuyến chưa đi và đủ điều kiện chính sách.
- **Hết hạn**: Tự động giải phóng ghế khi hết hạn thanh toán (`PENDING_PAYMENT` -> `EXPIRED`).

### 3.4. Module 4 — Trang quản trị & Vận hành Hệ thống
- Phân quyền: `ADMIN`, `STAFF`, `CUSTOMER`.
- CRUD tuyến xe, điểm dừng, xe & sơ đồ ghế.
- Tạo chuyến từ tuyến có sẵn, gán xe, cấu hình giá, giờ đi/đến.
- Kích hoạt/tạm khóa chuyến.
- Xem booking theo chuyến.
- Check-in hành khách bằng mã booking/vé/QR code.
- Đổi trạng thái chuyến thành `DEPARTED` và `COMPLETED`.
- Khóa ghế không bán.
- Xem logs sự kiện chính (tạo chuyến, booking paid, check-in).

### 3.5. Module 5 — Phân tích Dữ liệu, Chatbot AI & Máy chủ MCP
- **Phân tích dữ liệu**:
  - Ghi Kafka events: `search-events`, `booking-events`, `payment-events`.
  - Analytics Consumer đọc Kafka và tổng hợp dữ liệu.
  - Dashboard: xem doanh thu ngày, số vé theo tuyến, top tuyến được tìm kiếm, tỷ lệ booking thành công.
- **Chatbot AI**:
  - Hỗ trợ đổi/hủy vé dựa trên chính sách nội bộ.
  - Gợi ý chuyến bằng ngôn ngữ tự nhiên (gọi tool nội bộ `searchTrips`).
  - Hướng dẫn đặt vé.
  - Tra cứu trạng thái booking bằng mã booking + email (yêu cầu bắt buộc đủ cả hai thông tin).
  - Hiển thị nguồn tham chiếu chính sách khi trả lời.
- **MCP Server Tools & Resources**:
  - Tools: `search_trips`, `get_trip_detail`, `get_booking_status`, `get_revenue_summary`, `get_popular_routes`.
  - Resources: `bus://policy/cancellation`, `bus://policy/checkin`, `bus://routes/popular`, `bus://system/health`.
