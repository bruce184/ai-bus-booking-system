insert into users (email, full_name, role) values
  ('admin@example.com', 'Admin Demo', 'ADMIN'),
  ('staff@example.com', 'Staff Demo', 'STAFF'),
  ('customer@example.com', 'Customer Demo', 'CUSTOMER')
on conflict (email) do nothing;

insert into locations (name, type, address) values
  ('TP.HCM', 'CITY', 'Ho Chi Minh City'),
  ('Da Lat', 'CITY', 'Lam Dong'),
  ('Nha Trang', 'CITY', 'Khanh Hoa'),
  ('Can Tho', 'CITY', 'Can Tho'),
  ('Da Nang', 'CITY', 'Da Nang'),
  ('Ha Noi', 'CITY', 'Ha Noi'),
  ('Mien Dong', 'STATION', 'TP.HCM'),
  ('Mien Tay', 'STATION', 'TP.HCM'),
  ('Lien tinh Da Lat', 'STATION', 'Da Lat'),
  ('Nha Trang phia Nam', 'STATION', 'Nha Trang')
on conflict do nothing;

insert into vehicles (operator_name, vehicle_code, license_plate, vehicle_type, seat_count) values
  ('Phuong Trang Demo', 'PT-SLEEPER-34-01', '51B-12345', 'sleeper_34', 34),
  ('Thanh Buoi Demo', 'TB-LIMO-22-01', '51B-22222', 'limousine_22', 22),
  ('Kumho Demo', 'KH-SEAT-29-01', '51B-33333', 'seat_29', 29)
on conflict (vehicle_code) do nothing;

-- Detailed route, trip, seat, booking, ticket, and analytics seed data should
-- be expanded by the database task owner. Keep all values fake demo data.
