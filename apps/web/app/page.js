"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChatbotPanel } from "../components/ChatbotPanel";
import { LocationInput } from "../src/components/LocationInput.jsx";

function getDefaultDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

export default function HomePage() {
  const router = useRouter();
  const [from, setFrom] = useState("TP.HCM");
  const [to, setTo] = useState("Da Lat");
  const [date, setDate] = useState(getDefaultDate);

  const handleSearch = (e) => {
    e.preventDefault();
    router.push(`/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);
  };

  const handleSwap = () => {
    const temp = from;
    setFrom(to);
    setTo(temp);
  };

  return (
    <>
      <header className="topbar animate-fade-in">
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

      {/* Hero Section */}
      <section className="hero animate-fade-in">
        <div className="hero-copy">
          <span className="eyebrow">
            HÀNH TRÌNH XANH – TRẢI NGHIỆM NHANH
          </span>
          <h2 className="brand">
            Đặt vé xe liên tỉnh,<br />
            <span className="serif-highlight">nhanh chóng</span> & an toàn.
          </h2>
          <p className="lead" style={{ fontSize: "16px", color: "var(--muted)", maxWidth: "520px", marginTop: "8px" }}>
            Hệ thống đặt vé xe trực tuyến thông minh được hỗ trợ bởi AI. Chọn điểm xuất phát, tìm chuyến đi phù hợp và đặt ghế yêu thích của bạn chỉ trong vài giây.
          </p>
        </div>
        <div className="hero-image" />
      </section>

      {/* Floating Search Widget with Swap Icon */}
      <form className="search-widget animate-fade-in" onSubmit={handleSearch}>
        <div className="field">
          <label htmlFor="from-input">Điểm đi</label>
          <div className="input-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <LocationInput id="from-input" value={from} onChange={setFrom} required />
          </div>
        </div>

        <button className="btn-swap" type="button" onClick={handleSwap} title="Đổi chiều" aria-label="Đổi chiều">
          ⇄
        </button>

        <div className="field">
          <label htmlFor="to-input">Điểm đến</label>
          <div className="input-with-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <LocationInput id="to-input" value={to} onChange={setTo} required />
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

      {/* Feature Cards Grid Section */}
      <section className="homepage-features animate-fade-in">
        <div className="feature-card">
          <span className="feature-emoji">🔍</span>
          <div>
            <strong style={{ fontSize: "15px", color: "var(--text)" }}>Tìm chuyến & Giữ chỗ</strong>
            <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>
              Tìm kiếm tuyến đường phù hợp, chọn vị trí ghế trống trực tuyến và tạm giữ chỗ an toàn.
            </p>
          </div>
        </div>
        <div className="feature-card">
          <span className="feature-emoji">💳</span>
          <div>
            <strong style={{ fontSize: "15px", color: "var(--text)" }}>Thanh toán dễ dàng</strong>
            <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>
              Thanh toán đa dạng, bảo mật và xác nhận giữ vé tức thì qua cổng mô phỏng trực tuyến.
            </p>
          </div>
        </div>
        <div className="feature-card">
          <span className="feature-emoji">✉️</span>
          <div>
            <strong style={{ fontSize: "15px", color: "var(--text)" }}>Nhận vé điện tử</strong>
            <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>
              Vé điện tử thông minh sẽ được gửi qua email khách hàng, dễ dàng xuất trình khi lên xe.
            </p>
          </div>
        </div>
      </section>

      {/* Popular Routes Section */}
      <section className="popular-routes animate-fade-in">
        <div className="row between" style={{ alignItems: "center" }}>
          <h2>Tuyến đường phổ biến</h2>
          <Link href="/search" className="link-all">Xem tất cả</Link>
        </div>
        <div className="routes-grid">
          <div className="route-card" style={{ background: "linear-gradient(135deg, #105c42 0%, #064e3b 100%)" }} onClick={() => router.push(`/search?from=TP.HCM&to=Da+Lat&date=${date}`)}>
            <div className="route-card-content">
              <div className="route-card-title">TP.HCM ⇄ Đà Lạt</div>
              <div className="route-card-price">Chỉ từ 220.000đ</div>
              <div className="route-card-trips">126 chuyến/ngày</div>
            </div>
          </div>
          <div className="route-card" style={{ background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)" }} onClick={() => router.push(`/search?from=TP.HCM&to=Nha+Trang&date=${date}`)}>
            <div className="route-card-content">
              <div className="route-card-title">TP.HCM ⇄ Nha Trang</div>
              <div className="route-card-price">Chỉ từ 300.000đ</div>
              <div className="route-card-trips">96 chuyến/ngày</div>
            </div>
          </div>
          <div className="route-card" style={{ background: "linear-gradient(135deg, #093f2c 0%, #1f2937 100%)" }} onClick={() => router.push(`/search?from=TP.HCM&to=Phan+Thiet&date=${date}`)}>
            <div className="route-card-content">
              <div className="route-card-title">TP.HCM ⇄ Phan Thiết</div>
              <div className="route-card-price">Chỉ từ 180.000đ</div>
              <div className="route-card-trips">72 chuyến/ngày</div>
            </div>
          </div>
          <div className="route-card" style={{ background: "linear-gradient(135deg, #1f2937 0%, #4b5563 100%)" }} onClick={() => router.push(`/search?from=TP.HCM&to=Vung+Tau&date=${date}`)}>
            <div className="route-card-content">
              <div className="route-card-title">TP.HCM ⇄ Vũng Tàu</div>
              <div className="route-card-price">Chỉ từ 120.000đ</div>
              <div className="route-card-trips">64 chuyến/ngày</div>
            </div>
          </div>
        </div>
      </section>

      <ChatbotPanel />

      {/* Grid Panels (Illustrations) */}
      <section className="grid animate-fade-in">
        <div className="panel has-illustration">
          <h2>Quy trình hoạt động</h2>
          <ol className="step-list" style={{ marginTop: "20px" }}>
            <li>
              <span className="step-index">1</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Tìm chuyến & Giữ chỗ</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Chọn điểm hành trình, so sánh thời gian xuất phát của các nhà xe và tạm giữ ghế trong 10 phút.</p>
              </div>
            </li>
            <li>
              <span className="step-index">2</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Thanh toán nhanh</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Chọn phương thức MoMo, ZaloPay, Thẻ ATM hoặc Chuyển khoản và mô phỏng giao dịch thành công.</p>
              </div>
            </li>
            <li>
              <span className="step-index">3</span>
              <div>
                <strong style={{ fontSize: "15px", color: "var(--text)" }}>Nhận vé điện tử</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px", fontWeight: "normal" }}>Hệ thống tự động đồng bộ sự kiện để xuất vé kèm QR Code gửi thẳng vào hòm thư điện tử.</p>
              </div>
            </li>
          </ol>
          <Image src="/phone_ticket.png" alt="Phone ticket mockup" className="panel-illustration" width={1024} height={1024} />
        </div>

        <div className="panel has-illustration">
          <h2>Bảo mật & Tra cứu vé</h2>
          <p className="muted" style={{ marginBottom: "32px", lineHeight: "1.6", marginTop: "16px", maxWidth: "340px" }}>
            Hệ thống áp dụng chính sách riêng tư khắt khe. Để tra cứu chi tiết thông tin vé đã mua, quản lý trạng thái thanh toán hoặc yêu cầu hoàn vé, bạn cần cung cấp đúng cặp thông tin mã đặt vé và email.
          </p>
          <Link className="btn-lookup-portal" href="/lookup" id="lookup-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            Mở cổng tra cứu
            <span style={{ marginLeft: "4px" }}>→</span>
          </Link>
          <Image src="/shield_lock.png" alt="Security shield lock illustration" className="panel-illustration" width={1024} height={1024} />
        </div>
      </section>

      {/* Newsletter signup block */}
      <section className="newsletter-banner animate-fade-in">
        <div className="newsletter-text">
          <h3>Nhận ưu đãi & thông tin mới nhất</h3>
          <p>Đăng ký nhận email để cập nhật lịch trình xe chạy và các chương trình khuyến mãi sớm nhất từ EcoBus AI.</p>
        </div>
        <form className="newsletter-form" onSubmit={(e) => { e.preventDefault(); alert("Đăng ký nhận tin thành công!"); }}>
          <input type="email" placeholder="Nhập email của bạn..." required style={{ flex: 1 }} />
          <button className="btn-submit" type="submit">Đăng ký</button>
        </form>
      </section>

      {/* Full Website Footer */}
      <footer className="site-footer animate-fade-in">
        <div className="footer-col">
          <div className="footer-logo">
            <div className="logo-icon" style={{ width: "32px", height: "32px", borderRadius: "8px", fontSize: "16px" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
                <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L7.33,18C12,18 16.6,15.25 18.66,13.25C22.66,9.25 22,2 22,2C22,2 14.75,1.34 10.75,5.34C9,7.09 6.25,12 6.25,12C8.75,9 13.5,8 17,8Z" />
              </svg>
            </div>
            <span className="logo-text" style={{ fontSize: "18px" }}>EcoBus AI</span>
          </div>
          <p className="footer-desc">
            Hệ thống đặt vé xe trực tuyến thông minh, ứng dụng công nghệ AI để đem lại hành trình di chuyển xanh, nhanh chóng và an toàn nhất cho mọi hành khách.
          </p>
          <div className="footer-socials">
            <span className="footer-social-icon">f</span>
            <span className="footer-social-icon">t</span>
            <span className="footer-social-icon">i</span>
          </div>
        </div>

        <div className="footer-col">
          <h4>Về chúng tôi</h4>
          <div className="footer-links">
            <Link href="/">Giới thiệu</Link>
            <Link href="/">Tin tức</Link>
            <Link href="/">Tuyển dụng</Link>
            <Link href="/">Liên hệ</Link>
          </div>
        </div>

        <div className="footer-col">
          <h4>Hỗ trợ</h4>
          <div className="footer-links">
            <Link href="/">Câu hỏi thường gặp</Link>
            <Link href="/">Hướng dẫn đặt vé</Link>
            <Link href="/">Chính sách bảo mật</Link>
            <Link href="/">Điều khoản dịch vụ</Link>
          </div>
        </div>

        <div className="footer-col">
          <h4>Tổng đài hỗ trợ</h4>
          <div className="footer-links">
            <div className="footer-contact-item">
              <span>📞</span>
              <div>
                <strong>1900 1234</strong>
                <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>7:00 - 22:00 mỗi ngày</div>
              </div>
            </div>
            <div className="footer-contact-item" style={{ marginTop: "6px" }}>
              <span>✉️</span>
              <div>
                <strong>support@ecobus.ai</strong>
              </div>
            </div>
          </div>
        </div>
      </footer>

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
