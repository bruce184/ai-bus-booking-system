"use client";

import { useState } from "react";

function createDefaultSearch() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const departureDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(tomorrow);

  return {
    origin: "TP.HCM",
    destination: "Da Lat",
    departureDate
  };
}

export function ChatbotPanel() {
  const [search, setSearch] = useState(createDefaultSearch);
  const [booking, setBooking] = useState({ bookingCode: "", email: "" });
  const [message, setMessage] = useState("");
  const [answer, setAnswer] = useState("Chọn một tác vụ để EcoBus trợ giúp.");
  const [loading, setLoading] = useState(false);

  async function ask(payload) {
    setLoading(true);
    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      setAnswer(body.answer ?? "Không có phản hồi.");
    } catch (error) {
      setAnswer(`Không gọi được trợ lý: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chatbot-panel animate-fade-in" aria-label="EcoBus AI assistant">
      <div className="chatbot-panel-header">
        <span className="eyebrow">AI ASSISTANT</span>
        <h2>Trợ lý EcoBus</h2>
      </div>

      <div className="chatbot-fields">
        <input
          aria-label="Điểm đi"
          value={search.origin}
          onChange={(event) => setSearch({ ...search, origin: event.target.value })}
        />
        <input
          aria-label="Điểm đến"
          value={search.destination}
          onChange={(event) => setSearch({ ...search, destination: event.target.value })}
        />
        <input
          aria-label="Ngày đi"
          type="date"
          value={search.departureDate}
          onChange={(event) => setSearch({ ...search, departureDate: event.target.value })}
        />
      </div>

      <div className="chatbot-actions">
        <button type="button" onClick={() => ask({ intent: "searchTrips", input: search })} disabled={loading}>
          Tìm chuyến
        </button>
        <button type="button" onClick={() => ask({ intent: "policy", policy: "cancellation" })} disabled={loading}>
          Hủy vé
        </button>
        <button type="button" onClick={() => ask({ intent: "policy", policy: "checkin" })} disabled={loading}>
          Check-in
        </button>
      </div>

      <div className="chatbot-fields two">
        <input
          aria-label="Mã đặt chỗ"
          placeholder="BK202606200001"
          value={booking.bookingCode}
          onChange={(event) => setBooking({ ...booking, bookingCode: event.target.value })}
        />
        <input
          aria-label="Email đặt chỗ"
          placeholder="guest@example.com"
          value={booking.email}
          onChange={(event) => setBooking({ ...booking, email: event.target.value })}
        />
      </div>

      <button
        type="button"
        className="chatbot-lookup"
        onClick={() => ask({ intent: "getBookingStatus", input: booking })}
        disabled={loading}
      >
        Tra cứu booking
      </button>

      <div className="chatbot-ai-prompt">
        <textarea
          aria-label="Câu hỏi cho AI"
          placeholder="Hỏi về chuyến xe, chính sách, hoặc booking..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          type="button"
          onClick={() => ask({ message })}
          disabled={loading || !message.trim()}
        >
          Hỏi AI
        </button>
      </div>

      <pre className="chatbot-answer">{loading ? "Đang gọi tool..." : answer}</pre>
    </section>
  );
}
