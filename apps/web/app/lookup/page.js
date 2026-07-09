"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LookupPage() {
  const router = useRouter();
  const [bookingCode, setBookingCode] = useState("");
  const [email, setEmail] = useState("");

  function submit(event) {
    event.preventDefault();
    router.push(`/booking/${bookingCode}?email=${encodeURIComponent(email)}`);
  }

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">🟢</div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/search">Tìm chuyến</Link>
          <Link href="/my-bookings">Vé của tôi</Link>
        </nav>
      </header>

      <section className="grid">
        <form className="panel form" onSubmit={submit}>
          <h2>Thông tin tra cứu</h2>
          <div className="field">
            <label>Mã booking</label>
            <input value={bookingCode} onChange={(event) => setBookingCode(event.target.value)} placeholder="BK202606260001" required />
          </div>
          <div className="field">
            <label>Email liên hệ</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@example.com" required />
          </div>
          <button className="primary" type="submit">
            Tra cứu booking
          </button>
        </form>

        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Privacy rule</span>
            <strong>Code + email</strong>
          </div>
          <p className="muted">Hệ thống không trả thông tin booking nếu thiếu một trong hai trường này.</p>
          <div className="notice">Dùng email khi checkout để tra cứu lại vé.</div>
        </aside>
      </section>
    </>
  );
}
