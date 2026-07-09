'use client';

import { useState, useEffect } from 'react';
import { queryGraphQL } from '../../graphql.js';

export default function RoutesCrud() {
  const [routes, setRoutes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  
  const [editingRoute, setEditingRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await queryGraphQL(`
          query AdminRoutesData {
            adminLocations { id name type address }
            adminRoutes {
              id
              distanceKm
              origin { id name type address }
              destination { id name type address }
            }
          }
        `);
        if (data) {
          setLocations(data.adminLocations || []);
          setRoutes(data.adminRoutes || []);
        }
      } catch (err) {
        showToast(err.message || 'Failed to fetch initial data.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!originId || !destinationId) {
      showToast('Please select origin and destination locations.', 'error');
      return;
    }
    if (originId === destinationId) {
      showToast('Origin and destination cannot be the same.', 'error');
      return;
    }

    setLoading(true);

    const isEditing = !!editingRoute;
    const mutation = isEditing ? `
      mutation UpdateRoute($id: ID!, $input: AdminRouteInput!) {
        adminUpdateRoute(id: $id, input: $input) {
          id
          distanceKm
          origin { id name type address }
          destination { id name type address }
        }
      }
    ` : `
      mutation CreateRoute($input: AdminRouteInput!) {
        adminCreateRoute(input: $input) {
          id
          distanceKm
          origin { id name type address }
          destination { id name type address }
        }
      }
    `;

    try {
      const variables = {
        input: {
          originLocationId: originId,
          destinationLocationId: destinationId,
          distanceKm: distanceKm ? parseInt(distanceKm, 10) : 0,
        }
      };
      if (isEditing) {
        variables.id = editingRoute.id;
      }

      const data = await queryGraphQL(mutation, variables);
      const returnedRoute = data.adminCreateRoute || data.adminUpdateRoute;

      if (isEditing) {
        setRoutes(routes.map(r => r.id === editingRoute.id ? returnedRoute : r));
        showToast('Route updated successfully!');
      } else {
        setRoutes([...routes, returnedRoute]);
        showToast('Route created successfully!');
      }

      resetForm();
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this route?')) return;
    setLoading(true);

    const deleteMutation = `
      mutation DeleteRoute($id: ID!) {
        adminDeleteRoute(id: $id)
      }
    `;

    try {
      await queryGraphQL(deleteMutation, { id });
      setRoutes(routes.filter(r => r.id !== id));
      showToast('Route deleted successfully!');
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (route) => {
    setEditingRoute(route);
    setOriginId(route.origin.id);
    setDestinationId(route.destination.id);
    setDistanceKm(route.distanceKm || '');
  };

  const resetForm = () => {
    setEditingRoute(null);
    setOriginId('');
    setDestinationId('');
    setDistanceKm('');
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
          <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Manage Routes</h1>
          <p style={{ color: 'var(--color-text-secondary)' }}>Create, update, and delete intercity bus routes.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
        {/* Table list card */}
        <div className="glass-card" style={{ padding: '30px', minHeight: '400px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Active Routes</h3>
          
          {routes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
              No routes available. Create one to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Route ID</th>
                  <th style={{ padding: '12px 8px' }}>Origin</th>
                  <th style={{ padding: '12px 8px' }}>Destination</th>
                  <th style={{ padding: '12px 8px' }}>Distance</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={route.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px', transition: 'all 0.2s' }}>
                    <td style={{ padding: '16px 8px', color: 'var(--color-text-muted)' }}>{route.id}</td>
                    <td style={{ padding: '16px 8px', fontWeight: '500' }}>{route.origin.name}</td>
                    <td style={{ padding: '16px 8px', fontWeight: '500' }}>{route.destination.name}</td>
                    <td style={{ padding: '16px 8px' }}>{route.distanceKm} km</td>
                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => startEdit(route)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(route.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
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
            {editingRoute ? 'Edit Route' : 'New Route'}
          </h3>

          <form onSubmit={handleCreateOrUpdate}>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="origin">Origin Location</label>
              <select
                id="origin"
                value={originId}
                onChange={(e) => setOriginId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select origin...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="destination">Destination Location</label>
              <select
                id="destination"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                required
                disabled={loading}
              >
                <option value="">Select destination...</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label htmlFor="distance">Distance (km)</label>
              <input
                id="distance"
                type="number"
                placeholder="e.g. 300"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                min="1"
                disabled={loading}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                {loading ? <div className="spinner"></div> : (editingRoute ? 'Save' : 'Create')}
              </button>
              {editingRoute && (
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
