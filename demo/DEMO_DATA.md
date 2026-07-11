# Dữ Liệu Demo — AI Bus Booking System

Toàn bộ dữ liệu là **fake demo** từ `database/seed.sql` (không có dữ liệu thật).

## 1. Tài khoản

| Vai trò | Email | Mật khẩu | Dùng để demo |
|---|---|---|---|
| ADMIN | admin@example.com | admin123 | CRUD tuyến/xe/chuyến, block ghế, dashboard, event logs |
| STAFF | staff@example.com | staff123 | Chỉ check-in (bị giới hạn menu) |
| CUSTOMER | customer@example.com | customer123 | Lịch sử đặt vé, hành khách đã lưu, hủy vé |

## 2. Booking có sẵn (mã + trạng thái)

| Mã booking | Trạng thái | Email tra cứu | Kịch bản demo |
|---|---|---|---|
| BK202606240001 | TICKET_ISSUED | guest.anna@example.com | **Check-in tại Boarding Desk** |
| BK202606240002 | PAID | customer@example.com | Booking đã thanh toán, chưa xuất vé |
| BK202606240003 | CHECKED_IN | guest.binh@example.com | Đã lên xe |
| BK202606240004 | COMPLETED | customer@example.com | Hoàn tất chuyến |
| BK202606240005 | PAID | guest.chi@example.com | Hủy vé theo chính sách |
| BK202606250001 | EXPIRED | guest.dung@example.com | Hết hạn thanh toán, ghế đã nhả |
| BK202606250002 | CANCELLED | guest.em@example.com | Đã hủy |

Tra cứu tại `/lookup` — luôn cần **cả mã booking và email**.

## 3. Chuyến demo cố định (dùng trong test tự động)

| Mục | Giá trị |
|---|---|
| Trip ID | `00000000-0000-4000-8004-000000000001` |
| Ghế demo block | `A04` |
| Booking check-in demo | `BK202606240001` |

## 4. Danh mục

- **Tỉnh/thành:** TP.HCM, Da Lat, Nha Trang, Can Tho, Da Nang, Ha Noi
- **Bến xe:** Mien Dong, Mien Tay, Lien tinh Da Lat, Nha Trang phia Nam
- **Nhà xe:** Phuong Trang Demo, Thanh Buoi Demo, Kumho Demo
- **Loại xe:** ghế ngồi 29 chỗ (seat_29), giường nằm 34 chỗ (sleeper_34), limousine 22 chỗ (limousine_22)

## 5. Chuyến sắp khởi hành (ngày phụ thuộc thời điểm seed)

Ngày giờ chuyến được seed tương đối so với lúc chạy `database/seed.sql`. Liệt kê chuyến hiện có để chọn ngày demo tìm kiếm:

```bash
docker exec bus-postgres psql -U bus_app -d bus_booking -c "
  select ol.name||' -> '||dl.name as route,
         to_char(t.departure_time,'YYYY-MM-DD HH24:MI') as departure,
         t.price, t.status
  from trips t
  join routes r on r.id = t.route_id
  join locations ol on ol.id = r.origin_location_id
  join locations dl on dl.id = r.destination_location_id
  where t.departure_time > now() and t.status = 'ACTIVE'
  order by t.departure_time;"
```

Tuyến nhiều chuyến nhất để demo bộ lọc/sắp xếp: **TP.HCM → Da Lat**.

## 6. Analytics

Bảng `analytics_daily` được seed 7 ngày số liệu (doanh thu, vé bán, lượt tìm kiếm, tỷ lệ chuyển đổi) và tiếp tục được Analytics Service cập nhật realtime từ Kafka khi demo tìm kiếm/đặt vé.
