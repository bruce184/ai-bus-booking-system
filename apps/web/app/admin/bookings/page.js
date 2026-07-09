'use client';

import { useState, useEffect } from 'react';
import { queryGraphQL } from '../../graphql.js';

const formatTripOption = (trip) => {
  const origin = trip.route?.origin?.name || 'Unknown origin';
  const destination = trip.route?.destination?.name || 'Unknown destination';
  const departure = trip.departureTime
    ? new Date(trip.departureTime).toLocaleString('vi-VN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'No departure';

  return `${origin} -> ${destination} (${departure})`;
};

export default function BookingsCrud() {
  const [bookings, setBookings] = useState([]);
  const [trips, setTrips] = useState([]);

  const [filterCode, setFilterCode] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterTripId, setFilterTripId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [checkInCode, setCheckInCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredBookings = bookings.filter((booking) => {
    if (filterCode && !booking.bookingCode.toLowerCase().includes(filterCode.toLowerCase())) return false;
    if (filterEmail && !booking.contactEmail.toLowerCase().includes(filterEmail.toLowerCase())) return false;
    if (filterTripId && booking.trip?.id !== filterTripId) return false;
    if (filterStatus && booking.status !== filterStatus) return false;
    return true;
  });

  const loadTrips = async () => {
    const tripsQuery = `
      query AdminBookingTrips {
        adminTrips {
          id
          route {
            origin { name }
            destination { name }
          }
          departureTime
        }
      }
    `;

    try {
      const data = await queryGraphQL(tripsQuery);
      setTrips(data.adminTrips || []);
    } catch (err) {
      setTrips([]);
      showToast(err.message || 'Failed to load trips.', 'error');
    }
  };

  const queryBookings = async () => {
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

      const items = data.adminBookings.items || [];
      setBookings(items);
      if (items.length === 0) {
        showToast('No bookings found for the current filters.', 'info');
      }
    } catch (err) {
      setBookings([]);
      showToast(err.message || 'Failed to query bookings.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadTrips();
      void queryBookings();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const data = await queryGraphQL(checkInMutation, {
        input: { code: codeValue }
      });

      const checkedBooking = data.adminCheckIn;
      setBookings((currentBookings) => currentBookings.map((booking) => {
        if (booking.id === checkedBooking.id || booking.bookingCode === checkedBooking.bookingCode) {
          return { ...booking, status: checkedBooking.status };
        }
        return booking;
      }));

      showToast(`Checked in code ${codeValue} successfully!`);
      setCheckInCode('');
    } catch (err) {
      showToast(err.message || 'Check-in failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'CHECKED_IN': return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--secondary)' };
      case 'PAID': return { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--info)' };
      case 'TICKET_ISSUED': return { bg: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' };
      case 'CANCELLED': return { bg: 'rgba(239, 68, 68, 0.12)', color: 'var(--danger)' };
      default: return { bg: 'rgba(255, 255, 255, 0.08)', color: 'white' };
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {message && (
        <div className="toast-container">
          <div className={`toast ${message.type}`}>
            <span>{message.type === 'success' ? 'OK' : 'ERR'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Bookings & Check-in</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Review ticket bookings, search logs, and process boarding check-ins.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
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
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>{formatTripOption(trip)}</option>
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
              <button onClick={queryBookings} className="btn btn-secondary" style={{ height: '40px' }} disabled={loading}>
                Search DB
              </button>
            </div>
          </div>

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
                  {filteredBookings.map((booking) => {
                    const statusColor = getStatusColor(booking.status);
                    const origin = booking.trip?.route?.origin?.name || 'Unknown';
                    const destination = booking.trip?.route?.destination?.name || 'Unknown';
                    const passengers = booking.passengers || [];

                    return (
                      <tr key={booking.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }}>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ fontWeight: '700' }}>{booking.bookingCode}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{booking.contactEmail}</div>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ fontWeight: '500' }}>{origin} -&gt; {destination}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{formatDateTime(booking.trip?.departureTime)}</div>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          {passengers.map((passenger, index) => (
                            <div key={`${booking.id}-${passenger.seatId}-${index}`} style={{ fontSize: '13px' }}>
                              {passenger.fullName} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>({passenger.seatId})</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: '16px 8px', fontWeight: '600' }}>{formatCurrency(booking.totalAmount)}</td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: statusColor.bg,
                            color: statusColor.color
                          }}>
                            {booking.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                          {booking.status !== 'CHECKED_IN' && booking.status !== 'CANCELLED' ? (
                            <button
                              onClick={() => handleCheckIn(booking.bookingCode)}
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
            fontSize: '18px',
            opacity: 0.8
          }}>
            QR Scan stub
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
        </div>
      </div>
    </div>
  );
}
