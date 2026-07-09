"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { GRAPHQL_ENDPOINT, graphqlRequest } from "../../../lib/graphql";
import { SeatMap } from "../../../src/components/SeatMap.jsx";

const TRIP_DETAIL = `
  query Trip($id: ID!) {
    trip(id: $id) {
      trip {
        id
        operatorName
        vehicleType
        departureTime
        arrivalTime
        durationMinutes
        price
        availableSeats
        status
        route {
          origin { name }
          destination { name }
        }
      }
      pickupPoints { id name address }
      dropoffPoints { id name address }
      cancellationPolicy
      checkinPolicy
      seats { id label deck row column status }
    }
  }
`;

function formatTime(value) {
  return new Date(value).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  });
}

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.tripId;
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tripId) {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const data = await graphqlRequest(TRIP_DETAIL, { id: tripId });
        if (!cancelled) {
          setDetail(data.trip);
          setError(data.trip ? "" : "Không tìm thấy chuyến xe.");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  function handleHoldCreated(hold) {
    const seats = hold.seats.map((seat) => seat.id).join(",");
    router.push(
      `/checkout?tripId=${encodeURIComponent(tripId)}&holdToken=${encodeURIComponent(hold.holdToken)}&seats=${encodeURIComponent(seats)}`
    );
  }

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">🟢</div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/search">Tìm chuyến</Link>
          <Link href="/lookup">Tra cứu vé</Link>
        </nav>
      </header>

      {loading ? <section className="panel">Đang tải chuyến xe...</section> : null}
      {error ? <section className="panel"><p className="error">{error}</p></section> : null}

      {detail ? (
        <>
          <section className="grid">
            <div className="summary-panel">
              <div className="metric">
                <span className="muted">Nhà xe</span>
                <strong>{detail.trip.operatorName}</strong>
              </div>
              <div className="metric">
                <span className="muted">Khởi hành</span>
                <strong>{formatTime(detail.trip.departureTime)}</strong>
              </div>
              <div className="metric">
                <span className="muted">Giá vé</span>
                <strong>{detail.trip.price.toLocaleString("vi-VN")} VND</strong>
              </div>
              <div className="metric">
                <span className="muted">Ghế trống</span>
                <strong>{detail.trip.availableSeats}</strong>
              </div>
            </div>
            <div className="summary-panel">
              <div className="metric">
                <span className="muted">Điểm đón</span>
                <strong>{detail.pickupPoints.map((stop) => stop.name).join(", ") || "Theo tuyến"}</strong>
              </div>
              <div className="metric">
                <span className="muted">Điểm trả</span>
                <strong>{detail.dropoffPoints.map((stop) => stop.name).join(", ") || "Theo tuyến"}</strong>
              </div>
              <p className="muted">{detail.cancellationPolicy}</p>
              <p className="muted">{detail.checkinPolicy}</p>
            </div>
          </section>

          <section className="panel form">
            <div className="row between">
              <h2>Sơ đồ ghế</h2>
              <span className="status">{detail.trip.vehicleType}</span>
            </div>
            <SeatMap
              graphqlUrl={GRAPHQL_ENDPOINT}
              tripId={tripId}
              seats={detail.seats}
              onHoldCreated={handleHoldCreated}
            />
            <p className="muted">
              Sau khi giữ ghế thành công, bạn sẽ được chuyển sang trang checkout với ghế và hold token đã điền sẵn.
            </p>
          </section>
        </>
      ) : null}
    </>
  );
}
