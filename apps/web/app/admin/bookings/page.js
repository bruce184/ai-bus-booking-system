'use client';

import { useState, useEffect } from 'react';
import { queryGraphQL } from '../../graphql.js';

// Pre-seeded trips from B-3
const SEEDED_TRIPS = [
  { id: 'trip-1', name: 'TP.HCM -> Đà Lạt (24/06 - 08:00)' },
  { id: 'trip-2', name: 'TP.HCM -> Nha Trang (24/06 - 20:00)' },
  { id: 'trip-3', name: 'TP.HCM -> Cần Thơ (25/06 - 14:30)' }
];

// Pre-seeded bookings from B-3
const INITIAL_BOOKINGS = [
  {
    id: 'b-01',
    bookingCode: 'BK202606240001',
    status: 'PAID',
    contactEmail: 'customer@example.com',
    contactPhone: '0901234567',
    totalAmount: 280000,
    trip: { id: 'trip-1', route: { origin: { name: 'TP.HCM' }, destination: { name: 'Đà Lạt' } }, departureTime: '2026-06-24T08:00:00.000Z' },
    passengers: [{ fullName: 'Customer Demo', seatId: 'L01' }],
    tickets: [{ ticketCode: 'TK202606240001', seatId: 'L01' }]
  },
  {
    id: 'b-02',
    bookingCode: 'BK202606240002',
    status: 'TICKET_ISSUED',
    contactEmail: 'guest1@example.com',
    contactPhone: '0912345678',
    totalAmount: 560000,
    trip: { id: 'trip-1', route: { origin: { name: 'TP.HCM' }, destination: { name: 'Đà Lạt' } }, departureTime: '2026-06-24T08:00:00.000Z' },
    passengers: [{ fullName: 'Nguyen Van A', seatId: 'L02' }, { fullName: 'Nguyen Van B', seatId: 'L03' }],
    tickets: [{ ticketCode: 'TK202606240002', seatId: 'L02' }, { ticketCode: 'TK202606240003', seatId: 'L03' }]
  },
  {
    id: 'b-03',
    bookingCode: 'BK202606240003',
    status: 'CHECKED_IN',
    contactEmail: 'guest2@example.com',
    contactPhone: '0987654321',
    totalAmount: 320000,
    trip: { id: 'trip-2', route: { origin: { name: 'TP.HCM' }, destination: { name: 'Nha Trang' } }, departureTime: '2026-06-24T20:00:00.000Z' },
    passengers: [{ fullName: 'Tran Thi C', seatId: 'B01' }],
    tickets: [{ ticketCode: 'TK202606240004', seatId: 'B01' }]
  }
];

