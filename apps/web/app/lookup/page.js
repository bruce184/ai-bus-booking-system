"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "../../src/components/TopBar.jsx";

export default function LookupPage() {
  const router = useRouter();
  const [bookingCode, setBookingCode] = useState("");
  const [email, setEmail] = useState("");

  function submit(event) {
    event.preventDefault();
    const code = bookingCode.trim().toUpperCase();
    router.push(`/booking/${encodeURIComponent(code)}?email=${encodeURIComponent(email.trim())}`);
  }

  return (
    <>
      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }, { href: "/my-bookings", label: "Vé của tôi" }]} />

      <section className="grid">
        <form className="panel form" onSubmit={submit}>
          <h2>Thông tin tra cứu</h2>
          <div className="field">
            <label>Mã đặt vé (Booking code)</label>
            <input value={bookingCode} onChange={(event) => setBookingCode(event.target.value)} placeholder="BK202606260001" required />
          </div>
          <div className="field">
            <label>Email liên hệ</label>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="guest@example.com" required />
          </div>
          <button className="primary" type="submit">
            Tra cứu vé
          </button>
        </form>

        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Quy tắc bảo mật (Privacy rule)</span>
            <strong>Mã vé + Email</strong>
          </div>
          <p className="muted">Hệ thống bảo mật không trả về thông tin đơn đặt vé nếu thiếu một trong hai trường này.</p>
          <div className="notice">Sử dụng địa chỉ email bạn đã dùng khi đặt vé để tra cứu lại.</div>
        </aside>
      </section>
    </>
  );
}
