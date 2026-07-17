import { useEffect, useMemo, useState } from "react";
import { Lock, LifeBuoy } from "lucide-react";
import {
  holdSeats,
  releaseSeatHold
} from "../graphql/seatOperations.js";
import { subscribeSeatStateChanged } from "../graphql/wsClient.js";
import { CountdownRing } from "./ui/CountdownRing.jsx";
import { MAX_CHECKOUT_SEATS } from "../../lib/flow-context-client.js";

const HOLD_TTL_SECONDS = 300;

const seatStatusLabel = {
  AVAILABLE: "Trống",
  HELD: "Đang giữ",
  BOOKED: "Đã đặt",
  BLOCKED: "Khóa"
};

const seatClassName = {
  AVAILABLE: "seat seat-available",
  HELD: "seat seat-held",
  BOOKED: "seat seat-booked",
  BLOCKED: "seat seat-blocked"
};

function isSelectable(seat) {
  return seat.status === "AVAILABLE";
}

function groupSeatsByDeck(seats) {
  return seats.reduce((deckMap, seat) => {
    const deckSeats = deckMap.get(seat.deck) ?? [];
    deckSeats.push(seat);
    deckMap.set(seat.deck, deckSeats);
    return deckMap;
  }, new Map());
}

function sortSeatLayout(seats) {
  return [...seats].sort((a, b) => a.row - b.row || a.column - b.column || a.label.localeCompare(b.label));
}

/**
 * Chèn "lối đi" giữa xe: thêm một track hẹp vào grid sau cột giữa,
 * ghế bên phải lối đi dịch sang 1 cột trong grid.
 */
function buildAisleLayout(deckSeats) {
  const maxColumn = Math.max(1, ...deckSeats.map((seat) => seat.column));
  const aisleAfter = maxColumn >= 2 ? Math.floor(maxColumn / 2) : 0;
  const tracks = [];
  for (let column = 1; column <= maxColumn; column += 1) {
    tracks.push("52px");
    if (column === aisleAfter) {
      tracks.push("26px");
    }
  }
  return {
    gridTemplateColumns: tracks.join(" "),
    gridColumnFor: (column) => (aisleAfter && column > aisleAfter ? column + 1 : column)
  };
}

