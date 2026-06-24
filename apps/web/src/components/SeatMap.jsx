import { useEffect, useMemo, useState } from "react";
import {
  holdSeats,
  releaseSeatHold
} from "../graphql/seatOperations.js";

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

export function SeatMap({ graphqlUrl, tripId, seats, onHoldCreated }) {
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [activeHold, setActiveHold] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(null);
  const [isHolding, setIsHolding] = useState(false);
  const [error, setError] = useState(null);

  const seatsByDeck = useMemo(() => groupSeatsByDeck(seats), [seats]);

  useEffect(() => {
    if (!activeHold) {
      setRemainingSeconds(null);
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

    setError(null);
    setSelectedSeatIds((current) =>
      current.includes(seat.id)
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
    <section className="seat-map" aria-label="Sơ đồ ghế">
      <div className="seat-map-toolbar">
        <div className="seat-legend" aria-label="Chú thích trạng thái ghế">
          {Object.keys(seatStatusLabel).map((status) => (
            <span className="seat-legend-item" key={status}>
              <span className={seatClassName[status]} aria-hidden="true" />
              {seatStatusLabel[status]}
            </span>
          ))}
        </div>
        <button
          className="seat-hold-button"
          disabled={isHolding || selectedSeatIds.length === 0}
          onClick={handleHoldSeats}
          type="button"
        >
          {isHolding ? "Đang giữ..." : `Giữ ${selectedSeatIds.length} ghế`}
        </button>
      </div>

      {activeHold && remainingSeconds !== null ? (
        <div className="seat-hold-countdown" role="status">
          Giữ ghế còn {remainingSeconds}s
        </div>
      ) : null}

      {Array.from(seatsByDeck.entries()).map(([deck, deckSeats]) => (
        <div className="seat-deck" key={deck}>
          <h3>Tầng {deck}</h3>
          <div className="seat-grid">
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
                    gridColumn: seat.column,
                    gridRow: seat.row
                  }}
                  title={`${seat.label} - ${seatStatusLabel[seat.status]}`}
                  type="button"
                >
                  {seat.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {error ? <p className="seat-map-error">{error}</p> : null}
    </section>
  );
}
