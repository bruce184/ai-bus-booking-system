"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { graphqlRequest } from "../../lib/graphql";

const SEARCH_TRIPS = `
  query SearchTrips($input: SearchTripsInput!) {
    searchTrips(input: $input) {
      trips {
        id
        operatorName
        vehicleType
        departureTime
        arrivalTime
        durationMinutes
        price
        availableSeats
        route {
          origin { name }
          destination { name }
        }
      }
      suggestedDates
      seoTitle
    }
  }
`;

function defaultSearchDate() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

function formatTime(value) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

export default function SearchPage() {
  const [origin, setOrigin] = useState("TP.HCM");
  const [destination, setDestination] = useState("Da Lat");
  const [departureDate, setDepartureDate] = useState(defaultSearchDate);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function doSearch(originVal, destinationVal, dateVal) {
    setLoading(true);
    setError("");
    try {
      const data = await graphqlRequest(SEARCH_TRIPS, {
        input: { origin: originVal, destination: destinationVal, departureDate: dateVal }
      });
      setResult(data.searchTrips);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    await doSearch(origin, destination, departureDate);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const fromParam = params.get("from");
      const toParam = params.get("to");
      const dateParam = params.get("date");

      let updatedOrigin = origin;
      let updatedDestination = destination;
      let updatedDate = departureDate;
      let hasParams = false;

      if (fromParam) {
        setOrigin(fromParam);
        updatedOrigin = fromParam;
        hasParams = true;
      }
      if (toParam) {
        setDestination(toParam);
        updatedDestination = toParam;
        hasParams = true;
      }
      if (dateParam) {
        setDepartureDate(dateParam);
        updatedDate = dateParam;
        hasParams = true;
      }

      if (hasParams) {
        doSearch(updatedOrigin, updatedDestination, updatedDate);
      }
    }
  }, []);

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">🟢</div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/my-bookings">Vé của tôi</Link>
          <Link href="/lookup">Tra cứu vé</Link>
        </nav>
      </header>

      <form className="panel form" onSubmit={submit}>
        <div className="grid">
          <div className="field">
            <label>Điểm đi</label>
            <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="TP.HCM" required />
          </div>
          <div className="field">
            <label>Điểm đến</label>
            <input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Da Lat" required />
          </div>
          <div className="field">
            <label>Ngày đi</label>
            <input type="date" value={departureDate} onChange={(event) => setDepartureDate(event.target.value)} required />
          </div>
        </div>
        <button className="primary" disabled={loading} type="submit">
          {loading ? "Đang tìm chuyến..." : "Tìm chuyến"}
        </button>
      </form>

      {error ? <section className="panel"><p className="error">{error}</p></section> : null}

      {result ? (
        <section className="panel form">
          <div className="row between">
            <h2>{result.seoTitle || "Kết quả tìm kiếm"}</h2>
            <span className="status">{result.trips.length} chuyến</span>
          </div>

          {result.trips.length === 0 ? (
            <div className="notice">
              Không có chuyến cho ngày này.
              {result.suggestedDates?.length ? (
                <> Ngày gần nhất còn chuyến: {result.suggestedDates.join(", ")}.</>
              ) : null}
            </div>
          ) : (
            <div className="grid">
              {result.trips.map((trip) => (
                <article className="passenger-card" key={trip.id}>
                  <div className="row between">
                    <strong>
                      {trip.route.origin.name} → {trip.route.destination.name}
                    </strong>
                    <span className="status">{trip.availableSeats} ghế trống</span>
                  </div>
                  <p className="muted">
                    {trip.operatorName} · {trip.vehicleType}
                  </p>
                  <p className="muted">
                    Đi {formatTime(trip.departureTime)} · Đến {formatTime(trip.arrivalTime)} ·{" "}
                    {Math.round(trip.durationMinutes / 60)}h
                  </p>
                  <div className="row between">
                    <strong>{trip.price.toLocaleString("vi-VN")} VND</strong>
                    <Link className="button primary" href={`/trips/${trip.id}`}>
                      Chọn ghế
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
