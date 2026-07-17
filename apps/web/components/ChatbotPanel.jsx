"use client";

import { useMemo, useState } from "react";
import { fetchWithTimeout } from "@bus/shared/http.js";

function uuidv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback (RFC4122-ish)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const toHex = (n) => n.toString(16).padStart(2, "0");
  const b = Array.from(bytes).map(toHex).join("");
  return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
}


function createDefaultSearch() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const departureDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(tomorrow);

  return {
    origin: "TP.HCM",
    destination: "Da Lat",
    departureDate,
  };
}

export function ChatbotPanel() {
  const [search, setSearch] = useState(createDefaultSearch);
  const [booking, setBooking] = useState({
    bookingCode: "",
    email: "",
  });

  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("Chọn một tác vụ để EcoBus trợ giúp.");
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState([]);

  async function ask(payload) {
    const correlationId = uuidv4();
    setLoading(true);

    setTrips([]);
    setAnswer("");

    try {
      const response = await fetchWithTimeout("/api/chatbot", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...payload, correlationId }),
      }, { timeoutMs: 60_000 }); // LLM call (Gemini + tool loop) needs more than the 5s default


      const body = await response.json();
      setAnswer(body.answer ?? "Không có phản hồi.");
      setTrips(body.trips ?? []);
    } catch (error) {
      setTrips([]);
      setAnswer(`Không gọi được trợ lý: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const parsed = useMemo(() => {
    if (!answer) return null;

    try {
      let raw = answer;

      const index = raw.indexOf("{");
      if (index !== -1) raw = raw.substring(index);

      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [answer]);

  const bookingStatus = parsed?.bookingStatus ?? null;
  const bookingError = parsed?.error ?? null;

  return (
    <section className="chatbot-panel animate-fade-in">
      <div className="chatbot-panel-header">
        <span className="eyebrow">AI ASSISTANT</span>
        <h2>Trợ lý EcoBus</h2>
      </div>

      <div className="chatbot-fields">
        <input
          value={search.origin}
          onChange={(e) =>
            setSearch({ ...search, origin: e.target.value })
          }
        />

        <input
          value={search.destination}
          onChange={(e) =>
            setSearch({ ...search, destination: e.target.value })
          }
        />

        <input
          type="date"
          value={search.departureDate}
          onChange={(e) =>
            setSearch({ ...search, departureDate: e.target.value })
          }
        />
      </div>

      <div className="chatbot-actions">
        <button
          onClick={() =>
            ask({
              intent: "searchTrips",
              input: search,
            })
          }
          disabled={loading}
        >
          Tìm chuyến
        </button>

        <button
          onClick={() =>
            ask({
              intent: "policy",
              policy: "cancellation",
            })
          }
          disabled={loading}
        >
          Hủy vé
        </button>

        <button
          onClick={() =>
            ask({
              intent: "policy",
              policy: "checkin",
            })
          }
          disabled={loading}
        >
          Check-in
        </button>
      </div>

      <div className="chatbot-fields two">
        <input
          placeholder="BK202606200001"
          value={booking.bookingCode}
          onChange={(e) =>
            setBooking({
              ...booking,
              bookingCode: e.target.value,
            })
          }
        />

        <input
          placeholder="guest@example.com"
          value={booking.email}
          onChange={(e) =>
            setBooking({
              ...booking,
              email: e.target.value,
            })
          }
        />
      </div>

      <button
        className="chatbot-lookup"
        onClick={() =>
          ask({
            intent: "getBookingStatus",
            input: booking,
          })
        }
        disabled={loading}
      >
        Tra cứu booking
      </button>

      <div className="chatbot-ai-prompt">
        <textarea
          placeholder="Hỏi về chuyến xe..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />

        <button
          onClick={() => ask({ message })}
          disabled={loading || !message.trim()}
        >
          Hỏi AI
        </button>
      </div>

      {loading && <div className="chatbot-answer">⏳ Đang xử lý...</div>}

      {!loading && bookingStatus && (
        <div className="booking-card">
          <h3>🎫 Thông tin booking</h3>

          <div className="booking-item">
            <span>Mã booking: </span>
            <strong>{bookingStatus.bookingCode}</strong>
          </div>

          <div className="booking-item">
            <span>Email: </span>
            <strong>{bookingStatus.contactEmail}</strong>
          </div>

          <div className="booking-item">
            <span>Trạng thái: </span>
            <span className="booking-status success">
              {bookingStatus.status}
            </span>
          </div>

          <div className="booking-item">
            <span>Tổng tiền: </span>
            <strong>
              {Number(bookingStatus.totalAmount).toLocaleString("vi-VN")}đ
            </strong>
          </div>
        </div>
      )}

      {!loading && bookingError && (
              <div className="booking-card error">

                <h3>Không tìm thấy booking</h3>

                <p>
                  Vui lòng kiểm tra lại mã booking hoặc email bạn đã nhập.
                </p>
              </div>
            )}

            {!loading && !bookingStatus && !bookingError && (
        trips.length > 0 ? (
          <div className="trip-result">
            <h3>🚌 Chuyến xe tìm được</h3>

            {trips.map((trip) => (
              <div className="trip-card" key={trip.id}>
                <div className="trip-header">
                  <div>
                    <h4>{trip.operatorName}</h4>
                    <span>{trip.id}</span>
                  </div>

                  <div className="trip-price">
                    {Number(trip.price).toLocaleString("vi-VN")}đ
                  </div>
                </div>

                <div className="trip-body">

                  <div className="trip-item">
                    <span>🕑 Khởi hành</span>
                    <strong>{trip.departureTime}</strong>
                  </div>

                  <div className="trip-item">
                    <span>🕔 Đến nơi</span>
                    <strong>{trip.arrivalTime}</strong>
                  </div>

                  <div className="trip-item">
                    <span>💺 Ghế trống</span>
                    <strong>{trip.availableSeats}</strong>
                  </div>

                </div>
              </div>
            ))}
          </div>
        ) : (
          <pre className="chatbot-answer">
            {answer}
          </pre>
        )
      )}
    </section>
  );
}

export default ChatbotPanel;