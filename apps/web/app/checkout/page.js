"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { graphqlRequest } from "../../lib/graphql";

const CREATE_BOOKING = `
  mutation CreateBooking($input: CreateBookingInput!) {
    createBooking(input: $input) {
      bookingCode
      status
      contactEmail
      totalAmount
      passengers { fullName seatId }
    }
  }
`;

function CheckoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultSeats = useMemo(() => (params.get("seats") || "A01").split(","), [params]);
  const [tripId, setTripId] = useState(params.get("tripId") || "");
  const [holdToken, setHoldToken] = useState(params.get("holdToken") || "");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [passengers, setPassengers] = useState(
    defaultSeats.map((seatId) => ({ fullName: "", phone: "", email: "", documentNumber: "", seatId }))
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function updatePassenger(index, field, value) {
    setPassengers((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await graphqlRequest(CREATE_BOOKING, {
        input: { tripId, holdToken, contactEmail, contactPhone, passengers }
      });
      router.push(`/payment?bookingCode=${data.createBooking.bookingCode}&email=${encodeURIComponent(contactEmail)}`);
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
          <span className="eyebrow">Checkout</span>
          <h1 className="brand">Thông tin hành khách</h1>
          <p className="lead">Nhập thông tin liên hệ và gán mỗi hành khách với một ghế đã được giữ.</p>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/lookup">Tra cứu</Link>
        </nav>
      </header>

      <form className="panel form" onSubmit={submit}>
        <div className="row between">
          <div>
            <h2>Thông tin booking</h2>
            <p className="muted">Dữ liệu này thường được truyền sang từ màn chọn ghế.</p>
          </div>
          <span className="status">{passengers.length} ghế</span>
        </div>

        <div className="grid">
          <div className="field">
            <label>Trip ID</label>
            <input value={tripId} onChange={(event) => setTripId(event.target.value)} placeholder="trip-demo-001" required />
          </div>
          <div className="field">
            <label>Hold token</label>
            <input value={holdToken} onChange={(event) => setHoldToken(event.target.value)} placeholder="Redis hold token" required />
          </div>
          <div className="field">
            <label>Email liên hệ</label>
            <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="guest@example.com" required />
          </div>
          <div className="field">
            <label>Số điện thoại</label>
            <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="0900000000" />
          </div>
        </div>

        <div className="form-section">
          <h2>Hành khách theo ghế</h2>
          {passengers.map((passenger, index) => (
            <section className="passenger-card" key={passenger.seatId}>
              <div className="row between">
                <h3>Ghế {passenger.seatId}</h3>
                <span className="status">Passenger {index + 1}</span>
              </div>
              <div className="grid">
                <div className="field">
                  <label>Họ tên</label>
                  <input value={passenger.fullName} onChange={(event) => updatePassenger(index, "fullName", event.target.value)} placeholder="Nguyễn Văn A" required />
                </div>
                <div className="field">
                  <label>Email hành khách</label>
                  <input type="email" value={passenger.email} onChange={(event) => updatePassenger(index, "email", event.target.value)} placeholder="Có thể bỏ trống" />
                </div>
                <div className="field">
                  <label>Số điện thoại</label>
                  <input value={passenger.phone} onChange={(event) => updatePassenger(index, "phone", event.target.value)} />
                </div>
                <div className="field">
                  <label>Giấy tờ tùy chọn</label>
                  <input value={passenger.documentNumber} onChange={(event) => updatePassenger(index, "documentNumber", event.target.value)} />
                </div>
              </div>
            </section>
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}
        <button className="primary" disabled={loading} type="submit">
          {loading ? "Đang tạo booking..." : "Tạo booking và qua thanh toán"}
        </button>
      </form>
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<section className="panel">Đang tải checkout...</section>}>
      <CheckoutContent />
    </Suspense>
  );
}
