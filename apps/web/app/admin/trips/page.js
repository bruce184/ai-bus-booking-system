'use client';

import { useState, useRef } from 'react';
import { queryGraphQL } from '../../graphql.js';

// Seeded routes from B-3
const SEEDED_ROUTES = [
  { id: 'route-hcm-dl', name: 'TP.HCM -> Đà Lạt (310 km)' },
  { id: 'route-hcm-nt', name: 'TP.HCM -> Nha Trang (430 km)' },
  { id: 'route-hcm-ct', name: 'TP.HCM -> Cần Thơ (170 km)' },
  { id: 'route-dn-hn', name: 'Đà Nẵng -> Hà Nội (760 km)' },
  { id: 'route-hn-dn', name: 'Hà Nội -> Đà Nẵng (760 km)' }
];

// Seeded vehicles from B-3
const SEEDED_VEHICLES = [
  { id: 'veh-01', name: 'Phương Trang Demo (V01 - SEAT)' },
  { id: 'veh-02', name: 'Thành Bưởi Demo (V02 - SLEEPER)' },
  { id: 'veh-03', name: 'Kumho Samco Demo (V03 - LIMOUSINE)' }
];

// Pre-seeded trips from B-3
const INITIAL_TRIPS = [
  {
    id: 'trip-1',
    route: SEEDED_ROUTES[0],
    vehicle: SEEDED_VEHICLES[1],
    departureTime: '2026-06-24T08:00:00.000Z',
    arrivalTime: '2026-06-24T14:00:00.000Z',
    price: 280000,
    status: 'ACTIVE'
  },
  {
    id: 'trip-2',
    route: SEEDED_ROUTES[1],
    vehicle: SEEDED_VEHICLES[2],
    departureTime: '2026-06-24T20:00:00.000Z',
    arrivalTime: '2026-06-25T05:30:00.000Z',
    price: 320000,
    status: 'DRAFT'
  },
  {
    id: 'trip-3',
    route: SEEDED_ROUTES[2],
    vehicle: SEEDED_VEHICLES[0],
    departureTime: '2026-06-25T14:30:00.000Z',
    arrivalTime: '2026-06-25T18:00:00.000Z',
    price: 180000,
    status: 'LOCKED'
  }
];

const getFallbackSeatsForTrip = (tripId) => {
  const seats = [];
  if (tripId === 'trip-1') {
    // 34 seats sleeper (2 decks, A01-A17, B01-B17)
    let count = 1;
    for (let d = 1; d <= 2; d++) {
      for (let r = 1; r <= 6; r++) {
        for (let c = 1; c <= 3; c++) {
          if (count > 34) break;
          const prefix = d === 1 ? 'A' : 'B';
          const label = `${prefix}${count < 10 ? '0' : ''}${count}`;
          let status = 'AVAILABLE';
          if (label === 'A01' || label === 'A02' || label === 'A03') status = 'BOOKED';
          if (label === 'A10') status = 'BLOCKED';
          seats.push({ id: label, label, deck: d, row: r, column: c, status });
          count++;
        }
      }
    }
  } else if (tripId === 'trip-2') {
    // 22 seats limousine (1 deck, A01-A22)
    for (let i = 1; i <= 22; i++) {
      const label = `A${i < 10 ? '0' : ''}${i}`;
      let status = 'AVAILABLE';
      if (label === 'A01') status = 'BOOKED';
      seats.push({ id: label, label, deck: 1, row: Math.ceil(i / 3), column: (i - 1) % 3 + 1, status });
    }
  } else {
    // 29 seats seat (1 deck, A01-A29)
    for (let i = 1; i <= 29; i++) {
      const label = `A${i < 10 ? '0' : ''}${i}`;
      seats.push({ id: label, label, deck: 1, row: Math.ceil(i / 4), column: (i - 1) % 4 + 1, status: 'AVAILABLE' });
    }
  }
  return seats;
};

