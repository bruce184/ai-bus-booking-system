"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearCustomerSession, getCustomerToken, getCustomerUser, graphqlRequest } from "../../lib/graphql";

const MY_BOOKINGS = `
  query MyBookings {
    myBookings {
      bookingCode
      status
      contactEmail
      totalAmount
      passengers { seatId }
      tickets { id }
    }
  }
`;

export default function MyBookingsPage() {
  const router = useRouter();
  const [state, setState] = useState({ phase: "loading", bookings: [], error: "", user: null });

  useEffect(() => {
    const token = getCustomerToken();
    const user = getCustomerUser();

    if (!token) {
      // setTimeout keeps setState out of the synchronous effect body
      // (react-hooks/set-state-in-effect), matching admin/layout.js.
      const timer = setTimeout(() => setState({ phase: "guest", bookings: [], error: "", user: null }), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await graphqlRequest(MY_BOOKINGS);
        if (!cancelled) {
          setState({ phase: "ready", bookings: data.myBookings, error: "", user });
        }
      } catch (err) {
        if (!cancelled) {
          setState({ phase: "error", bookings: [], error: err.message, user });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function logout() {
    clearCustomerSession();
    router.push("/search");
  }

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">🟢</div>
          <div>
            <span className="logo-text">EcoBus AI</span>
            <p className="lead" style={{ fontSize: "14px", marginTop: "2px" }}>
              {state.user ? `Đang đăng nhập: ${state.user.email}` : "Đăng nhập để xem các booking gắn với tài khoản của bạn."}
            </p>
          </div>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/search">Tìm chuyến</Link>
          <Link href="/lookup">Tra cứu vé</Link>
          {state.phase === "ready" ? (
            <button onClick={logout} type="button">Đăng xuất</button>
          ) : null}
        </nav>
      </header>

      {state.phase === "loading" ? <section className="panel">Đang tải lịch sử đặt vé...</section> : null}

      {state.phase === "guest" ? (
        <section className="panel form">
          <div className="notice">Bạn chưa đăng nhập. Lịch sử đặt vé chỉ hiển thị cho khách hàng đã đăng nhập.</div>
          <div className="row">
            <Link className="button primary" href="/login?next=/my-bookings">Đăng nhập</Link>
            <Link className="button" href="/lookup">Tra cứu bằng mã đặt vé</Link>
          </div>
        </section>
      ) : null}

      {state.phase === "error" ? <section className="panel"><p className="error">{state.error}</p></section> : null}

      {state.phase === "ready" ? (
        <section className="panel form">
          <div className="row between">
            <h2>Đơn hàng của bạn</h2>
            <span className="status">{state.bookings.length} đơn hàng</span>
          </div>

          {state.bookings.length === 0 ? (
            <div className="notice">
              Chưa có đơn hàng nào gắn với tài khoản này. Đặt vé khi đang đăng nhập để đơn đặt vé xuất hiện ở đây.
            </div>
          ) : (
            <div className="grid">
              {state.bookings.map((booking) => (
                <article className="passenger-card" key={booking.bookingCode}>
                  <div className="row between">
                    <strong>{booking.bookingCode}</strong>
                    <span className="status">{booking.status}</span>
                  </div>
                  <p className="muted">
                    {booking.passengers.length} ghế · {booking.tickets.length} vé ·{" "}
                    {booking.totalAmount.toLocaleString("vi-VN")} VND
                  </p>
                  <Link
                    className="button"
                    href={`/booking/${booking.bookingCode}?email=${encodeURIComponent(booking.contactEmail)}`}
                  >
                    Xem chi tiết
                  </Link>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
