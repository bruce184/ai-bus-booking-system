import Link from "next/link";
import { graphqlRequest } from "../../../lib/graphql";

const BOOKING_STATUS = `
  query BookingStatus($bookingCode: String!, $email: String!) {
    bookingStatus(bookingCode: $bookingCode, email: $email) {
      bookingCode
      status
      contactEmail
      contactPhone
      totalAmount
      passengers { fullName seatId phone email documentNumber }
      tickets {
        id
        ticketCode
        passengerName
        routeLabel
        pickupPoint
        dropoffPoint
        departureTime
        seatId
        vehicleCode
        qrPayload
        checkinPolicy
        html
      }
    }
  }
`;

export default async function BookingConfirmationPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const bookingCode = resolvedParams.bookingCode;
  const email = resolvedSearchParams.email || "";
  let booking;
  let error = "";

  try {
    if (!email) {
      throw new Error("Cần email để tra cứu booking.");
    }
    const data = await graphqlRequest(BOOKING_STATUS, { bookingCode, email });
    booking = data.bookingStatus;
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <header className="topbar">
        <div className="brand-block">
          <span className="eyebrow">Booking confirmation</span>
          <h1 className="brand">Xác nhận đặt vé</h1>
          <p className="lead">Mã booking: {bookingCode}</p>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/lookup">Tra cứu</Link>
        </nav>
      </header>

      {error ? (
        <section className="panel">
          <p className="error">{error}</p>
        </section>
      ) : (
        <section className="panel form">
          <div className="row between">
            <div>
              <h2>{booking.bookingCode}</h2>
              <p className="muted">Email: {booking.contactEmail}</p>
            </div>
            <span className="status">{booking.status}</span>
          </div>

          <div className="grid">
            <div className="summary-panel">
              <div className="metric">
                <span className="muted">Tổng tiền</span>
                <strong>{booking.totalAmount.toLocaleString("vi-VN")} VND</strong>
              </div>
              <div className="metric">
                <span className="muted">Số hành khách</span>
                <strong>{booking.passengers.length}</strong>
              </div>
            </div>
            <div className="summary-panel">
              <div className="metric">
                <span className="muted">Vé đã phát hành</span>
                <strong>{booking.tickets.length}</strong>
              </div>
              <p className="muted">Ticket worker sẽ hiển thị vé ở đây sau khi xử lý event ticket.issued.</p>
            </div>
          </div>

          <div className="form-section">
            <h2>Hành khách</h2>
            <div className="grid">
              {booking.passengers.map((passenger) => (
                <div className="passenger-card" key={passenger.seatId}>
                  <strong>{passenger.fullName}</strong>
                  <span className="status">Ghế {passenger.seatId}</span>
                  {passenger.phone ? <span className="muted">SĐT: {passenger.phone}</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h2>Vé điện tử</h2>
            {booking.tickets.length === 0 ? (
              <div className="notice">Chưa có vé trong response. Kiểm tra ticket-worker nếu booking đã PAID.</div>
            ) : (
              <div className="grid">
                {booking.tickets.map((ticket) => (
                  <article className="ticket" key={ticket.id}>
                    <strong>{ticket.ticketCode}</strong>
                    <p>{ticket.passengerName}</p>
                    <p>{ticket.routeLabel}</p>
                    <p>Ghế {ticket.seatId} · Xe {ticket.vehicleCode}</p>
                    <p>QR: {ticket.qrPayload}</p>
                    <p className="muted">{ticket.checkinPolicy}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  );
}
