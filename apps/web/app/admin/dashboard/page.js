'use client';

import { useState, useEffect } from 'react';
import { queryGraphQL } from '../../graphql.js';

export default function AdminDashboard() {
  const [fromDate, setFromDate] = useState('2026-06-18');
  const [toDate, setToDate] = useState('2026-06-24');

  // No fake starting numbers: null/empty means "not loaded yet", not "zero
  // revenue". A failed fetch must never be indistinguishable from real data.
  const [summary, setSummary] = useState(null);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [routeSales, setRouteSales] = useState([]);
  const [popularRoutes, setPopularRoutes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleFetchAnalytics = async () => {
    setLoading(true);
    const dashboardQuery = `
      query AdminAnalyticsDashboard($input: AdminRevenueSummaryInput!) {
        adminAnalyticsDashboard(input: $input) {
          revenueSummary {
            totalRevenue
            paidBookings
            ticketsSold
            successfulBookingRate
          }
          dailyRevenue {
            date
            revenue
            paidBookings
            ticketsSold
          }
          ticketsByRoute {
            origin
            destination
            ticketsSold
            revenue
          }
          popularRoutes {
            origin
            destination
            searchCount
          }
        }
      }
    `;

    try {
      const data = await queryGraphQL(dashboardQuery, {
        input: { from: fromDate, to: toDate }
      });

      const dashboard = data.adminAnalyticsDashboard;
      if (dashboard) {
        setSummary(dashboard.revenueSummary);

        // Map dates from YYYY-MM-DD to DD/MM for SVG chart readability
        const formattedDaily = dashboard.dailyRevenue.map(d => {
          const parts = d.date.split('-');
          return {
            ...d,
            date: parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date
          };
        });
        setDailyRevenue(formattedDaily);
        setRouteSales(dashboard.ticketsByRoute);
        setPopularRoutes(dashboard.popularRoutes);
        setLoadError(null);
        showToast('Analytics refreshed successfully!');
      }
    } catch (err) {
      // Map the technical failure to a plain-language notice and keep
      // whatever was last successfully loaded (nothing, on first load)
      // instead of quietly swapping in placeholder numbers.
      setLoadError('Không thể tải dữ liệu thống kê từ Analytics Service. Số liệu bên dưới có thể chưa cập nhật.');
      showToast('Không thể tải dữ liệu thống kê. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    setTimeout(() => {
      handleFetchAnalytics();
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Find max daily revenue for chart scaling
  const maxRevenue = Math.max(1, ...dailyRevenue.map(d => d.revenue));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Toast Alert */}
      {message && (
        <div className="toast-container">
          <div className={`toast ${message.type}`}>
            <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Operations & Revenue</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Live sales statistics, search conversion aggregates, and travel route yields.</p>
        </div>

        {/* Date Filter Widget */}
        <div className="glass-card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', width: '140px', background: 'rgba(0,0,0,0.2)' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', width: '140px', background: 'rgba(0,0,0,0.2)' }}
            />
          </div>
          <button onClick={handleFetchAnalytics} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }} disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Update'}
          </button>
        </div>
      </div>

      {loadError ? (
        <div
          className="glass-card"
          style={{ padding: '16px 20px', borderLeft: '4px solid var(--danger)', color: 'var(--color-text-primary)' }}
        >
          {loadError}
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        {/* Total Revenue */}
        <div className="glass-card" style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
          }} />
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Total Revenue</span>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '10px', color: 'var(--secondary)' }}>
            {summary ? formatCurrency(summary.totalRevenue) : '—'}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Gross sales in selected range</p>
        </div>

        {/* Tickets Sold */}
        <div className="glass-card" style={{ padding: '25px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Tickets Sold</span>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '10px' }}>{summary ? summary.ticketsSold : '—'} <span style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>tickets</span></h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Issued passenger boarding passes</p>
        </div>

        {/* Bookings */}
        <div className="glass-card" style={{ padding: '25px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Paid Bookings</span>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '10px' }}>{summary ? summary.paidBookings : '—'} <span style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>orders</span></h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Completed payment checkout logs</p>
        </div>

        {/* Search Conversion */}
        <div className="glass-card" style={{ padding: '25px' }}>
          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase' }}>Conversion Rate</span>
          <h2 style={{ fontSize: '28px', fontWeight: '700', marginTop: '10px', color: 'var(--info)' }}>{summary ? `${summary.successfulBookingRate}%` : '—'}</h2>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px' }}>Search-to-paid checkout ratio</p>
        </div>
      </div>

      {/* SVG Bar Chart Card */}
      <div className="glass-card" style={{ padding: '30px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '25px', fontWeight: '600' }}>Daily Revenue History</h3>

        {dailyRevenue.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            {loadError ? 'Dữ liệu doanh thu chưa tải được.' : 'Chưa có dữ liệu cho khoảng thời gian này.'}
          </p>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ position: 'relative', height: '240px', width: '100%', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '20px 20px 40px 20px' }}>
            <svg style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Grids and Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                const yPos = 180 * (1 - ratio);
                const value = Math.round((maxRevenue * ratio) / 1000) * 1000;
                return (
                  <g key={index}>
                    <line x1="40" y1={yPos} x2="100%" y2={yPos} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                    <text x="0" y={yPos + 4} fill="var(--color-text-muted)" fontSize="10" textAnchor="start">
                      {value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value > 0 ? `${value / 1000}k` : '0'}
                    </text>
                  </g>
                );
              })}

              {/* Render Bars */}
              {dailyRevenue.map((d, index) => {
                const barWidth = 35;
                const gap = (100 / dailyRevenue.length);
                const xPos = `calc(${index * gap}% + 45px)`;
                const barHeight = maxRevenue > 0 ? (d.revenue / maxRevenue) * 180 : 0;
                const barY = 180 - barHeight;

                return (
                  <g key={index}>
                    {/* Bar rectangle with hover animation */}
                    <rect
                      x={50 + index * ((750) / dailyRevenue.length)}
                      y={barY}
                      width={barWidth}
                      height={Math.max(2, barHeight)}
                      fill={d.revenue > 0 ? 'url(#barGradient)' : 'rgba(255,255,255,0.06)'}
                      rx="4"
                      style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                    />

                    {/* Tooltip revenue on top */}
                    {d.revenue > 0 && (
                      <text
                        x={50 + index * ((750) / dailyRevenue.length) + barWidth / 2}
                        y={barY - 8}
                        fill="white"
                        fontSize="9"
                        fontWeight="700"
                        textAnchor="middle"
                      >
                        {d.revenue / 1000}k
                      </text>
                    )}

                    {/* Date label at bottom */}
                    <text
                      x={50 + index * ((750) / dailyRevenue.length) + barWidth / 2}
                      y="198"
                      fill="var(--color-text-secondary)"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {d.date}
                    </text>
                  </g>
                );
              })}

              {/* Define gradients */}
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--secondary)" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
        )}
      </div>

      {/* Routes breakdown & popular searches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '30px' }}>
        {/* Route Sales */}
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Route Sales Performance</h3>

          {routeSales.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              {loadError ? 'Dữ liệu tuyến xe chưa tải được.' : 'Chưa có dữ liệu.'}
            </p>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <th style={{ padding: '10px 8px' }}>Route</th>
                <th style={{ padding: '10px 8px' }}>Tickets</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {routeSales.map((r, index) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '600' }}>
                    {r.origin} ➔ {r.destination}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{r.ticketsSold} ticket(s)</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '700', color: 'var(--secondary)' }}>
                    {formatCurrency(r.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        {/* Popular searches */}
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Popular Route Searches</h3>

          {popularRoutes.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              {loadError ? 'Dữ liệu tìm kiếm chưa tải được.' : 'Chưa có dữ liệu.'}
            </p>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <th style={{ padding: '10px 8px' }}>Route</th>
                <th style={{ padding: '10px 8px', textAlign: 'right' }}>Search Volume</th>
              </tr>
            </thead>
            <tbody>
              {popularRoutes.slice().sort((a,b) => b.searchCount - a.searchCount).map((r, index) => (
                <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>
                    {r.origin} ➔ {r.destination}
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: 'rgba(59, 130, 246, 0.12)',
                      color: 'var(--info)',
                      fontSize: '12px',
                      fontWeight: '700'
                    }}>
                      🔥 {r.searchCount} queries
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
}
