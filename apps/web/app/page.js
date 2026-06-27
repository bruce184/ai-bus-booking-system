import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <span className="eyebrow">AI Bus Booking</span>
          <h1 className="brand">Module đặt vé & phát hành vé</h1>
          <p className="lead">Demo luồng checkout, thanh toán mô phỏng, tạo vé điện tử và tra cứu booking.</p>
        </div>
        <nav className="nav">
          <Link href="/checkout">Checkout</Link>
          <Link href="/lookup">Tra cứu vé</Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Guest checkout ready</span>
          <h2 className="brand">Đặt vé xe liên tỉnh, xác nhận nhanh, vé rõ ràng.</h2>
          <p className="lead">Module 3 xử lý booking, payment simulation, ticket worker và email worker theo đúng contract của nhóm.</p>
          <div className="hero-actions">
            <Link className="button primary" href="/checkout">Bắt đầu checkout</Link>
            <Link className="button" href="/lookup">Tra cứu booking</Link>
          </div>
        </div>

        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Trạng thái booking</span>
            <strong>PENDING → PAID → TICKET</strong>
          </div>
          <div className="metric">
            <span className="muted">Event workflow</span>
            <strong>booking.paid</strong>
          </div>
          <div className="metric">
            <span className="muted">Quy tắc riêng tư</span>
            <strong>Code + email</strong>
          </div>
        </aside>
      </section>

      <section className="grid">
        <div className="panel">
          <h2>Luồng đặt vé</h2>
          <ol className="step-list">
            <li><span className="step-index">1</span><span>Tạo booking từ trip, hold token và thông tin hành khách.</span></li>
            <li><span className="step-index">2</span><span>Thanh toán mô phỏng để xác nhận ghế và phát event.</span></li>
            <li><span className="step-index">3</span><span>Worker tạo vé điện tử và log email gửi khách.</span></li>
          </ol>
        </div>
        <div className="panel">
          <h2>Tra cứu an toàn</h2>
          <p className="muted">Trang tra cứu luôn yêu cầu cả mã booking và email, đúng ghi chú privacy rule trong bảng phân công.</p>
          <Link className="button" href="/lookup">Mở tra cứu</Link>
        </div>
      </section>
    </>
  );
}
