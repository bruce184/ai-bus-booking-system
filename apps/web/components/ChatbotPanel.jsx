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
  const [answer, setAnswer] = useState("Chon mot tac vu de EcoBus tro ly.");
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
      setAnswer(body.answer ?? "Khong co phan hoi.");
    } catch (error) {
      setAnswer(`Khong goi duoc tro ly: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chatbot-panel animate-fade-in" aria-label="EcoBus AI assistant">
      <div className="chatbot-panel-header">
        <span className="eyebrow">AI ASSISTANT</span>
        <h2>Tro ly EcoBus</h2>
      </div>

      <div className="chatbot-fields">
        <input
          aria-label="Diem di"
          value={search.origin}
          onChange={(event) => setSearch({ ...search, origin: event.target.value })}
        />
        <input
          aria-label="Diem den"
          value={search.destination}
          onChange={(event) => setSearch({ ...search, destination: event.target.value })}
        />
        <input
          aria-label="Ngay di"
          type="date"
          value={search.departureDate}
          onChange={(event) => setSearch({ ...search, departureDate: event.target.value })}
        />
      </div>

      <div className="chatbot-actions">
        <button type="button" onClick={() => ask({ intent: "searchTrips", input: search })} disabled={loading}>
          Tim chuyen
        </button>
        <button type="button" onClick={() => ask({ intent: "policy", policy: "cancellation" })} disabled={loading}>
          Huy ve
        </button>
        <button type="button" onClick={() => ask({ intent: "policy", policy: "checkin" })} disabled={loading}>
          Check-in
        </button>
      </div>

      <div className="chatbot-fields two">
        <input
          aria-label="Ma dat cho"
          placeholder="BK202606200001"
          value={booking.bookingCode}
          onChange={(event) => setBooking({ ...booking, bookingCode: event.target.value })}
        />
        <input
          aria-label="Email dat cho"
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
        Tra cuu booking
      </button>

      <div className="chatbot-ai-prompt">
        <textarea
          aria-label="Cau hoi cho AI"
          placeholder="Hoi ve chuyen xe, chinh sach, hoac booking..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          type="button"
          onClick={() => ask({ message })}
          disabled={loading || !message.trim()}
        >
          Hoi AI
        </button>
      </div>

      <pre className="chatbot-answer">{loading ? "Dang goi tool..." : answer}</pre>
    </section>
  );
}
