"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, graphqlRequest } from "../../lib/graphql";
import { storeFlowContext } from "../../lib/flow-context-client";
import { TopBar } from "../../src/components/TopBar.jsx";

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
    mySavedPassengers {
      id
      fullName
      phone
      email
      documentNumber
    }
  }
`;

const CANCEL_BOOKING = `
  mutation CancelBooking($input: CancelBookingInput!) {
    cancelBooking(input: $input) {
      bookingCode
      status
    }
  }
`;

const SAVE_PASSENGER = `
  mutation SavePassenger($input: SavedPassengerInput!) {
    savePassengerProfile(input: $input) {
      id
    }
  }
`;

const DELETE_PASSENGER = `
  mutation DeleteSavedPassenger($id: ID!) {
    deleteSavedPassenger(id: $id)
  }
`;

const EMPTY_PASSENGER_FORM = { fullName: "", phone: "", email: "", documentNumber: "" };

export default function MyBookingsPage() {
  const router = useRouter();
  const [state, setState] = useState({ phase: "loading", bookings: [], passengers: [], error: "", user: null });
  const [message, setMessage] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [passengerForm, setPassengerForm] = useState(EMPTY_PASSENGER_FORM);

  const reload = useCallback(async (user) => {
    try {
      const data = await graphqlRequest(MY_BOOKINGS);
      setState({
        phase: "ready",
        bookings: data.myBookings,
        passengers: data.mySavedPassengers,
        error: "",
        user
      });
    } catch (err) {
      setState({ phase: "error", bookings: [], passengers: [], error: err.message, user });
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((user) => {
        if (!active) return;
        if (!user || user.role !== "CUSTOMER") {
          setState({ phase: "guest", bookings: [], passengers: [], error: "", user: null });
          return;
        }
        void reload(user);
      })
      .catch((error) => {
        if (active) {
          setState({ phase: "error", bookings: [], passengers: [], error: error.message, user: null });
        }
      });
    return () => {
      active = false;
    };
  }, [reload]);

  async function viewBookingDetail(booking) {
    setMessage("");
    try {
      // Same encrypted, httpOnly flow-context cookie lookup/payment/checkout
      // already use, rather than putting the email in the URL (query strings
      // land in browser history and server access logs).
      await storeFlowContext("booking", { bookingCode: booking.bookingCode, email: booking.contactEmail });
      router.push(`/booking/${encodeURIComponent(booking.bookingCode)}`);
    } catch (err) {
      setMessage(`Không thể mở chi tiết: ${err.message}`);
    }
  }

  async function handleCancel(booking) {
    const confirmed = window.confirm(
      `Hủy booking ${booking.bookingCode}? Chỉ booking PAID và chuyến chưa khởi hành mới hủy được theo chính sách.`
    );
    if (!confirmed) {
      return;
    }

    setBusyCode(booking.bookingCode);
    setMessage("");
    try {
      await graphqlRequest(CANCEL_BOOKING, {
        input: { bookingCode: booking.bookingCode, email: booking.contactEmail }
      });
      setMessage(`Đã hủy booking ${booking.bookingCode}.`);
      await reload(state.user);
    } catch (err) {
      setMessage(`Không thể hủy: ${err.message}`);
    } finally {
      setBusyCode("");
    }
  }

  async function handleSavePassenger(event) {
    event.preventDefault();
    setMessage("");
    try {
      await graphqlRequest(SAVE_PASSENGER, { input: passengerForm });
      setPassengerForm(EMPTY_PASSENGER_FORM);
      setMessage("Đã lưu hành khách.");
      await reload(state.user);
    } catch (err) {
      setMessage(`Không thể lưu hành khách: ${err.message}`);
    }
  }

  async function handleDeletePassenger(profile) {
    setMessage("");
    try {
      await graphqlRequest(DELETE_PASSENGER, { id: profile.id });
      setMessage(`Đã xóa hành khách ${profile.fullName}.`);
      await reload(state.user);
    } catch (err) {
      setMessage(`Không thể xóa: ${err.message}`);
    }
  }

  return (
    <>
      <TopBar
        links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }, { href: "/lookup", label: "Tra cứu vé" }]}
        subtitle={(
          <p className="lead" style={{ fontSize: "14px", marginTop: "2px" }}>
            {state.user ? `Đang đăng nhập: ${state.user.email}` : "Đăng nhập để xem các booking gắn với tài khoản của bạn."}
          </p>
        )}
      />

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
        <>
          {message ? (
            <section className="panel" style={{ marginBottom: "16px" }}>
              <p className="notice" role="status">{message}</p>
            </section>
          ) : null}

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
                    <div className="row" style={{ gap: "8px" }}>
                      <button className="button" onClick={() => viewBookingDetail(booking)} type="button">
                        Xem chi tiết
                      </button>
                      {booking.status === "PAID" ? (
                        <button
                          className="button danger"
                          disabled={busyCode === booking.bookingCode}
                          onClick={() => handleCancel(booking)}
                          type="button"
                        >
                          {busyCode === booking.bookingCode ? "Đang hủy..." : "Hủy vé"}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="panel form" style={{ marginTop: "20px" }}>
            <div className="row between">
              <h2>Hành khách đã lưu</h2>
              <span className="status">{state.passengers.length} hồ sơ</span>
            </div>
            <p className="muted" style={{ fontSize: "13px" }}>
              Lưu thông tin hành khách thường dùng để điền nhanh khi đặt vé.
            </p>

            {state.passengers.length > 0 ? (
              <div className="grid" style={{ marginBottom: "16px" }}>
                {state.passengers.map((profile) => (
                  <article className="passenger-card" key={profile.id}>
                    <div className="row between">
                      <strong>{profile.fullName}</strong>
                      <button className="button danger" onClick={() => handleDeletePassenger(profile)} type="button">
                        Xóa
                      </button>
                    </div>
                    <p className="muted" style={{ fontSize: "13px" }}>
                      {[profile.phone, profile.email, profile.documentNumber].filter(Boolean).join(" · ") || "Chưa có thông tin liên hệ"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="notice" style={{ marginBottom: "16px" }}>Chưa có hành khách nào được lưu.</div>
            )}

            <form onSubmit={handleSavePassenger} className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="field">
                <label htmlFor="sp-name">Họ tên</label>
                <input
                  id="sp-name"
                  value={passengerForm.fullName}
                  onChange={(e) => setPassengerForm({ ...passengerForm, fullName: e.target.value })}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="sp-phone">Số điện thoại</label>
                <input
                  id="sp-phone"
                  value={passengerForm.phone}
                  onChange={(e) => setPassengerForm({ ...passengerForm, phone: e.target.value })}
                  placeholder="0900000000"
                />
              </div>
              <div className="field">
                <label htmlFor="sp-email">Email</label>
                <input
                  id="sp-email"
                  type="email"
                  value={passengerForm.email}
                  onChange={(e) => setPassengerForm({ ...passengerForm, email: e.target.value })}
                  placeholder="a@example.com"
                />
              </div>
              <div className="field">
                <label htmlFor="sp-doc">Số giấy tờ</label>
                <input
                  id="sp-doc"
                  value={passengerForm.documentNumber}
                  onChange={(e) => setPassengerForm({ ...passengerForm, documentNumber: e.target.value })}
                  placeholder="CCCD/CMND"
                />
              </div>
              <button className="primary" type="submit" style={{ gridColumn: "1 / -1" }}>
                Lưu hành khách
              </button>
            </form>
          </section>
        </>
      ) : null}
    </>
  );
}
