"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { graphqlRequest } from "../../lib/graphql";
import { TopBar } from "../../src/components/TopBar.jsx";
import { LocationInput } from "../../src/components/LocationInput.jsx";

// Departure-hour filter bounds (0h..24h). 24 means "end of day / no upper cap".
const HOUR_MIN = 0;
const HOUR_MAX = 24;

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
      cacheHit
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

export default function SearchClient({
  initialOrigin,
  initialDestination,
  initialDepartureDate,
  initialResult,
  initialError = ""
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [departureDate, setDepartureDate] = useState(initialDepartureDate);
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const latestSearchRequest = useRef(0);

  // Filter & sort states (client-side + server-side)
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [hourRange, setHourRange] = useState([HOUR_MIN, HOUR_MAX]);
  const [selectedVehicleTypes, setSelectedVehicleTypes] = useState([]);
  const [minSeats, setMinSeats] = useState(0);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [sortBy, setSortBy] = useState("earliest");

  const doSearch = useCallback(async (originVal, destinationVal, dateVal, sortVal = "earliest", minPVal = 0, maxPVal = 0) => {
    const requestId = latestSearchRequest.current + 1;
    latestSearchRequest.current = requestId;
    const normalizedMinPrice = Math.max(0, Math.trunc(Number(minPVal) || 0));
    const normalizedMaxPrice = Math.max(0, Math.trunc(Number(maxPVal) || 0));

    if (normalizedMinPrice > 0 && normalizedMaxPrice > 0 && normalizedMinPrice > normalizedMaxPrice) {
      setError("Giá tối thiểu không được lớn hơn giá tối đa.");
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await graphqlRequest(SEARCH_TRIPS, {
        input: {
          origin: originVal,
          destination: destinationVal,
          departureDate: dateVal,
          sortBy: sortVal,
          minPrice: normalizedMinPrice,
          maxPrice: normalizedMaxPrice,
        }
      });
      if (requestId === latestSearchRequest.current) {
        setResult(data.searchTrips);
      }
    } catch (err) {
      if (requestId === latestSearchRequest.current) {
        setError(err.message);
        setResult(null);
      }
    } finally {
      if (requestId === latestSearchRequest.current) {
        setLoading(false);
      }
    }
  }, []);

  function submit(event) {
    event.preventDefault();
    setShowSearchForm(false);
    setLoading(true);
    setError("");
    router.replace(`/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}&date=${departureDate}`);
  }

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  // Compute list of unique operators in the result for filter checkboxes
  const operators = useMemo(() => {
    if (!result?.trips) return [];
    const set = new Set(result.trips.map(t => t.operatorName));
    return Array.from(set);
  }, [result]);

  const vehicleTypes = useMemo(() => {
    if (!result?.trips) return [];
    return Array.from(new Set(result.trips.map(t => t.vehicleType)));
  }, [result]);

  // Client-side filtering (server handles sorting via sortBy parameter)
  const filteredTrips = useMemo(() => {
    if (!result?.trips) return [];

    let list = [...result.trips];

    if (selectedOperators.length > 0) {
      list = list.filter(t => selectedOperators.includes(t.operatorName));
    }

    if (minPrice > 0 || maxPrice > 0) {
      list = list.filter(t => {
        if (minPrice > 0 && t.price < minPrice) return false;
        if (maxPrice > 0 && t.price > maxPrice) return false;
        return true;
      });
    }

    if (hourRange[0] > HOUR_MIN || hourRange[1] < HOUR_MAX) {
      list = list.filter(t => {
        const hour = new Date(t.departureTime).getHours();
        return hour >= hourRange[0] && hour <= hourRange[1];
      });
    }

    if (selectedVehicleTypes.length > 0) {
      list = list.filter(t => selectedVehicleTypes.includes(t.vehicleType));
    }

    if (minSeats > 0) {
      list = list.filter(t => t.availableSeats >= minSeats);
    }

    return list;
  }, [result, selectedOperators, minPrice, maxPrice, hourRange, selectedVehicleTypes, minSeats]);

  const toggleOperator = (op) => {
    setSelectedOperators(prev =>
      prev.includes(op) ? prev.filter(item => item !== op) : [...prev, op]
    );
  };

  const clearFilters = () => {
    setSelectedOperators([]);
    setMinPrice(0);
    setMaxPrice(0);
    setHourRange([HOUR_MIN, HOUR_MAX]);
    setSelectedVehicleTypes([]);
    setMinSeats(0);
    void doSearch(origin, destination, departureDate, sortBy, 0, 0);
  };

  return (
    <>
      {/* Search-page control overrides. The global `input {width:100%;padding}`
          rule (app/globals.css) otherwise stretches checkboxes and hides native
          range thumbs; these scoped classes fix that without touching shared css. */}
      <style>{`
        .ebx-check {
          appearance: auto; -webkit-appearance: checkbox;
          width: 16px; height: 16px; min-height: 0;
          padding: 0; margin: 0; border: none; background: none; box-shadow: none;
          accent-color: var(--brand); flex: 0 0 auto; cursor: pointer;
        }
        .ebx-sort, .ebx-sort option { color: #1a1a1a; }
        .ebx-range {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 6px; min-height: 0; padding: 0; margin: 11px 0;
          border: none; border-radius: 999px; background: var(--line);
          outline: none; cursor: pointer;
        }
        .ebx-range::-webkit-slider-runnable-track {
          height: 6px; border-radius: 999px; background: var(--line);
        }
        .ebx-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--brand); border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); cursor: pointer;
          /* Center the 18px thumb on the 6px track: (6 - 18) / 2 = -6px. */
          margin-top: -6px;
        }
        .ebx-range::-moz-range-track { height: 6px; border-radius: 999px; background: var(--line); }
        .ebx-range::-moz-range-thumb {
          width: 18px; height: 18px; border-radius: 50%;
          background: var(--brand); border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); cursor: pointer;
        }
      `}</style>

      <TopBar links={[{ href: "/", label: "Trang chính" }, { href: "/my-bookings", label: "Vé của tôi" }, { href: "/lookup", label: "Tra cứu vé" }]} showUserBadge />

      {/* Collapsible Search Row */}
      {showSearchForm ? (
        <form className="panel form animate-fade-in" onSubmit={submit} style={{ marginBottom: "20px" }}>
          <div className="grid">
            <div className="field">
              <label htmlFor="from-input">Điểm đi</label>
              <div className="input-with-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <LocationInput id="from-input" value={origin} onChange={setOrigin} required />
              </div>
            </div>

            <button className="btn-swap" type="button" onClick={handleSwap} style={{ marginTop: "18px" }}>
              ⇄
            </button>

            <div className="field">
              <label htmlFor="to-input">Điểm đến</label>
              <div className="input-with-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <LocationInput id="to-input" value={destination} onChange={setDestination} required />
              </div>
            </div>

            <div className="field">
              <label htmlFor="date-input">Ngày đi</label>
              <div className="input-with-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="input-icon">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <input
                  id="date-input"
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: "16px", justifyContent: "flex-end", gap: "12px" }}>
            <button className="button" type="button" onClick={() => setShowSearchForm(false)}>Hủy</button>
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Đang áp dụng..." : "Cập nhật tìm kiếm"}
            </button>
          </div>
        </form>
      ) : (
        <div className="panel animate-fade-in" style={{ padding: "16px 24px", marginBottom: "20px" }}>
          <div className="row between" style={{ alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div className="breadcrumbs" style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "6px" }}>
                <Link href="/">Trang chủ</Link> &gt; <span style={{ color: "var(--text)", fontWeight: "500" }}>Tìm chuyến</span>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
                {origin} <span style={{ color: "var(--brand)" }}>⇄</span> {destination}
              </h2>
              <span className="muted" style={{ fontSize: "13px", marginTop: "2px", display: "inline-block" }}>
                Ngày đi: {formatFullDate(departureDate)}
              </span>
            </div>
            <button className="button" type="button" onClick={() => setShowSearchForm(true)} style={{ minHeight: "36px" }}>
              Thay đổi tìm kiếm
            </button>
          </div>
        </div>
      )}

      {error ? <section className="panel"><p className="error">{error}</p></section> : null}

      {/* Two Column Layout: Filters + Results */}
      <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start", gap: "24px" }}>

        {/* Left Side: Filter Sidebar */}
        <aside className="panel" style={{ padding: "20px" }}>
          <div className="row between" style={{ alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "800" }}>Bộ lọc</h3>
            {selectedOperators.length > 0 ? (
              <button onClick={clearFilters} style={{ background: "none", border: "none", padding: 0, color: "var(--brand)", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                Xóa lọc
              </button>
            ) : null}
          </div>

          {/* Departure hour range filter (two draggable thumbs: from / to) */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "10px", color: "var(--text)" }}>Giờ khởi hành</h4>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0 8px", fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>
              <span>Từ {String(hourRange[0]).padStart(2, "0")}:00</span>
              <span>Đến {hourRange[1] >= HOUR_MAX ? "23:59" : `${String(hourRange[1]).padStart(2, "0")}:00`}</span>
            </div>
            <input
              type="range"
              min={HOUR_MIN}
              max={HOUR_MAX}
              step={1}
              value={hourRange[0]}
              onChange={(e) => setHourRange(([, hi]) => {
                const lo = Math.min(Number(e.target.value), hi);
                return [lo, hi];
              })}
              aria-label="Giờ khởi hành từ"
              className="ebx-range"
            />
            <input
              type="range"
              min={HOUR_MIN}
              max={HOUR_MAX}
              step={1}
              value={hourRange[1]}
              onChange={(e) => setHourRange(([lo]) => {
                const hi = Math.max(Number(e.target.value), lo);
                return [lo, hi];
              })}
              aria-label="Giờ khởi hành đến"
              className="ebx-range"
            />
          </div>

          {/* Operator Checkboxes */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text)" }}>Nhà xe</h4>
            <div style={{ display: "grid", gap: "10px" }}>
              {operators.length === 0 ? (
                <div style={{ fontSize: "13px", color: "var(--muted)" }}>Không có bộ lọc nhà xe.</div>
              ) : (
                operators.map(op => (
                  <label key={op} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      className="ebx-check"
                      checked={selectedOperators.includes(op)}
                      onChange={() => toggleOperator(op)}
                    />
                    {op}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Loại xe */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text)" }}>Loại xe</h4>
            <div style={{ display: "grid", gap: "10px", fontSize: "14px" }}>
              {vehicleTypes.map((type) => (
                <label key={type} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="checkbox"
                    className="ebx-check"
                    checked={selectedVehicleTypes.includes(type)}
                    onChange={() => setSelectedVehicleTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>

          {/* Số ghế trống tối thiểu */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text)" }}>Ghế trống tối thiểu</h4>
            <input
              type="number"
              min="0"
              value={minSeats || ""}
              placeholder="Ví dụ: 2"
              onChange={(e) => setMinSeats(Number(e.target.value) || 0)}
              style={{ width: "100%" }}
            />
          </div>
        </aside>

        {/* Right Side: Trip List */}
        <section style={{ display: "grid", gap: "16px" }}>

          {/* Header toolbar */}
          <div className="panel" style={{ padding: "12px 20px" }}>
            <div className="row between" style={{ alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text)" }}>
                {filteredTrips.length} chuyến xe phù hợp
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "13px", flexWrap: "wrap" }}>
                <span className="muted">Sắp xếp:</span>
                <select
                  className="ebx-sort"
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); doSearch(origin, destination, departureDate, e.target.value, minPrice, maxPrice); }}
                  style={{ minWidth: "210px", minHeight: "32px", fontSize: "13px", padding: "0 10px", border: "1px solid var(--line)", borderRadius: "4px" }}
                >
                  <option value="earliest">Giờ khởi hành sớm nhất</option>
                  <option value="price-asc">Giá vé tăng dần</option>
                  <option value="price-desc">Giá vé giảm dần</option>
                  <option value="duration">Thời gian di chuyển ngắn nhất</option>
                </select>
                <span className="muted" style={{ marginLeft: "24px" }}>Giá:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice || ""}
                  min="0"
                  step="1000"
                  onChange={(e) => setMinPrice(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  onBlur={() => doSearch(origin, destination, departureDate, sortBy, minPrice, maxPrice)}
                  style={{ width: "130px", minHeight: "30px", fontSize: "13px", padding: "0 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
                />
                <span className="muted">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={maxPrice || ""}
                  min="0"
                  step="1000"
                  onChange={(e) => setMaxPrice(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  onBlur={() => doSearch(origin, destination, departureDate, sortBy, minPrice, maxPrice)}
                  style={{ width: "130px", minHeight: "30px", fontSize: "13px", padding: "0 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
                />
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="panel" style={{ textAlign: "center", padding: "40px" }}>Đang tải danh sách chuyến xe...</div>
          ) : null}

          {/* Empty list notice (suppressed when a validation error is shown) */}
          {!loading && !error && filteredTrips.length === 0 ? (
            <div className="panel notice" style={{ padding: "32px" }}>
              Không tìm thấy chuyến xe phù hợp với bộ lọc hiện tại.
              {result?.suggestedDates?.length ? (
                <div style={{ marginTop: "12px" }}>
                  💡 Gợi ý ngày lân cận còn chuyến:{" "}
                  {result.suggestedDates.map(d => (
                    <button
                      key={d}
                      className="button"
                      onClick={() => { setDepartureDate(d); doSearch(origin, destination, d, sortBy, minPrice, maxPrice); }}
                      style={{ padding: "4px 8px", minHeight: "26px", fontSize: "12px", marginLeft: "6px" }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Trip Cards list */}
          {!loading && filteredTrips.map((trip) => (
            <article
              className="panel"
              key={trip.id}
              style={{
                padding: "24px",
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                alignItems: "center",
                gap: "24px",
                transition: "transform 0.15s ease",
                border: "1px solid var(--line)"
              }}
            >
              {/* Departure, duration, arrival details */}
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", alignItems: "center", gap: "10px" }}>
                <div>
                  <strong style={{ fontSize: "20px", color: "var(--text)" }}>
                    {formatTimeOnly(trip.departureTime)}
                  </strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>Bến xe đi</div>
                </div>

                {/* Visual line showing duration */}
                <div style={{ textAlign: "center", position: "relative" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                    {Math.floor(trip.durationMinutes / 60)}h {trip.durationMinutes % 60}m
                  </span>
                  <div style={{ height: "2px", background: "var(--line)", position: "relative" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand)", position: "absolute", left: 0, top: "-2px" }} />
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--brand)", position: "absolute", right: 0, top: "-2px" }} />
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <strong style={{ fontSize: "20px", color: "var(--text)" }}>
                    {formatTimeOnly(trip.arrivalTime)}
                  </strong>
                  <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>Bến xe đến</div>
                </div>
              </div>

              {/* Operator and vehicle info */}
              <div style={{ paddingLeft: "16px", borderLeft: "1px solid var(--line)" }}>
                <strong style={{ color: "var(--brand)", fontSize: "16px" }}>{trip.operatorName}</strong>
                <p className="muted" style={{ fontSize: "13px", marginTop: "2px" }}>{trip.vehicleType}</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "8px", background: "var(--brand-soft)", color: "var(--brand)", padding: "2px 8px", borderRadius: "4px", fontSize: "12px", fontWeight: "600" }}>
                  🟢 {trip.availableSeats} ghế trống
                </div>
              </div>

              {/* Price and select action */}
              <div style={{ textAlign: "right", display: "grid", gap: "10px", justifyItems: "end" }}>
                <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--brand-dark)" }}>
                  {trip.price.toLocaleString("vi-VN")}đ
                </span>
                <Link
                  className="button primary"
                  href={`/trips/${trip.id}`}
                  style={{ minWidth: "120px", minHeight: "38px" }}
                >
                  Chọn ghế
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
