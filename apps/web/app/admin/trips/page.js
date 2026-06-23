'use client';

import { useState } from 'react';
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
        const newId = `trip-new-${Date.now()}`;
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
    </div>
  );
}
