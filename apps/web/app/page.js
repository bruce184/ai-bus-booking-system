"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [from, setFrom] = useState("TP.HCM");
  const [to, setTo] = useState("Da Lat");
  
  // Tomorrow's date as default
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const defaultDate = tomorrow.toISOString().slice(0, 10);
  const [date, setDate] = useState(defaultDate);

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(`/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);
  };

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">🟢</div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/search">Tìm chuyến</Link>
          <Link href="/my-bookings">Vé của tôi</Link>
          <Link href="/login">Đăng nhập</Link>
          <Link href="/lookup">Tra cứu vé</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Hành trình xanh - Trải nghiệm nhanh</span>
          <h2 className="brand">Đặt vé xe liên tỉnh, nhanh chóng & an toàn.</h2>
          <p className="lead">Hệ thống đặt vé xe trực tuyến thông minh được hỗ trợ bởi AI. Chọn điểm xuất phát, tìm chuyến đi phù hợp và đặt ghế yêu thích của bạn chỉ trong vài giây.</p>
        </div>
      </section>

      {/* Floating Search Widget */}
      <form className="search-widget animate-fade-in" onSubmit={handleSearch}>
        <div className="field">
          <label htmlFor="from-input">Điểm đi</label>
          <input 
            id="from-input"
            type="text" 
            value={from} 
            onChange={(e) => setFrom(e.target.value)} 
            placeholder="Ví dụ: TP.HCM"
            required 
          />
        </div>
        <div className="field">
          <label htmlFor="to-input">Điểm đến</label>
          <input 
            id="to-input"
            type="text" 
            value={to} 
            onChange={(e) => setTo(e.target.value)} 
            placeholder="Ví dụ: Da Lat"
            required 
          />
        </div>
        <div className="field">
          <label htmlFor="date-input">Ngày đi</label>
          <input 
            id="date-input"
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            required 
          />
        </div>
        <button id="search-btn" className="btn-search" type="submit">
          Tìm Vé Xe
        </button>
      </form>

      <section className="grid">
        <div className="panel">
          <h2>Luồng đặt vé tiện lợi</h2>
          <ol className="step-list">
            <li>
              <span className="step-index">1</span>
              <div>
                <strong style={{ fontSize: "16px", color: "var(--text)" }}>Tìm chuyến & Giữ chỗ</strong>
                <p className="muted" style={{ fontSize: "14px", marginTop: "4px", fontWeight: "normal" }}>Tìm kiếm tuyến đường phù hợp, chọn vị trí ghế trống trực tuyến và tạm giữ chỗ an toàn.</p>
              </div>
            </li>
            <li>
              <span className="step-index">2</span>
              <div>
                <strong style={{ fontSize: "16px", color: "var(--text)" }}>Thanh toán nhanh</strong>
                <p className="muted" style={{ fontSize: "14px", marginTop: "4px", fontWeight: "normal" }}>Thực hiện thanh toán mô phỏng lập tức để xác nhận thông tin vé và phát sinh mã vé chính thức.</p>
              </div>
            </li>
            <li>
              <span className="step-index">3</span>
              <div>
                <strong style={{ fontSize: "16px", color: "var(--text)" }}>Nhận vé điện tử</strong>
                <p className="muted" style={{ fontSize: "14px", marginTop: "4px", fontWeight: "normal" }}>Vé điện tử thông minh sẽ được gửi qua email khách hàng kèm thông tin chuyến đi đầy đủ.</p>
              </div>
            </li>
          </ol>
        </div>

        <div className="panel">
          <h2>Tra cứu vé an toàn</h2>
          <p className="muted" style={{ marginBottom: "20px", lineHeight: "1.6" }}>
            Chúng tôi luôn bảo vệ quyền riêng tư của bạn. Để tra cứu thông tin đặt vé chi tiết hoặc hoàn hủy, vui lòng cung cấp đầy đủ cả mã đặt vé và địa chỉ email đã đăng ký.
          </p>
          <Link className="button primary" href="/lookup" id="lookup-btn" style={{ width: "100%", minHeight: "48px" }}>
            Mở cổng tra cứu
          </Link>
        </div>
      </section>

      {/* System Developer Console for Technical Specs */}
      <footer className="dev-console">
        <h3 style={{ fontFamily: "monospace" }}>🛠️ Developer Console / Giám Sát Kỹ Thuật</h3>
        <p style={{ fontSize: "14px", color: "#64748b", marginTop: "6px" }}>
          Thông tin chi tiết về luồng nghiệp vụ Module 3 của sinh viên (Booking Lifecycle, Event-Driven & Privacy Rules):
        </p>
        <div className="dev-console-grid">
          <div className="dev-console-card">
            <span>Trạng thái Booking</span>
            <strong>PENDING → PAID → TICKET</strong>
          </div>
          <div className="dev-console-card">
            <span>Sự kiện Broker</span>
            <strong>booking.paid (RabbitMQ & Kafka)</strong>
          </div>
          <div className="dev-console-card">
            <span>Quy tắc bảo mật</span>
            <strong>Mã Booking + Email hành khách</strong>
          </div>
        </div>
      </footer>
    </>
  );
}
