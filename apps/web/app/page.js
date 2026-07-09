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
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L7.33,18C12,18 16.6,15.25 18.66,13.25C22.66,9.25 22,2 22,2C22,2 14.75,1.34 10.75,5.34C9,7.09 6.25,12 6.25,12C8.75,9 13.5,8 17,8Z" />
            </svg>
          </div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/search">Tìm chuyến</Link>
          <Link href="/my-bookings">Vé của tôi</Link>
          <Link href="/login">Đăng nhập</Link>
          <Link href="/lookup">Tra cứu vé</Link>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "var(--surface-soft)",
            border: "1px solid var(--line)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            marginLeft: "8px"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </nav>
      </header>

      <section className="hero animate-fade-in">
        <div className="hero-copy">
          <span className="eyebrow" style={{ color: "#e07a5f", letterSpacing: "0.1em", fontWeight: "700", fontSize: "13px" }}>
            HÀNH TRÌNH XANH – TRẢI NGHIỆM NHANH
          </span>
          <h2 className="brand" style={{ fontSize: "48px", lineHeight: "1.15", fontWeight: "800", color: "var(--text)" }}>
            Đặt vé xe liên tỉnh,<br />
            <span className="serif-highlight">nhanh chóng</span> & an toàn.
          </h2>
          <p className="lead" style={{ fontSize: "16px", color: "var(--muted)", maxWidth: "520px", marginTop: "8px" }}>
            Hệ thống đặt vé xe trực tuyến thông minh được hỗ trợ bởi AI. Chọn điểm xuất phát, tìm chuyến đi phù hợp và đặt ghế yêu thích của bạn chỉ trong vài giây.
          </p>
        </div>
        <div className="hero-image" />
      </section>

      {/* Floating Search Widget */}
      <form className="search-widget animate-fade-in" onSubmit={handleSearch}>
        <div className="field">
          <label htmlFor="from-input">Điểm đi</label>
          <div className="input-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <select 
              id="from-input"
              value={from} 
              onChange={(e) => setFrom(e.target.value)} 
              required
            >
              <option value="TP.HCM">TP.HCM</option>
              <option value="Da Lat">Đà Lạt</option>
              <option value="Nha Trang">Nha Trang</option>
              <option value="Can Tho">Cần Thơ</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="to-input">Điểm đến</label>
          <div className="input-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <select 
              id="to-input"
              value={to} 
              onChange={(e) => setTo(e.target.value)} 
              required
            >
              <option value="Da Lat">Đà Lạt</option>
              <option value="TP.HCM">TP.HCM</option>
              <option value="Nha Trang">Nha Trang</option>
              <option value="Can Tho">Cần Thơ</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="date-input">Ngày đi</label>
          <div className="input-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <input 
              id="date-input"
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>
        </div>
        <button id="search-btn" className="btn-search" type="submit" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          Tìm vé xe
        </button>

        <div className="search-widget-footer">
          <span>🛡️ An toàn & bảo mật</span>
          <span style={{ color: "var(--line)", fontWeight: "300" }}>|</span>
          <span>💳 Xác nhận nhanh chóng</span>
          <span style={{ color: "var(--line)", fontWeight: "300" }}>|</span>
          <span>📞 Hỗ trợ 24/7</span>
        </div>
      </form>

      <section className="grid">
        <div className="panel has-illustration">
          <h2>Luồng đặt vé tiện lợi</h2>
          <ol className="step-list" style={{ marginTop: "20px" }}>
            <li>
              <span className="step-index">1</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Tìm chuyến & Giữ chỗ</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Tìm kiếm tuyến đường phù hợp, chọn vị trí ghế trống trực tuyến và tạm giữ chỗ an toàn.</p>
              </div>
            </li>
            <li>
              <span className="step-index">2</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Thanh toán nhanh</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Thực hiện thanh toán mô phỏng lập tức để xác nhận thông tin vé và phát sinh mã vé chính thức.</p>
              </div>
            </li>
            <li>
              <span className="step-index">3</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Nhận vé điện tử</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Vé điện tử thông minh sẽ được gửi qua email khách hàng kèm thông tin chuyến đi đầy đủ.</p>
              </div>
            </li>
          </ol>
          <img src="/phone_ticket.png" alt="Phone ticket mockup" className="panel-illustration" />
        </div>

        <div className="panel has-illustration">
          <h2>Tra cứu vé an toàn</h2>
          <p className="muted" style={{ marginBottom: "32px", lineHeight: "1.6", marginTop: "16px", maxWidth: "340px" }}>
            Chúng tôi luôn bảo vệ quyền riêng tư của bạn. Để tra cứu thông tin đặt vé chi tiết hoặc hoàn hủy, vui lòng cung cấp đầy đủ cả mã đặt vé và địa chỉ email đã đăng ký.
          </p>
          <Link className="btn-lookup-portal" href="/lookup" id="lookup-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Mở cổng tra cứu
            <span style={{ marginLeft: "4px" }}>→</span>
          </Link>
          <img src="/shield_lock.png" alt="Security shield lock illustration" className="panel-illustration" />
        </div>
      </section>

      {/* Feature Badges Grid Bar */}
      <section className="features-bar">
        <div className="feature-item">
          <div className="feature-icon-wrapper">🌱</div>
          <div className="feature-content">
            <span className="feature-title">Hành trình xanh</span>
            <span className="feature-desc">Vì môi trường bền vững</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">👥</div>
          <div className="feature-content">
            <span className="feature-title">Đồng hành tin cậy</span>
            <span className="feature-desc">Hơn 1 triệu khách hàng</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">🚌</div>
          <div className="feature-content">
            <span className="feature-title">Đa dạng tuyến đường</span>
            <span className="feature-desc">Kết nối khắp Việt Nam</span>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-icon-wrapper">🛡️</div>
          <div className="feature-content">
            <span className="feature-title">Cam kết an toàn</span>
            <span className="feature-desc">Tiêu chuẩn bảo mật cao</span>
          </div>
        </div>
      </section>

      {/* System Developer Console for Technical Specs */}
      <footer className="dev-console">
        <h3 style={{ fontFamily: "monospace" }}>🛠️ Developer Console / Bảng Điều Khiển Lập Trình Viên</h3>
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
