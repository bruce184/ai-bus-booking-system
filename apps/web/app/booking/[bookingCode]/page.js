import Link from "next/link";
import { graphqlRequest } from "../../../lib/graphql";
import PrintTicketButton from "./_PrintTicketButton.jsx";

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

function formatTimeOnly(value) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatFullDate(value) {
  return new Date(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

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
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L7.33,18C12,18 16.6,15.25 18.66,13.25C22.66,9.25 22,2 22,2C22,2 14.75,1.34 10.75,5.34C9,7.09 6.25,12 6.25,12C8.75,9 13.5,8 17,8Z" />
            </svg>
          </div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/search">Tìm chuyến</Link>
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

      <div className="breadcrumbs animate-fade-in" style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px" }}>
        <Link href="/">Trang chủ</Link> &gt; <Link href="/search">Tìm chuyến</Link> &gt; <span style={{ color: "var(--text)", fontWeight: "500" }}>Hoàn tất đặt vé</span>
      </div>

      {error ? (
        <section className="panel animate-fade-in">
          <p className="error">{error}</p>
        </section>
      ) : (
        <div className="animate-fade-in" style={{ maxWidth: "680px", margin: "0 auto", paddingBottom: "40px" }}>
          
          {/* Top Success Banner */}
          <div className="panel" style={{ padding: "32px", textAlign: "center", marginBottom: "24px" }}>
            <div style={{
              width: "60px",
              height: "60px",
              borderRadius: "50%",
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: "bold",
              marginBottom: "16px"
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "var(--text)" }}>Đặt vé thành công!</h2>
            <p className="muted" style={{ fontSize: "14px", marginTop: "8px", lineHeight: "1.6", maxWidth: "480px", margin: "8px auto 0" }}>
              Vé của bạn đã được gửi qua email <strong>{booking.contactEmail}</strong>.<br />
              Vui lòng đến điểm đón trước giờ khởi hành ít nhất 30 phút.
            </p>
          </div>

          {/* Ticket Information Card */}
          <div className="panel" style={{ padding: "24px", border: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              Thông tin vé xe
            </h3>

            {booking.tickets.length > 0 ? (
              <div style={{ display: "grid", gap: "20px" }}>
                {booking.tickets.map((ticket) => (
                  <article key={ticket.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px", padding: "16px", background: "var(--surface-soft)", borderRadius: "8px" }}>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>Hành trình</span>
                      <strong style={{ fontSize: "15px", color: "var(--text)" }}>{ticket.routeLabel}</strong>
                      
                      <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
                        <div>
                          <span className="muted" style={{ fontSize: "11px", display: "block" }}>Giờ xuất phát</span>
                          <strong style={{ fontSize: "14px" }}>{formatTimeOnly(ticket.departureTime)}</strong>
                        </div>
                        <div>
                          <span className="muted" style={{ fontSize: "11px", display: "block" }}>Ngày khởi hành</span>
                          <strong style={{ fontSize: "14px" }}>{formatFullDate(ticket.departureTime)}</strong>
                        </div>
                      </div>

                      <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--muted)" }}>
                        📍 Đón: {ticket.pickupPoint} <br />
                        📍 Trả: {ticket.dropoffPoint}
                      </div>
                    </div>

                    <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "20px", display: "grid", alignContent: "space-between" }}>
                      <div>
                        <span className="muted" style={{ fontSize: "11px", display: "block" }}>Mã vé (Ticket code)</span>
                        <strong style={{ fontSize: "15px", color: "var(--brand)" }}>{ticket.ticketCode}</strong>
                      </div>
                      <div>
                        <span className="muted" style={{ fontSize: "11px", display: "block" }}>Hành khách / Ghế</span>
                        <strong style={{ fontSize: "13px" }}>{ticket.passengerName} (Ghế {ticket.seatId})</strong>
                      </div>
                      <div>
                        <span className="muted" style={{ fontSize: "11px", display: "block" }}>Xe</span>
                        <strong style={{ fontSize: "13px" }}>Mã số {ticket.vehicleCode}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "20px" }}>
                  <div>
                    <span className="muted" style={{ fontSize: "11px", display: "block" }}>Trạng thái giao dịch</span>
                    <strong style={{ fontSize: "16px", color: "var(--brand)" }}>{booking.status}</strong>
                    
                    <div style={{ marginTop: "12px" }}>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>Hành khách đặt vé</span>
                      <div style={{ fontSize: "13px", marginTop: "4px" }}>
                        {booking.passengers.map((p) => (
                          <div key={p.seatId}>• {p.fullName} (Ghế {p.seatId})</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "20px" }}>
                    <div>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>Mã đặt vé</span>
                      <strong style={{ fontSize: "18px", color: "var(--brand-dark)" }}>{booking.bookingCode}</strong>
                    </div>
                    <div style={{ marginTop: "12px" }}>
                      <span className="muted" style={{ fontSize: "11px", display: "block" }}>Tổng tiền thanh toán</span>
                      <strong style={{ fontSize: "18px", color: "var(--text)" }}>{booking.totalAmount.toLocaleString("vi-VN")}đ</strong>
                    </div>
                  </div>
                </div>
                
                <div className="notice">
                  Hệ thống xuất vé điện tử đang phát hành vé của bạn. Vui lòng tải lại trang sau vài giây để hiển thị QR Code.
                </div>
              </div>
            )}
          </div>

          {/* Action buttons at bottom */}
          <div className="row" style={{ marginTop: "24px", justifyContent: "center", gap: "12px" }}>
            <Link className="button" href="/" style={{ minWidth: "120px" }}>
              Về trang chủ
            </Link>
            <Link className="button" href="/my-bookings" style={{ minWidth: "120px" }}>
              Vé của tôi
            </Link>
            <PrintTicketButton />
          </div>
        </div>
      )}
    </>
  );
}
