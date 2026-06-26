"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { graphqlRequest } from "../../lib/graphql";

const SIMULATE_PAYMENT = `
  mutation SimulatePayment($input: SimulatePaymentInput!) {
    simulatePayment(input: $input) {
      bookingCode
      status
      totalAmount
    }
  }
`;

function PaymentContent() {
  const params = useSearchParams();
  const router = useRouter();
  const bookingCode = params.get("bookingCode") || "";
  const email = params.get("email") || "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function pay(success) {
    setLoading(true);
    setError("");
    try {
      await graphqlRequest(SIMULATE_PAYMENT, { input: { bookingCode, success } });
      router.push(`/booking/${bookingCode}?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <span className="eyebrow">Payment simulation</span>
          <h1 className="brand">Xác nhận thanh toán</h1>
          <p className="lead">Booking {bookingCode || "chưa có mã"} sẽ được chuyển trạng thái sau khi mô phỏng kết quả.</p>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/lookup">Tra cứu</Link>
        </nav>
      </header>

      <section className="grid">
        <div className="panel">
          <h2>Chọn kết quả giao dịch</h2>
          <p className="muted">Thành công sẽ gọi simulatePayment, confirm ghế và phát event booking.paid cho worker.</p>
          <div className="row">
            <button className="primary" disabled={!bookingCode || loading} onClick={() => pay(true)}>
              Thanh toán thành công
            </button>
            <button className="danger" disabled={!bookingCode || loading} onClick={() => pay(false)}>
              Thanh toán thất bại
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </div>
        <aside className="summary-panel">
          <div className="metric">
            <span className="muted">Booking code</span>
            <strong>{bookingCode || "N/A"}</strong>
          </div>
          <div className="metric">
            <span className="muted">Sau khi thành công</span>
            <strong>PAID</strong>
          </div>
          <div className="notice">Ticket worker sẽ tạo vé khi nhận event booking.paid.</div>
        </aside>
      </section>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<section className="panel">Đang tải thanh toán...</section>}>
      <PaymentContent />
    </Suspense>
  );
}
