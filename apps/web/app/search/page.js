"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
      cacheHit
    }
  }
`;

function defaultSearchDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

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

export default function SearchPage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("TP.HCM");
  const [destination, setDestination] = useState("Da Lat");
  const [departureDate, setDepartureDate] = useState(defaultSearchDate);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const initialSearchStarted = useRef(false);
  const latestSearchRequest = useRef(0);

  // Filter & sort states (client-side + server-side)
  const [selectedOperators, setSelectedOperators] = useState([]);
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

  const performSearch = useCallback(async (originVal = origin, destinationVal = destination, dateVal = departureDate, sortVal = sortBy, minPVal = minPrice, maxPVal = maxPrice) => {
    await doSearch(originVal, destinationVal, dateVal, sortVal, minPVal, maxPVal);
  }, [doSearch, origin, destination, departureDate, sortBy, minPrice, maxPrice]);

  async function submit(event) {
    event.preventDefault();
    setShowSearchForm(false);
    router.replace(`/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}&date=${departureDate}`);
    await performSearch();
  }

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  useEffect(() => {
    if (initialSearchStarted.current) {
      return undefined;
    }
    initialSearchStarted.current = true;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const nextOrigin = params.get("from") || origin;
      const nextDestination = params.get("to") || destination;
      const nextDate = params.get("date") || departureDate;

      setOrigin(nextOrigin);
      setDestination(nextDestination);
      setDepartureDate(nextDate);
      void doSearch(nextOrigin, nextDestination, nextDate, "earliest", 0, 0);
    }, 0);

    return () => clearTimeout(timer);
  }, [departureDate, destination, doSearch, origin]);

  // Compute list of unique operators in the result for filter checkboxes
  const operators = useMemo(() => {
    if (!result?.trips) return [];
    const set = new Set(result.trips.map(t => t.operatorName));
    return Array.from(set);
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

    return list;
  }, [result, selectedOperators, minPrice, maxPrice]);

  const toggleOperator = (op) => {
    setSelectedOperators(prev => 
      prev.includes(op) ? prev.filter(item => item !== op) : [...prev, op]
    );
  };

  const clearFilters = () => {
    setSelectedOperators([]);
    setMinPrice(0);
    setMaxPrice(0);
    void doSearch(origin, destination, departureDate, sortBy, 0, 0);
  };

  return (
    <>
      <header className="topbar">
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ display: 'block' }}>
              <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L7.33,18C12,18 16.6,15.25 18.66,13.25C22.66,9.25 22,2 22,2C22,2 14.75,1.34 10.75,5.34C9,7.09 6.25,12 6.25,12C8.75,9 13.5,8 17,8Z" />
            </svg>
          </div>
          <span className="logo-text">EcoBus AI</span>
        </div>
        <nav className="nav">
          <Link href="/">Trang chính</Link>
          <Link href="/my-bookings">Vé của tôi</Link>
          <Link href="/lookup">Tra cứu vé</Link>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            backgroundColor: "var(--surface-soft)",
            border: "1px solid var(--line)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--muted)",
            marginLeft: "8px"
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
        </nav>
      </header>

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
                <select 
                  id="from-input"
                  value={origin} 
                  onChange={(e) => setOrigin(e.target.value)} 
                  required
                >
                  <option value="TP.HCM">TP.HCM</option>
                  <option value="Da Lat">Đà Lạt</option>
                  <option value="Nha Trang">Nha Trang</option>
                  <option value="Can Tho">Cần Thơ</option>
                  <option value="Phan Thiet">Phan Thiết</option>
                  <option value="Vung Tau">Vũng Tàu</option>
                </select>
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
                <select 
                  id="to-input"
                  value={destination} 
                  onChange={(e) => setDestination(e.target.value)} 
                  required
                >
                  <option value="Da Lat">Đà Lạt</option>
                  <option value="TP.HCM">TP.HCM</option>
                  <option value="Nha Trang">Nha Trang</option>
                  <option value="Can Tho">Cần Thơ</option>
                  <option value="Phan Thiet">Phan Thiết</option>
                  <option value="Vung Tau">Vũng Tàu</option>
                </select>
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

          {/* Departure Hours Filter Mock */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "10px", color: "var(--text)" }}>Giờ khởi hành</h4>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>Khoảng thời gian:</div>
            <div style={{ display: "flex", justifyContent: "space-between", margin: "6px 0 10px", fontSize: "12px", fontWeight: "600" }}>
              <span>00:00</span>
              <span>23:59</span>
            </div>
            <div style={{ height: "4px", background: "var(--brand)", borderRadius: "2px", position: "relative" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "white", border: "2px solid var(--brand)", position: "absolute", left: 0, top: "-4px" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "white", border: "2px solid var(--brand)", position: "absolute", right: 0, top: "-4px" }} />
            </div>
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
                      checked={selectedOperators.includes(op)} 
                      onChange={() => toggleOperator(op)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--brand)" }} 
                    />
                    {op}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Price Range Filter Mock */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text)" }}>Khoảng giá</h4>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "8px", fontWeight: "600" }}>
              <span>0đ</span>
              <span>500.000đ</span>
            </div>
            <div style={{ height: "4px", background: "var(--line)", borderRadius: "2px" }}>
              <div style={{ width: "70%", height: "100%", background: "var(--brand)", position: "relative" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "white", border: "2px solid var(--brand)", position: "absolute", right: 0, top: "-4px" }} />
              </div>
            </div>
          </div>

          {/* Utilities Filter Mock */}
          <div>
            <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "12px", color: "var(--text)" }}>Tiện ích</h4>
            <div style={{ display: "grid", gap: "10px", fontSize: "14px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--brand)" }} /> Wifi
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "var(--brand)" }} /> Nước uống
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" style={{ accentColor: "var(--brand)" }} /> Ổ cắm điện
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input type="checkbox" style={{ accentColor: "var(--brand)" }} /> Điều hòa
              </label>
            </div>
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", flexWrap: "wrap" }}>
                <span className="muted">Sắp xếp:</span>
                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); doSearch(origin, destination, departureDate, e.target.value, minPrice, maxPrice); }}
                  style={{ minHeight: "30px", fontSize: "13px", padding: "0 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
                >
                  <option value="earliest">Giờ khởi hành sớm nhất</option>
                  <option value="price-asc">Giá vé tăng dần</option>
                  <option value="price-desc">Giá vé giảm dần</option>
                </select>
                <span className="muted" style={{ marginLeft: "12px" }}>Giá:</span>
                <input
                  type="number"
                  placeholder="Min"
                  value={minPrice || ""}
                  min="0"
                  step="1000"
                  onChange={(e) => setMinPrice(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  onBlur={() => doSearch(origin, destination, departureDate, sortBy, minPrice, maxPrice)}
                  style={{ width: "70px", minHeight: "30px", fontSize: "13px", padding: "0 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
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
                  style={{ width: "70px", minHeight: "30px", fontSize: "13px", padding: "0 8px", border: "1px solid var(--line)", borderRadius: "4px" }}
                />
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="panel" style={{ textAlign: "center", padding: "40px" }}>Đang tải danh sách chuyến xe...</div>
          ) : null}

          {/* Empty list notice */}
          {!loading && filteredTrips.length === 0 ? (
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