export function SeatMap({ graphqlUrl, tripId, seats, price = 220000, onHoldCreated }) {
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [activeHold, setActiveHold] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isHolding, setIsHolding] = useState(false);
  const [error, setError] = useState(null);
  // Cập nhật realtime qua subscription, lưu theo seat id rồi merge với props
  // bằng useMemo — không cần đồng bộ props vào state.
  const [liveUpdates, setLiveUpdates] = useState(() => new Map());

  useEffect(() => {
    return subscribeSeatStateChanged(tripId, (seat) => {
      setLiveUpdates((current) => new Map(current).set(seat.id, seat));
      if (seat.status !== "AVAILABLE") {
        // Ghế vừa bị người khác giữ/đặt/khóa thì bỏ khỏi lựa chọn hiện tại.
        setSelectedSeatIds((current) => current.filter((seatId) => seatId !== seat.id));
      }
    });
  }, [tripId]);

  const liveSeats = useMemo(
    () => seats.map((seat) => (liveUpdates.has(seat.id) ? { ...seat, ...liveUpdates.get(seat.id) } : seat)),
    [seats, liveUpdates]
  );

  const seatsByDeck = useMemo(() => groupSeatsByDeck(liveSeats), [liveSeats]);

  const selectedSeatsLabels = useMemo(() => {
    return liveSeats
      .filter((s) => selectedSeatIds.includes(s.id))
      .map((s) => s.label);
  }, [liveSeats, selectedSeatIds]);

  useEffect(() => {
    if (!activeHold) {
      setTimeout(() => setRemainingSeconds(null), 0);
      return undefined;
    }

    const currentHold = activeHold;
    let releaseStarted = false;
    let cancelled = false;

    async function tick() {
      const secondsLeft = Math.max(
        0,
        Math.ceil((new Date(currentHold.expiresAt).getTime() - Date.now()) / 1000)
      );

      if (cancelled) {
        return;
      }

      setRemainingSeconds(secondsLeft);

      if (secondsLeft > 0 || releaseStarted) {
        return;
      }

      releaseStarted = true;

      try {
        await releaseSeatHold(graphqlUrl, currentHold.holdToken);
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Không thể tự giải phóng ghế đã giữ."
        );
      } finally {
        if (!cancelled) {
          setActiveHold(null);
        }
      }
    }

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeHold, graphqlUrl]);

  function toggleSeat(seat) {
    if (!isSelectable(seat) || isHolding) {
      return;
    }

    const alreadySelected = selectedSeatIds.includes(seat.id);
    if (!alreadySelected && selectedSeatIds.length >= MAX_CHECKOUT_SEATS) {
      // Checkout's flow-context store rejects a hold over this size (see
      // lib/server/flow-context.js); block it here instead of creating a
      // hold that can never reach checkout.
      setError(`Chỉ được chọn tối đa ${MAX_CHECKOUT_SEATS} ghế trong một lần đặt.`);
      return;
    }

    setError(null);
    setSelectedSeatIds((current) =>
      alreadySelected
        ? current.filter((seatId) => seatId !== seat.id)
        : [...current, seat.id]
    );
  }

  async function handleHoldSeats() {
    if (selectedSeatIds.length === 0) {
      setError("Vui lòng chọn ít nhất một ghế.");
      return;
    }

    setIsHolding(true);
    setError(null);

    try {
      const hold = await holdSeats(graphqlUrl, tripId, selectedSeatIds);
      setActiveHold(hold);
      setSelectedSeatIds([]);
      onHoldCreated?.(hold);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Không thể giữ ghế.");
    } finally {
      setIsHolding(false);
    }
  }

  return (
    <section className="seat-map animate-fade-in" aria-label="Sơ đồ ghế">
      <div className="seat-map-toolbar">
        <div className="seat-legend" aria-label="Chú thích trạng thái ghế">
          {Object.keys(seatStatusLabel).map((status) => (
            <span className="seat-legend-item" key={status}>
              <span className={seatClassName[status]} aria-hidden="true" />
              {seatStatusLabel[status]}
            </span>
          ))}
        </div>
      </div>

      {activeHold && remainingSeconds !== null ? (
        <div className="seat-hold-countdown" role="status" style={{ marginBottom: "16px" }}>
          <CountdownRing remainingSeconds={remainingSeconds} totalSeconds={HOLD_TTL_SECONDS} />
          <span>Ghế đang được giữ cho bạn</span>
        </div>
      ) : null}

      <div className="seat-decks-container">
        {Array.from(seatsByDeck.entries()).map(([deck, deckSeats]) => {
          const layout = buildAisleLayout(deckSeats);
          return (
            <div className="seat-deck animate-fade-in" key={deck}>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--brand)", marginBottom: "12px", textAlign: "center" }}>
                {seatsByDeck.size > 1 ? `Tầng ${deck}` : "Sơ đồ xe"}
              </h3>
              <div className="bus-frame">
                {deck === 1 ? (
                  <div className="bus-driver" aria-hidden="true">
                    <LifeBuoy size={22} strokeWidth={1.8} />
                    <span>Tài xế</span>
                  </div>
                ) : null}
                <div className="seat-grid" style={{ gridTemplateColumns: layout.gridTemplateColumns }}>
                  {sortSeatLayout(deckSeats).map((seat) => {
                    const selected = selectedSeatIds.includes(seat.id);

                    return (
                      <button
                        aria-pressed={selected}
                        className={`${seatClassName[seat.status]}${selected ? " seat-selected" : ""}`}
                        disabled={!isSelectable(seat) || isHolding}
                        key={seat.id}
                        onClick={() => toggleSeat(seat)}
                        style={{
                          gridColumn: layout.gridColumnFor(seat.column),
                          gridRow: seat.row
                        }}
                        title={`${seat.label} - ${seatStatusLabel[seat.status]}`}
                        type="button"
                      >
                        {seat.status === "BLOCKED" ? <Lock size={11} aria-hidden="true" /> : null}
                        {seat.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {error ? <p className="seat-map-error" style={{ marginTop: "16px" }}>{error}</p> : null}

      {/* Mockup Sticky Selected Status Footer */}
      <div className="seat-map-footer">
        <div>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>
            Đã chọn {selectedSeatIds.length} ghế
          </span>
          <strong style={{ fontSize: "16px", color: "var(--text)" }}>
            {selectedSeatsLabels.join(", ") || "Chưa chọn"}
          </strong>
        </div>
        <div style={{ textAlign: "right", marginRight: "16px" }}>
          <span style={{ fontSize: "12px", color: "var(--muted)" }}>Tổng tiền</span>
          <strong style={{ fontSize: "20px", color: "var(--brand-dark)" }}>
            {(selectedSeatIds.length * price).toLocaleString("vi-VN")}đ
          </strong>
        </div>
        <button
          className="seat-hold-button primary"
          disabled={isHolding || selectedSeatIds.length === 0}
          onClick={handleHoldSeats}
          type="button"
          style={{ minWidth: "120px", height: "42px" }}
        >
          {isHolding ? "Đang xử lý..." : "Tiếp tục"}
        </button>
      </div>
    </section>
  );
}