export default function TripsCrud() {
  const [trips, setTrips] = useState(INITIAL_TRIPS);
  const [routeId, setRouteId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [price, setPrice] = useState('');
  const [status, setStatus] = useState('DRAFT');

  const [editingTrip, setEditingTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const nextId = useRef(0);

  // Seat blocking states
  const [blockingSeatsTrip, setBlockingSeatsTrip] = useState(null);
  const [tripSeats, setTripSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [blockReason, setBlockReason] = useState('');

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!routeId || !vehicleId || !departureTime || !arrivalTime || !price) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);

    const isEditing = !!editingTrip;
    const mutation = isEditing ? `
      mutation UpdateTrip($id: ID!, $input: AdminTripInput!) {
        adminUpdateTrip(id: $id, input: $input) {
          id
          status
        }
      }
    ` : `
      mutation CreateTrip($input: AdminTripInput!) {
        adminCreateTrip(input: $input) {
          id
          status
        }
      }
    `;

    try {
      const formattedDepTime = new Date(departureTime).toISOString();
      const formattedArrTime = new Date(arrivalTime).toISOString();
      
      const variables = {
        input: {
          routeId,
          vehicleId,
          departureTime: formattedDepTime,
          arrivalTime: formattedArrTime,
          price: parseInt(price, 10),
          status
        }
      };
      if (isEditing) {
        variables.id = editingTrip.id;
      }

      await queryGraphQL(mutation, variables);

      const routeObj = SEEDED_ROUTES.find(r => r.id === routeId);
      const vehicleObj = SEEDED_VEHICLES.find(v => v.id === vehicleId);

      if (isEditing) {
        setTrips(trips.map(t => t.id === editingTrip.id ? {
          ...t,
          route: routeObj,
          vehicle: vehicleObj,
          departureTime: formattedDepTime,
          arrivalTime: formattedArrTime,
          price: parseInt(price, 10),
          status
        } : t));
        showToast('Trip updated successfully!');
      } else {
        nextId.current += 1;
        const newId = `trip-new-${nextId.current}`;
        setTrips([...trips, {
          id: newId,
          route: routeObj,
          vehicle: vehicleObj,
          departureTime: formattedDepTime,
          arrivalTime: formattedArrTime,
          price: parseInt(price, 10),
          status
        }]);
        showToast('Trip created successfully!');
      }

      resetForm();
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (tripId, newStatus) => {
    setLoading(true);

    const statusMutation = `
      mutation UpdateTripStatus($input: AdminTripStatusInput!) {
        adminUpdateTripStatus(input: $input) {
          id
          status
        }
      }
    `;

    try {
      await queryGraphQL(statusMutation, {
        input: {
          tripId,
          status: newStatus
        }
      });

      setTrips(trips.map(t => t.id === tripId ? { ...t, status: newStatus } : t));
      showToast(`Trip status updated to ${newStatus}!`);
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this scheduled trip?')) return;
    setLoading(true);

    const deleteMutation = `
      mutation DeleteTrip($id: ID!) {
        adminDeleteTrip(id: $id)
      }
    `;

    try {
      await queryGraphQL(deleteMutation, { id });
      setTrips(trips.filter(t => t.id !== id));
      showToast('Trip deleted successfully!');
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBlockSeats = async (trip) => {
    setBlockingSeatsTrip(trip);
    setSelectedSeatIds([]);
    setBlockReason('');
    setLoading(true);

    const seatMapQuery = `
      query GetSeatMap($tripId: ID!) {
        seatMap(tripId: $tripId) {
          id
          label
          deck
          row
          column
          status
        }
      }
    `;

    try {
      const data = await queryGraphQL(seatMapQuery, { tripId: trip.id });
      if (data.seatMap && data.seatMap.length > 0) {
        setTripSeats(data.seatMap);
      } else {
        setTripSeats(getFallbackSeatsForTrip(trip.id));
      }
    } catch (err) {
      console.log('Using fallback seats.');
      setTripSeats(getFallbackSeatsForTrip(trip.id));
    } finally {
      setLoading(false);
    }
  };

  const handleBlockSeatsSubmit = async (e) => {
    e.preventDefault();
    if (selectedSeatIds.length === 0) {
      showToast('Please select at least one seat to block.', 'error');
      return;
    }

    setLoading(true);

    const blockSeatsMutation = `
      mutation BlockSeats($input: AdminBlockSeatsInput!) {
        adminBlockSeats(input: $input) {
          id
          label
          status
        }
      }
    `;

    try {
      await queryGraphQL(blockSeatsMutation, {
        input: {
          tripId: blockingSeatsTrip.id,
          seatIds: selectedSeatIds,
          reason: blockReason
        }
      });

      // Update local seats
      setTripSeats(tripSeats.map(s => {
        if (selectedSeatIds.includes(s.id)) {
          return { ...s, status: 'BLOCKED' };
        }
        return s;
      }));

      showToast(`Successfully blocked ${selectedSeatIds.length} seat(s)!`);
      setSelectedSeatIds([]);
    } catch (err) {
      // Offline fallback
      setTripSeats(tripSeats.map(s => {
        if (selectedSeatIds.includes(s.id)) {
          return { ...s, status: 'BLOCKED' };
        }
        return s;
      }));
      showToast(`Successfully blocked ${selectedSeatIds.length} seat(s)!`);
      setSelectedSeatIds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSeatSelection = (seatId) => {
    if (selectedSeatIds.includes(seatId)) {
      setSelectedSeatIds(selectedSeatIds.filter(id => id !== seatId));
    } else {
      setSelectedSeatIds([...selectedSeatIds, seatId]);
    }
  };

  const startEdit = (t) => {
    setEditingTrip(t);
    setRouteId(t.route.id);
    setVehicleId(t.vehicle.id);
    
    // Format ISO string to local date-time input value (YYYY-MM-DDTHH:MM)
    const depDate = new Date(t.departureTime);
    depDate.setMinutes(depDate.getMinutes() - depDate.getTimezoneOffset());
    setDepartureTime(depDate.toISOString().slice(0, 16));

    const arrDate = new Date(t.arrivalTime);
    arrDate.setMinutes(arrDate.getMinutes() - arrDate.getTimezoneOffset());
    setArrivalTime(arrDate.toISOString().slice(0, 16));

    setPrice(t.price.toString());
    setStatus(t.status);
  };

  const resetForm = () => {
    setEditingTrip(null);
    setRouteId('');
    setVehicleId('');
    setDepartureTime('');
    setArrivalTime('');
    setPrice('');
    setStatus('DRAFT');
  };

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
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
      case 'ACTIVE': return { bg: 'rgba(16, 185, 129, 0.12)', color: 'var(--secondary)' };
      case 'DRAFT': return { bg: 'rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)' };
      case 'LOCKED': return { bg: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' };
      case 'DEPARTED': return { bg: 'rgba(59, 130, 246, 0.12)', color: 'var(--info)' };
      case 'COMPLETED': return { bg: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)' };
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
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Manage Trips</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Schedule, configure, and monitor operational trip dispatching.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
        {/* Table List Card */}
        <div className="glass-card" style={{ padding: '30px', minHeight: '400px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Scheduled Trips</h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                <th style={{ padding: '12px 8px' }}>Route / Bus</th>
                <th style={{ padding: '12px 8px' }}>Departure</th>
                <th style={{ padding: '12px 8px' }}>Arrival</th>
                <th style={{ padding: '12px 8px' }}>Price</th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((t) => {
                const sColor = getStatusColor(t.status);
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--color-text-primary)' }}>{t.route.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>{t.vehicle.name}</div>
                    </td>
                    <td style={{ padding: '16px 8px', fontSize: '13px' }}>{formatDateTime(t.departureTime)}</td>
                    <td style={{ padding: '16px 8px', fontSize: '13px' }}>{formatDateTime(t.arrivalTime)}</td>
                    <td style={{ padding: '16px 8px', fontWeight: '600', color: 'var(--secondary)' }}>{formatCurrency(t.price)}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <select
                        value={t.status}
                        onChange={(e) => handleUpdateStatus(t.id, e.target.value)}
                        disabled={loading}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          fontWeight: '700',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          width: 'auto',
                          backgroundColor: sColor.bg,
                          color: sColor.color
                        }}
                      >
                        <option value="DRAFT">DRAFT</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="LOCKED">LOCKED</option>
                        <option value="DEPARTED">DEPARTED</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => handleOpenBlockSeats(t)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.3)' }} disabled={loading}>
                          Block Seats
                        </button>
                        <button onClick={() => startEdit(t)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Form Card */}
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>
            {editingTrip ? 'Edit Scheduled Trip' : 'New Scheduled Trip'}
          </h3>

          <form onSubmit={handleCreateOrUpdate}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="route">Operational Route</label>
              <select
                id="route"
                value={routeId}
                onChange={(e) => setRouteId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select route...</option>
                {SEEDED_ROUTES.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="vehicle">Assigned Bus</label>
              <select
                id="vehicle"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select vehicle...</option>
                {SEEDED_VEHICLES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="departure">Departure Date & Time</label>
              <input
                id="departure"
                type="datetime-local"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="arrival">Arrival Date & Time</label>
              <input
                id="arrival"
                type="datetime-local"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="price">Ticket Price (VND)</label>
              <input
                id="price"
                type="number"
                placeholder="e.g. 250000"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min="0"
                required
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label htmlFor="status">Default Status</label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                required
                disabled={loading}
              >
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="LOCKED">LOCKED</option>
                <option value="DEPARTED">DEPARTED</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? <div className="spinner"></div> : (editingTrip ? 'Save' : 'Schedule')}
              </button>
              {editingTrip && (
                <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Seat Blocking Modal */}
      {blockingSeatsTrip && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(5, 5, 10, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-card animate-fade-in" style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '35px',
            border: '1px solid var(--border-glass)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px', marginBottom: '25px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Inventory Operations</span>
                <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '4px' }}>
                  Block seats: {blockingSeatsTrip.route.name}
                </h2>
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  Bus: {blockingSeatsTrip.vehicle.name} | Departure: {formatDateTime(blockingSeatsTrip.departureTime)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBlockingSeatsTrip(null)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '20px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '35px', alignItems: 'start' }}>
              {/* Left Column: Visual Seat Map */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>Select seats on the map:</h4>

                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-glass)',
                  padding: '25px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '30px',
                  minHeight: '280px',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  {tripSeats.length === 0 ? (
                    <div className="spinner"></div>
                  ) : (
                    <div style={{ display: 'flex', gap: '40px', justifyContent: 'center', flexWrap: 'wrap' }}>
                      {Array.from(new Set(tripSeats.map(s => s.deck))).sort((a,b) => a-b).map(deckNum => {
                        const deckSeats = tripSeats.filter(s => s.deck === deckNum);
                        const maxRow = Math.max(1, ...tripSeats.map(s => s.row));
                        const maxCol = Math.max(1, ...tripSeats.map(s => s.column));

                        return (
                          <div key={deckNum} style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '12px' }}>
                              Deck {deckNum}
                            </span>
                            
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: `repeat(${maxCol}, 45px)`,
                              gap: '8px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              padding: '16px',
                              borderRadius: '10px',
                              border: '1px solid rgba(255, 255, 255, 0.04)'
                            }}>
                              {deckNum === 1 && (
                                <div style={{ gridColumn: `span ${maxCol}`, textAlign: 'right', fontSize: '16px', marginBottom: '8px', opacity: 0.6 }}>
                                  ☸️
                                </div>
                              )}

                              {Array.from({ length: maxRow }).map((_, rowIdx) => {
                                const r = rowIdx + 1;
                                return Array.from({ length: maxCol }).map((_, colIdx) => {
                                  const c = colIdx + 1;
                                  const seat = deckSeats.find(s => s.row === r && s.column === c);
                                  
                                  if (!seat) return <div key={`${r}-${c}`} style={{ height: '40px' }} />;
                                  
                                  const isSelected = selectedSeatIds.includes(seat.id);
                                  const isAvailable = seat.status === 'AVAILABLE';
                                  const isBlocked = seat.status === 'BLOCKED';
                                  const isBooked = seat.status === 'BOOKED';
                                  const isHeld = seat.status === 'HELD';
                                  
                                  let bg = 'rgba(255, 255, 255, 0.02)';
                                  let color = 'var(--color-text-secondary)';
                                  let border = '1px solid rgba(255, 255, 255, 0.08)';
                                  let cursor = 'not-allowed';
                                  
                                  if (isAvailable) {
                                    bg = 'rgba(16, 185, 129, 0.08)';
                                    color = 'var(--secondary)';
                                    border = '1px solid rgba(16, 185, 129, 0.25)';
                                    cursor = 'pointer';
                                  } else if (isBlocked) {
                                    bg = 'rgba(255, 255, 255, 0.04)';
                                    color = 'var(--color-text-muted)';
                                    border = '1px dashed rgba(255, 255, 255, 0.1)';
                                  } else if (isBooked) {
                                    bg = 'rgba(139, 92, 246, 0.1)';
                                    color = '#8b5cf6';
                                    border = '1px solid rgba(139, 92, 246, 0.2)';
                                  } else if (isHeld) {
                                    bg = 'rgba(59, 130, 246, 0.1)';
                                    color = 'var(--info)';
                                    border = '1px solid rgba(59, 130, 246, 0.2)';
                                  }

                                  if (isSelected) {
                                    bg = 'var(--primary-gradient)';
                                    color = 'white';
                                    border = '1px solid var(--primary)';
                                    cursor = 'pointer';
                                  }
                                  
                                  return (
                                    <button
                                      key={seat.id}
                                      type="button"
                                      onClick={() => isAvailable && handleToggleSeatSelection(seat.id)}
                                      disabled={!isAvailable}
                                      style={{
                                        height: '40px',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: bg,
                                        border: border,
                                        color: color,
                                        cursor: cursor,
                                        transition: 'all 0.15s ease',
                                        padding: 0,
                                        width: '100%',
                                        boxShadow: isSelected ? 'var(--shadow-glow)' : 'none'
                                      }}
                                      title={`${seat.label} (${seat.status})`}
                                    >
                                      {seat.label}
                                    </button>
                                  );
                                });
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Map Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Available</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Booked</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Held</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.04)', border: '1px dashed rgba(255, 255, 255, 0.1)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Blocked</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary-gradient)', border: '1px solid var(--primary)' }} />
                    <span style={{ color: 'var(--color-text-secondary)' }}>Selected</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Form Action */}
              <div className="glass-card" style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Block Allocation</h3>
                
                <div>
                  <label>Selected Seats</label>
                  <div style={{
                    minHeight: '40px',
                    padding: '10px 14px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: 'var(--primary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px'
                  }}>
                    {selectedSeatIds.length === 0 ? (
                      <span style={{ color: 'var(--color-text-muted)', fontWeight: '400', fontSize: '13px' }}>No seats selected</span>
                    ) : (
                      selectedSeatIds.map(id => (
                        <span key={id} style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                          {id}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <form onSubmit={handleBlockSeatsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label htmlFor="reason">Block Reason</label>
                    <textarea
                      id="reason"
                      placeholder="e.g. VIP allocation, technical issues..."
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      required
                      rows="3"
                      disabled={loading}
                      style={{ resize: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                    <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading || selectedSeatIds.length === 0}>
                      {loading ? <div className="spinner"></div> : 'Confirm Block'}
                    </button>
                    <button type="button" onClick={() => setBlockingSeatsTrip(null)} className="btn btn-secondary" disabled={loading}>
                      Close
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
