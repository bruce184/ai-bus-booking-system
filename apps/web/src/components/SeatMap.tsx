import { useMemo, useState } from "react";
import { holdSeats, type Seat, type SeatHold, type SeatStatus } from "../graphql/seatOperations.js";

type SeatMapProps = {
  graphqlUrl: string;
  tripId: string;
  seats: Seat[];
  onHoldCreated?: (hold: SeatHold) => void;
};

const seatStatusLabel: Record<SeatStatus, string> = {
  AVAILABLE: "Trống",
  HELD: "Đang giữ",
  BOOKED: "Đã đặt",
  BLOCKED: "Khóa"
};

const seatClassName: Record<SeatStatus, string> = {
  AVAILABLE: "seat seat-available",
  HELD: "seat seat-held",
  BOOKED: "seat seat-booked",
  BLOCKED: "seat seat-blocked"
};

function isSelectable(seat: Seat): boolean {
  return seat.status === "AVAILABLE";
}

function groupSeatsByDeck(seats: Seat[]): Map<number, Seat[]> {
  return seats.reduce((deckMap, seat) => {
    const deckSeats = deckMap.get(seat.deck) ?? [];
    deckSeats.push(seat);
    deckMap.set(seat.deck, deckSeats);
    return deckMap;
  }, new Map<number, Seat[]>());
}

function sortSeatLayout(seats: Seat[]): Seat[] {
  return [...seats].sort((a, b) => a.row - b.row || a.column - b.column || a.label.localeCompare(b.label));
}

export function SeatMap({ graphqlUrl, tripId, seats, onHoldCreated }: SeatMapProps) {
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seatsByDeck = useMemo(() => groupSeatsByDeck(seats), [seats]);

  function toggleSeat(seat: Seat): void {
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

  async function handleHoldSeats(): Promise<void> {
    if (selectedSeatIds.length === 0) {
      setError("Vui lòng chọn ít nhất một ghế.");
      return;
    }

    setIsHolding(true);
    setError(null);

    try {
      const hold = await holdSeats(graphqlUrl, tripId, selectedSeatIds);
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
          {(Object.keys(seatStatusLabel) as SeatStatus[]).map((status) => (
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
