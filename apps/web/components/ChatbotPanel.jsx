"use client";

import { useState } from "react";

const defaultSearch = {
  origin: "TP.HCM",
  destination: "Da Lat",
  departureDate: "2026-06-20"
};

export function ChatbotPanel() {
  const [search, setSearch] = useState(defaultSearch);
  const [booking, setBooking] = useState({ bookingCode: "", email: "" });
  const [answer, setAnswer] = useState(
    "Chon mot hanh dong de minh goi tool noi bo. Neu service chua chay, minh se bao loi ro rang thay vi bia data."
  );
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
      setAnswer(body.answer);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chatbot-panel" aria-label="AI chatbot panel">
      <div className="chatbot-header">
        <h2>AI travel helper</h2>
        <p>Tool calling only: trips, booking status, and internal policies.</p>
      </div>

      <div className="chatbot-body">
        <div className="field-row">
          <input
            aria-label="Origin"
            value={search.origin}
            onChange={(event) => setSearch({ ...search, origin: event.target.value })}
          />
          <input
            aria-label="Destination"
            value={search.destination}
            onChange={(event) => setSearch({ ...search, destination: event.target.value })}
          />
        </div>
        <input
          aria-label="Departure date"
          value={search.departureDate}
          onChange={(event) => setSearch({ ...search, departureDate: event.target.value })}
        />

        <div className="button-row">
          <button onClick={() => ask({ intent: "searchTrips", input: search })} disabled={loading}>
            Search trips
          </button>
          <button
            className="secondary"
            onClick={() => ask({ intent: "policy", policy: "cancellation" })}
            disabled={loading}
          >
            Cancellation policy
          </button>
          <button
            className="secondary"
            onClick={() => ask({ intent: "policy", policy: "checkin" })}
            disabled={loading}
          >
            Check-in policy
          </button>
        </div>

        <div className="field-row">
          <input
            aria-label="Booking code"
            placeholder="BK202606200001"
            value={booking.bookingCode}
            onChange={(event) => setBooking({ ...booking, bookingCode: event.target.value })}
          />
          <input
            aria-label="Booking email"
            placeholder="guest@example.com"
            value={booking.email}
            onChange={(event) => setBooking({ ...booking, email: event.target.value })}
          />
        </div>
        <button
          className="warning"
          onClick={() => ask({ intent: "getBookingStatus", input: booking })}
          disabled={loading}
        >
          Lookup booking status
        </button>

        <div className="answer">
          {loading ? "Dang goi tool..." : answer}
        </div>
      </div>
    </section>
  );
}
