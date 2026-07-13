"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearFlowContext, getFlowContext, storeFlowContext } from "../../lib/flow-context-client";
import { graphqlRequest } from "../../lib/graphql";
import { TopBar } from "../../src/components/TopBar.jsx";
import { CountdownRing } from "../../src/components/ui/CountdownRing.jsx";

const MY_SAVED_PASSENGERS = `
  query MySavedPassengers {
    mySavedPassengers {
      id
      fullName
      phone
      email
      documentNumber
    }
  }
`;

const TRIP_MINI = `
  query TripMini($id: ID!) {
    trip(id: $id) {
      trip {
        id
        operatorName
        vehicleType
        departureTime
        arrivalTime
        price
        route {
          origin { name }
          destination { name }
        }
      }
    }
  }
`;

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

function CheckoutContent() {
  const router = useRouter();
  const [flowContext, setFlowContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);
  const defaultSeats = flowContext?.seats ?? [];
  const tripId = flowContext?.tripId ?? "";
  const holdToken = flowContext?.holdToken ?? "";
  const holdExpiresAt = flowContext?.expiresAt ?? "";
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [note, setNote] = useState("");
  const [passengers, setPassengers] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("momo");
  const [savedPassengers, setSavedPassengers] = useState([]);
  const [tripDetail, setTripDetail] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingHoldSeconds, setRemainingHoldSeconds] = useState(null);
  const holdExpired = Boolean(flowContext) && remainingHoldSeconds === 0;

  useEffect(() => {
    let cancelled = false;

    getFlowContext("checkout")
      .then((context) => {
        if (cancelled) {
          return;
        }
        if (!context) {
          setError("Phiên giữ ghế không hợp lệ hoặc đã hết hạn. Vui lòng chọn ghế lại.");
          return;
        }
        setFlowContext(context);
        setPassengers(
          context.seats.map((seatId) => ({
            fullName: "",
            phone: "",
            email: "",
            documentNumber: "",
            seatId
          }))
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setContextLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Khách đã đăng nhập: nạp hồ sơ hành khách đã lưu để điền nhanh.
  useEffect(() => {
    graphqlRequest(MY_SAVED_PASSENGERS)
      .then((data) => setSavedPassengers(data.mySavedPassengers ?? []))
      .catch(() => setSavedPassengers([]));
  }, []);

  function applySavedPassenger(index, profileId) {
    const profile = savedPassengers.find((p) => p.id === profileId);
    if (!profile) {
      return;
    }
    setPassengers((current) =>
      current.map((passenger, i) =>
        i === index
          ? {
              ...passenger,
              fullName: profile.fullName,
              phone: profile.phone ?? "",
              email: profile.email ?? "",
              documentNumber: profile.documentNumber ?? ""
            }
          : passenger
      )
    );
  }

  // Fetch trip details to show summary
  useEffect(() => {
    if (tripId) {
      graphqlRequest(TRIP_MINI, { id: tripId })
        .then((data) => {
          setTripDetail(data.trip.trip);
        })
        .catch(() => {});
    }
  }, [tripId]);

  useEffect(() => {
    if (!holdExpiresAt) {
      return undefined;
    }

    const updateRemainingSeconds = () => {
      const expiresAtMs = new Date(holdExpiresAt).getTime();
      if (Number.isNaN(expiresAtMs)) {
        setRemainingHoldSeconds(null);
        return;
      }

      const secondsLeft = Math.max(
        0,
        Math.ceil((expiresAtMs - Date.now()) / 1000)
      );
      setRemainingHoldSeconds(secondsLeft);
    };

    const startTimer = window.setTimeout(updateRemainingSeconds, 0);
    const interval = window.setInterval(updateRemainingSeconds, 1000);

    return () => {
      window.clearTimeout(startTimer);
      window.clearInterval(interval);
    };
  }, [holdExpiresAt]);

  function updatePassenger(index, field, value) {
    setPassengers((items) => items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  async function submit(event) {
    event.preventDefault();
    if (!flowContext) {
      setError("Phiên giữ ghế không hợp lệ hoặc đã hết hạn. Vui lòng chọn ghế lại.");
      return;
    }
    if (holdExpired) {
      setError("Mã giữ chỗ đã hết hạn. Vui lòng quay lại chọn ghế.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await graphqlRequest(CREATE_BOOKING, {
        input: { tripId, holdToken, contactEmail, contactPhone, passengers }
      });
      await storeFlowContext("booking", {
        bookingCode: data.createBooking.bookingCode,
        email: data.createBooking.contactEmail
      });
      clearFlowContext("checkout").catch(() => {});
      router.push("/payment");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (contextLoading) {
    return <section className="panel">Đang tải phiên giữ ghế...</section>;
  }

  if (!flowContext) {
    return (
      <>
        <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }]} />
        <section className="panel">
          <p className="error">{error}</p>
          <Link className="button" href="/search">Quay lại tìm chuyến</Link>
        </section>
      </>
    );
  }

  return (
    <>
      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }, { href: "/lookup", label: "Tra cứu vé" }]} showUserBadge />

      <div className="breadcrumbs animate-fade-in" style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px" }}>
        <Link href="/">Trang chủ</Link> &gt; <Link href="/search">Tìm chuyến</Link> &gt; <span style={{ color: "var(--text)", fontWeight: "500" }}>Thông tin đặt vé</span>
      </div>

      <form onSubmit={submit} className="animate-fade-in">
        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start", gap: "24px" }}>
          
          {/* Left Column: Passenger Info Form */}
          <main style={{ display: "grid", gap: "20px" }}>
            <div className="panel form">
              <div className="row between" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "20px", fontWeight: "800" }}>Thông tin đặt vé</h2>
                  <p className="muted" style={{ fontSize: "13px", marginTop: "2px" }}>Vui lòng nhập thông tin để hoàn tất đặt vé</p>
                </div>
                <span className="status">{passengers.length} ghế</span>
              </div>

              {flowContext ? (
                <div className="notice" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                  {remainingHoldSeconds !== null && !holdExpired ? (
                    <CountdownRing remainingSeconds={remainingHoldSeconds} />
                  ) : null}
                  <span>
                    {holdExpired ? (
                      <span>Mã giữ chỗ đã hết hạn, vui lòng quay lại chọn ghế. </span>
                    ) : null}
                    Ghế <strong>{defaultSeats.join(", ")}</strong> đang được giữ cho bạn. Hoàn tất thông tin bên dưới trước khi hết thời gian giữ ghế.
                  </span>
                </div>
              ) : null}

              <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                <div className="field">
                  <label>Email liên hệ</label>
                  <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} placeholder="guest@example.com" required />
                </div>
                <div className="field">
                  <label>Số điện thoại</label>
                  <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="0900000000" required />
                </div>
              </div>

              <div className="form-section">
                <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "16px", borderTop: "1px solid var(--line)", paddingTop: "20px" }}>
                  Thông tin hành khách đi xe
                </h3>
                {passengers.map((passenger, index) => (
                  <section className="passenger-card" key={passenger.seatId} style={{ marginBottom: "16px", padding: "16px", border: "1px solid var(--line)", borderRadius: "8px" }}>
                    <div className="row between" style={{ marginBottom: "12px" }}>
                      <strong style={{ fontSize: "15px", color: "var(--brand)" }}>Ghế {passenger.seatId}</strong>
                      <span className="status" style={{ fontSize: "12px" }}>Hành khách {index + 1}</span>
                    </div>
                    {savedPassengers.length > 0 ? (
                      <div className="field" style={{ marginBottom: "12px" }}>
                        <label>Điền nhanh từ hành khách đã lưu</label>
                        <select defaultValue="" onChange={(event) => applySavedPassenger(index, event.target.value)}>
                          <option value="">-- Chọn hồ sơ --</option>
                          {savedPassengers.map((profile) => (
                            <option key={profile.id} value={profile.id}>{profile.fullName}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div className="field">
                        <label>Họ tên</label>
                        <input value={passenger.fullName} onChange={(event) => updatePassenger(index, "fullName", event.target.value)} placeholder="Nguyễn Văn A" required />
                      </div>
                      <div className="field">
                        <label>Số điện thoại (tùy chọn)</label>
                        <input value={passenger.phone} onChange={(event) => updatePassenger(index, "phone", event.target.value)} placeholder="0900000000" />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Giấy tờ tùy thân (CMND/CCCD/Hộ chiếu)</label>
                        <input value={passenger.documentNumber} onChange={(event) => updatePassenger(index, "documentNumber", event.target.value)} placeholder="Không bắt buộc" />
                      </div>
                    </div>
                  </section>
                ))}
              </div>

              <div className="field" style={{ marginTop: "16px" }}>
                <label>Ghi chú đặt vé (nếu có)</label>
                <textarea 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  placeholder="Ghi chú về điểm đón, hành lý hoặc yêu cầu đặc biệt..." 
                  style={{ width: "100%", minHeight: "80px", borderRadius: "6px", border: "1px solid var(--line)", padding: "10px", outline: "none", fontSize: "14px" }}
                />
              </div>
            </div>

            {/* Payment Methods Selection Box */}
            <div className="panel" style={{ padding: "20px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", marginBottom: "4px" }}>Phương thức thanh toán</h3>
              <p className="muted" style={{ fontSize: "13px", marginBottom: "16px" }}>Chọn kênh thanh toán trực tuyến thuận tiện cho bạn</p>
              
              <div className="payment-methods-grid">
                <div 
                  className={`payment-method-card ${paymentMethod === "momo" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("momo")}
                >
                  <span style={{ fontSize: "20px" }}>📱</span>
                  <span>Ví MoMo</span>
                </div>
                <div 
                  className={`payment-method-card ${paymentMethod === "card" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("card")}
                >
                  <span style={{ fontSize: "20px" }}>💳</span>
                  <span>Thẻ ATM/Visa</span>
                </div>
                <div 
                  className={`payment-method-card ${paymentMethod === "zalopay" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("zalopay")}
                >
                  <span style={{ fontSize: "20px" }}>💸</span>
                  <span>Ví ZaloPay</span>
                </div>
                <div 
                  className={`payment-method-card ${paymentMethod === "transfer" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("transfer")}
                >
                  <span style={{ fontSize: "20px" }}>🏦</span>
                  <span>Chuyển khoản</span>
                </div>
              </div>
            </div>
          </main>

          {/* Right Column: Trip summary ticket details */}
          <aside className="panel" style={{ padding: "20px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "16px" }}>Thông tin chuyến đi</h2>
            
            {tripDetail ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 60px", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <div>
                    <strong style={{ fontSize: "18px", color: "var(--text)" }}>
                      {formatTimeOnly(tripDetail.departureTime)}
                    </strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {formatFullDate(tripDetail.departureTime)}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: "center", position: "relative" }}>
                    <div style={{ height: "2px", background: "var(--line)" }} />
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: "18px", color: "var(--text)" }}>
                      {formatTimeOnly(tripDetail.arrivalTime)}
                    </strong>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                      {formatFullDate(tripDetail.arrivalTime)}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "grid", gap: "12px" }}>
                  <div>
                    <span className="muted" style={{ fontSize: "12px", display: "block" }}>Tuyến đường</span>
                    <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                      {tripDetail.route.origin.name} → {tripDetail.route.destination.name}
                    </strong>
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: "12px", display: "block" }}>Nhà xe & Loại xe</span>
                    <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                      {tripDetail.operatorName} ({tripDetail.vehicleType})
                    </strong>
                  </div>
                  <div>
                    <span className="muted" style={{ fontSize: "12px", display: "block" }}>Ghế đã chọn</span>
                    <strong style={{ fontSize: "15px", color: "var(--brand)" }}>
                      {defaultSeats.join(", ")}
                    </strong>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--line)", marginTop: "16px", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>Tạm tính</span>
                  <strong style={{ fontSize: "22px", color: "var(--brand-dark)", fontWeight: "800" }}>
                    {(passengers.length * tripDetail.price).toLocaleString("vi-VN")}đ
                  </strong>
                </div>
              </>
            ) : (
              <p className="muted" style={{ fontSize: "13px" }}>Đang lấy dữ liệu chuyến xe...</p>
            )}

            {error ? <p className="error" style={{ marginTop: "16px" }}>{error}</p> : null}
            
            <button className="primary" disabled={loading || holdExpired} type="submit" style={{ width: "100%", height: "46px", marginTop: "24px" }}>
              {loading ? "Đang tạo booking..." : "Tạo booking và thanh toán"}
            </button>
          </aside>
        </div>
      </form>
    </>
  );
}

export default function CheckoutPage() {
  return <CheckoutContent />;
}