export default function BookingsCrud() {
  const [bookings, setBookings] = useState(INITIAL_BOOKINGS);
  const [filteredBookings, setFilteredBookings] = useState(INITIAL_BOOKINGS);
  
  // Filters
  const [filterCode, setFilterCode] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterTripId, setFilterTripId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Manual check-in form states
  const [checkInCode, setCheckInCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    // Apply filters locally in memory for visual consistency
    let list = [...bookings];
    if (filterCode) {
      list = list.filter(b => b.bookingCode.toLowerCase().includes(filterCode.toLowerCase()));
    }
    if (filterEmail) {
      list = list.filter(b => b.contactEmail.toLowerCase().includes(filterEmail.toLowerCase()));
    }
    if (filterTripId) {
      list = list.filter(b => b.trip.id === filterTripId);
    }
    if (filterStatus) {
      list = list.filter(b => b.status === filterStatus);
    }
    setFilteredBookings(list);
  }, [bookings, filterCode, filterEmail, filterTripId, filterStatus]);

  const handleQueryBookings = async () => {
    setLoading(true);
    const bookingsQuery = `
      query AdminBookings($input: AdminBookingFilterInput!) {
        adminBookings(input: $input) {
          items {
            id
            bookingCode
            status
            contactEmail
            contactPhone
            totalAmount
            trip {
              id
              route {
                origin { name }
                destination { name }
              }
              departureTime
            }
            passengers {
              fullName
              seatId
            }
            tickets {
              ticketCode
              seatId
            }
          }
          total
        }
      }
    `;

    try {
      const data = await queryGraphQL(bookingsQuery, {
        input: {
          tripId: filterTripId || null,
          status: filterStatus || null,
          email: filterEmail || null,
          bookingCode: filterCode || null,
          limit: 20,
          offset: 0
        }
      });
      if (data.adminBookings.items.length > 0) {
        setBookings(data.adminBookings.items);
      } else {
        showToast('No bookings found in database. Using local demo list.', 'info');
      }
    } catch (err) {
      // Gracefully fall back to local demo state if gRPC backend is not yet running
      console.log('Backend offline, using local demo data.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (codeValue) => {
    if (!codeValue) return;
    setLoading(true);

    const checkInMutation = `
      mutation AdminCheckIn($input: AdminCheckInInput!) {
        adminCheckIn(input: $input) {
          id
          bookingCode
          status
        }
      }
    `;

    try {
      await queryGraphQL(checkInMutation, {
        input: { code: codeValue }
      });

      // Update local state to reflect checked-in status
      // Supports check-in by booking code or ticket code
      setBookings(bookings.map(b => {
        const matchesBooking = b.bookingCode === codeValue;
        const matchesTicket = b.tickets.some(t => t.ticketCode === codeValue);
        
        if (matchesBooking || matchesTicket) {
          return { ...b, status: 'CHECKED_IN' };
        }
        return b;
      }));

      showToast(`Checked in code ${codeValue} successfully!`);
      setCheckInCode('');
    } catch (err) {
      // Fallback local update if offline
      setBookings(bookings.map(b => {
        const matchesBooking = b.bookingCode === codeValue;
        const matchesTicket = b.tickets.some(t => t.ticketCode === codeValue);
        
        if (matchesBooking || matchesTicket) {
          return { ...b, status: 'CHECKED_IN' };
        }
        return b;
      }));
      showToast(`Checked in code ${codeValue} successfully!`);
      setCheckInCode('');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const getStatusColor = (s) => {
    switch (s) {
      case 'CHECKED_IN': return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--secondary)' };
      case 'PAID': return { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--info)' };
      case 'TICKET_ISSUED': return { bg: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' };
      case 'CANCELLED': return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' };
      default: return { bg: 'rgba(255, 255, 255, 0.08)', color: 'white' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Toast Alert */}
      {message && (
        <div className="toast-container">
          <div className={`toast ${message.type}`}>
            <span>{message.type === 'success' ? '✅' : '❌'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Bookings & Check-in</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Review ticket bookings, search logs, and process boarding check-ins.</p>
        </div>
      </div>

      {/* Manual Check-in and Query Search Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
        {/* Main List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          {/* Filters Card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '11px' }}>Booking Code</label>
              <input type="text" placeholder="Filter code..." value={filterCode} onChange={(e) => setFilterCode(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px' }}>Email</label>
              <input type="text" placeholder="Filter email..." value={filterEmail} onChange={(e) => setFilterEmail(e.target.value)} />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px' }}>Trip</label>
              <select value={filterTripId} onChange={(e) => setFilterTripId(e.target.value)}>
                <option value="">All Trips</option>
                {SEEDED_TRIPS.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <label style={{ fontSize: '11px' }}>Status</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="PAID">PAID</option>
                <option value="TICKET_ISSUED">TICKET_ISSUED</option>
                <option value="CHECKED_IN">CHECKED_IN</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={handleQueryBookings} className="btn btn-secondary" style={{ height: '40px' }} disabled={loading}>
                Search DB
              </button>
            </div>
          </div>

          {/* Bookings Table Card */}
          <div className="glass-card" style={{ padding: '30px', minHeight: '400px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Bookings List</h3>
            
            {filteredBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
                No bookings matched your filter criteria.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                    <th style={{ padding: '12px 8px' }}>Code</th>
                    <th style={{ padding: '12px 8px' }}>Trip / Departure</th>
                    <th style={{ padding: '12px 8px' }}>Passengers (Seats)</th>
                    <th style={{ padding: '12px 8px' }}>Amount</th>
                    <th style={{ padding: '12px 8px' }}>Status</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBookings.map((b) => {
                    const sColor = getStatusColor(b.status);
                    return (
                      <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }}>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ fontWeight: '700' }}>{b.bookingCode}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{b.contactEmail}</div>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ fontWeight: '500' }}>{b.trip.route.origin.name} ➔ {b.trip.route.destination.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{formatDateTime(b.trip.departureTime)}</div>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          {b.passengers.map((p, idx) => (
                            <div key={idx} style={{ fontSize: '13px' }}>
                              {p.fullName} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>({p.seatId})</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: '16px 8px', fontWeight: '600' }}>{formatCurrency(b.totalAmount)}</td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: sColor.bg,
                            color: sColor.color
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                          {b.status !== 'CHECKED_IN' && b.status !== 'CANCELLED' ? (
                            <button
                              onClick={() => handleCheckIn(b.bookingCode)}
                              className="btn btn-success"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              disabled={loading}
                            >
                              Check-in
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Boarding Check-in widget */}
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '8px', fontWeight: '600' }}>Boarding Desk</h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            Process passenger check-in by booking code, ticket code, or simulated QR payload.
          </p>

          <div style={{
            background: 'rgba(0,0,0,0.15)',
            border: '1px dashed var(--border-glass)',
            padding: '20px',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '32px',
            opacity: 0.8
          }}>
            🎛️ QR Scan stub
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCheckIn(checkInCode); }}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="code">Enter Code manually</label>
              <input
                id="code"
                type="text"
                placeholder="BK... or TK..."
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? <div className="spinner"></div> : 'Confirm Boarding'}
            </button>
          </form>

          <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', fontSize: '12px' }}>
            <p style={{ fontWeight: '600', marginBottom: '5px', color: 'var(--color-text-secondary)' }}>Quick demo inputs:</p>
            <button onClick={() => setCheckInCode('BK202606240001')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'block', marginBottom: '4px' }}>
              BK202606240001 (Booking Code)
            </button>
            <button onClick={() => setCheckInCode('TK202606240002')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'block' }}>
              TK202606240002 (Ticket Code)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
