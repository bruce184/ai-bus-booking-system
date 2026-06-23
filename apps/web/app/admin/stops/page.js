'use client';

import { useState } from 'react';
import { queryGraphQL } from '../../graphql.js';

// Pre-seeded locations from B-3
const SEEDED_LOCATIONS = [
  { id: 'loc-hcm-md', name: 'TP.HCM (Bến Xe Miền Đông)', type: 'STATION' },
  { id: 'loc-hcm-mt', name: 'TP.HCM (Bến Xe Miền Tây)', type: 'STATION' },
  { id: 'loc-dl', name: 'Đà Lạt (Bến Xe Liên Tỉnh)', type: 'STATION' },
  { id: 'loc-nt', name: 'Nha Trang (Bến Xe Phía Nam)', type: 'STATION' },
  { id: 'loc-ct', name: 'Cần Thơ (Bến Xe Cần Thơ)', type: 'STATION' },
  { id: 'loc-dn', name: 'Đà Nẵng (Bến Xe Đà Nẵng)', type: 'STATION' },
  { id: 'loc-hn', name: 'Hà Nội (Bến Xe Mỹ Đình)', type: 'STATION' }
];

// Pre-seeded routes from B-3
const SEEDED_ROUTES = [
  { id: 'route-hcm-dl', name: 'TP.HCM -> Đà Lạt' },
  { id: 'route-hcm-nt', name: 'TP.HCM -> Nha Trang' },
  { id: 'route-hcm-ct', name: 'TP.HCM -> Cần Thơ' },
  { id: 'route-dn-hn', name: 'Đà Nẵng -> Hà Nội' },
  { id: 'route-hn-dn', name: 'Hà Nội -> Đà Nẵng' }
];

// Pre-seeded stops from B-3
const INITIAL_STOPS = [
  { id: 'stop-1', route: SEEDED_ROUTES[0], location: SEEDED_LOCATIONS[0], stopType: 'PICKUP', stopOrder: 1 },
  { id: 'stop-2', route: SEEDED_ROUTES[0], location: SEEDED_LOCATIONS[2], stopType: 'DROPOFF', stopOrder: 2 },
  { id: 'stop-3', route: SEEDED_ROUTES[1], location: SEEDED_LOCATIONS[0], stopType: 'PICKUP', stopOrder: 1 },
  { id: 'stop-4', route: SEEDED_ROUTES[1], location: SEEDED_LOCATIONS[3], stopType: 'DROPOFF', stopOrder: 2 }
];

export default function StopsCrud() {
  const [stops, setStops] = useState(INITIAL_STOPS);
  const [routeId, setRouteId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [stopType, setStopType] = useState('PICKUP');
  const [stopOrder, setStopOrder] = useState('1');

  const [editingStop, setEditingStop] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!routeId || !locationId || !stopType) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);

    const isEditing = !!editingStop;
    const mutation = isEditing ? `
      mutation UpdateStop($id: ID!, $input: AdminStopInput!) {
        adminUpdateStop(id: $id, input: $input) {
          id
          stopType
          stopOrder
        }
      }
    ` : `
      mutation CreateStop($input: AdminStopInput!) {
        adminCreateStop(input: $input) {
          id
          stopType
          stopOrder
        }
      }
    `;

    try {
      const variables = {
        input: {
          routeId,
          locationId,
          stopType,
          stopOrder: stopOrder ? parseInt(stopOrder, 10) : 1
        }
      };
      if (isEditing) {
        variables.id = editingStop.id;
      }

      await queryGraphQL(mutation, variables);

      const routeObj = SEEDED_ROUTES.find(r => r.id === routeId);
      const locObj = SEEDED_LOCATIONS.find(l => l.id === locationId);

      if (isEditing) {
        setStops(stops.map(s => s.id === editingStop.id ? {
          ...s,
          route: routeObj,
          location: locObj,
          stopType,
          stopOrder: stopOrder ? parseInt(stopOrder, 10) : 1
        } : s));
        showToast('Stop updated successfully!');
      } else {
        const newId = `stop-new-${Date.now()}`;
        setStops([...stops, {
          id: newId,
          route: routeObj,
          location: locObj,
          stopType,
          stopOrder: stopOrder ? parseInt(stopOrder, 10) : 1
        }]);
        showToast('Stop created successfully!');
      }

      resetForm();
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this stop?')) return;
    setLoading(true);

    const deleteMutation = `
      mutation DeleteStop($id: ID!) {
        adminDeleteStop(id: $id)
      }
    `;

    try {
      await queryGraphQL(deleteMutation, { id });
      setStops(stops.filter(s => s.id !== id));
      showToast('Stop deleted successfully!');
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (stop) => {
    setEditingStop(stop);
    setRouteId(stop.route.id);
    setLocationId(stop.location.id);
    setStopType(stop.stopType);
    setStopOrder(stop.stopOrder.toString());
  };

  const resetForm = () => {
    setEditingStop(null);
    setRouteId('');
    setLocationId('');
    setStopType('PICKUP');
    setStopOrder('1');
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
        <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Manage Route Stops</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Add pickup and dropoff points to existing bus routes.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
        {/* Table list card */}
        <div className="glass-card" style={{ padding: '30px', minHeight: '400px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Active Stops</h3>
          
          {stops.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
              No stops configured. Select a route and configure one.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Route</th>
                  <th style={{ padding: '12px 8px' }}>Location / Station</th>
                  <th style={{ padding: '12px 8px' }}>Type</th>
                  <th style={{ padding: '12px 8px' }}>Order</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stops.map((stop) => (
                  <tr key={stop.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 8px', fontWeight: '600', color: 'var(--primary)' }}>{stop.route.name}</td>
                    <td style={{ padding: '16px 8px', fontWeight: '500' }}>{stop.location.name}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: stop.stopType === 'PICKUP' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                        color: stop.stopType === 'PICKUP' ? 'var(--secondary)' : 'var(--info)'
                      }}>
                        {stop.stopType}
                      </span>
                    </td>
                    <td style={{ padding: '16px 8px' }}>{stop.stopOrder}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => startEdit(stop)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(stop.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>
            {editingStop ? 'Edit Stop' : 'New Stop'}
          </h3>

          <form onSubmit={handleCreateOrUpdate}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="route">Target Route</label>
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
              <label htmlFor="location">Station Location</label>
              <select
                id="location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select location...</option>
                {SEEDED_LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="stopType">Stop Type</label>
              <select
                id="stopType"
                value={stopType}
                onChange={(e) => setStopType(e.target.value)}
                required
                disabled={loading}
              >
                <option value="PICKUP">PICKUP</option>
                <option value="DROPOFF">DROPOFF</option>
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label htmlFor="stopOrder">Sequence Order</label>
              <input
                id="stopOrder"
                type="number"
                placeholder="e.g. 1"
                value={stopOrder}
                onChange={(e) => setStopOrder(e.target.value)}
                min="1"
                required
                disabled={loading}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? <div className="spinner"></div> : (editingStop ? 'Save' : 'Create')}
              </button>
              {editingStop && (
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
