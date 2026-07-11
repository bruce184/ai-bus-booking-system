"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { GRAPHQL_ENDPOINT, graphqlRequest } from "../../../lib/graphql";
import { SeatMap } from "../../../src/components/SeatMap.jsx";
import { TopBar } from "../../../src/components/TopBar.jsx";

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

export default function TripDetailClient({ initialDetail, tripId: initialTripId }) {
  const params = useParams();
  const router = useRouter();
  const tripId = params?.tripId || initialTripId;
  const [detail, setDetail] = useState(initialDetail || null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initialDetail);

  useEffect(() => {
    if (initialDetail) {
      return undefined;
    }

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
  }, [tripId, initialDetail]);

  function handleHoldCreated(hold) {
    const seats = hold.seats.map((seat) => seat.id).join(",");
    router.push(
      `/checkout?tripId=${encodeURIComponent(tripId)}&holdToken=${encodeURIComponent(hold.holdToken)}&seats=${encodeURIComponent(seats)}&expiresAt=${encodeURIComponent(hold.expiresAt)}`
    );
  }

  return (
    <>
      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/search", label: "Tìm chuyến" }, { href: "/lookup", label: "Tra cứu vé" }]} showUserBadge />

      <div className="breadcrumbs animate-fade-in" style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "20px" }}>
        <Link href="/">Trang chủ</Link> &gt; <Link href="/search">Tìm chuyến</Link> &gt; <span style={{ color: "var(--text)", fontWeight: "500" }}>Chọn ghế</span>
      </div>

      {loading ? <section className="panel">Đang tải thông tin chuyến xe và sơ đồ ghế...</section> : null}
      {error ? <section className="panel"><p className="error">{error}</p></section> : null}

      {detail ? (
        <div className="grid animate-fade-in" style={{ gridTemplateColumns: "320px 1fr", alignItems: "start", gap: "24px" }}>

          {/* Left Column: Trip Summary Info */}
          <aside style={{ display: "grid", gap: "20px" }}>
            <div className="panel" style={{ padding: "20px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "800", marginBottom: "16px" }}>Thông tin chuyến đi</h2>

              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 60px", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <strong style={{ fontSize: "18px", color: "var(--text)" }}>
                    {formatTimeOnly(detail.trip.departureTime)}
                  </strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                    {formatFullDate(detail.trip.departureTime)}
                  </div>
                </div>

                <div style={{ textAlign: "center", position: "relative" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "2px" }}>
                    {Math.floor(detail.trip.durationMinutes / 60)}h {detail.trip.durationMinutes % 60}m
                  </span>
                  <div style={{ height: "2px", background: "var(--line)", position: "relative" }}>
                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--brand)", position: "absolute", left: 0, top: "-1px" }} />
                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: "var(--brand)", position: "absolute", right: 0, top: "-1px" }} />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "18px", color: "var(--text)" }}>
                    {formatTimeOnly(detail.trip.arrivalTime)}
                  </strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>
                    {formatFullDate(detail.trip.arrivalTime)}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "12px", display: "grid", gap: "10px" }}>
                <div>
                  <span className="muted" style={{ fontSize: "12px", display: "block" }}>Nhà xe & Loại xe</span>
                  <strong style={{ fontSize: "14px", color: "var(--text)" }}>
                    {detail.trip.operatorName} ({detail.trip.vehicleType})
                  </strong>
                </div>
                <div>
                  <span className="muted" style={{ fontSize: "12px", display: "block" }}>Giá vé niêm yết</span>
                  <strong style={{ fontSize: "16px", color: "var(--brand)" }}>
                    {detail.trip.price.toLocaleString("vi-VN")}đ/vé
                  </strong>
                </div>
              </div>
            </div>

            {/* Pickup/Dropoff and Policies Panel */}
            <div className="panel" style={{ padding: "20px", fontSize: "13px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "800", marginBottom: "10px" }}>Điểm đón & trả</h3>
              <div style={{ display: "grid", gap: "8px", color: "var(--muted)" }}>
                <div><strong>Đón:</strong> {detail.pickupPoints.map((stop) => stop.name).join(", ") || "Theo tuyến"}</div>
                <div><strong>Trả:</strong> {detail.dropoffPoints.map((stop) => stop.name).join(", ") || "Theo tuyến"}</div>
              </div>
              <div style={{ borderTop: "1px solid var(--line)", marginTop: "12px", paddingTop: "12px", display: "grid", gap: "6px" }}>
                <div style={{ color: "var(--muted)" }}>🛡️ {detail.cancellationPolicy}</div>
                <div style={{ color: "var(--muted)" }}>📝 {detail.checkinPolicy}</div>
              </div>
            </div>
          </aside>

          {/* Right Column: Seat Map Tab Card */}
          <main className="panel" style={{ padding: "24px" }}>
            <div className="row between" style={{ alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "16px", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800" }}>Chọn ghế</h2>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px" }}>Chọn chỗ ngồi phù hợp và tiếp tục đặt vé</p>
              </div>
              <span className="status">{detail.trip.availableSeats} ghế trống</span>
            </div>

            <SeatMap
              graphqlUrl={GRAPHQL_ENDPOINT}
              tripId={tripId}
              seats={detail.seats}
              price={detail.trip.price}
              onHoldCreated={handleHoldCreated}
            />
          </main>
        </div>
      ) : null}
    </>
  );
}
