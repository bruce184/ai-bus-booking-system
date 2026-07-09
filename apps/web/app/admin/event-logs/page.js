'use client';

import { useState, useEffect } from 'react';
import { queryGraphQL } from '../../graphql.js';

function parsePayload(payload) {
  if (!payload) return {};
  if (typeof payload !== 'string') return payload;

  try {
    return JSON.parse(payload);
  } catch {
    return { raw: payload };
  }
}

export default function EventLogsDashboard() {
  const [logs, setLogs] = useState([]);
  // Filters
  const [filterEventType, setFilterEventType] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [expandedPayloadId, setExpandedPayloadId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredLogs = logs.filter(l => {
    if (filterEventType && l.eventType !== filterEventType) return false;
    if (filterEntityType && l.entityType !== filterEntityType) return false;
    return true;
  });

  const handleQueryLogs = async () => {
    setLoading(true);
    const logsQuery = `
      query AdminEventLogs($input: AdminEventLogFilterInput) {
        adminEventLogs(input: $input) {
          id
          eventType
          entityType
          entityId
          payload
          createdAt
        }
      }
    `;

    try {
      const data = await queryGraphQL(logsQuery, {
        input: {
          eventType: filterEventType || null,
          entityType: filterEntityType || null,
          limit: 30,
          offset: 0
        }
      });
      const items = data.adminEventLogs || [];
      setLogs(items);
      if (items.length > 0) {
        showToast('Successfully synced logs from database!');
      } else {
        showToast('No event logs found for the current filters.', 'info');
      }
    } catch (err) {
      setLogs([]);
      showToast(err.message || 'Failed to query event logs.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // setTimeout keeps the initial fetch's setState out of the synchronous
    // effect body (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => handleQueryLogs(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getEventBadgeStyle = (type) => {
    switch (type) {
      case 'passenger.checked_in':
        return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)', color: 'var(--secondary)', icon: '🟢' };
      case 'booking.paid':
        return { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.25)', color: 'var(--info)', icon: '💳' };
      case 'seat.blocked':
        return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)', color: 'var(--warning)', icon: '🛡️' };
      case 'trip.created':
        return { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.25)', color: 'var(--primary)', icon: '📅' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.06)', border: 'rgba(255, 255, 255, 0.1)', color: 'white', icon: '📜' };
    }
  };

  const toggleExpand = (id) => {
    if (expandedPayloadId === id) {
      setExpandedPayloadId(null);
    } else {
      setExpandedPayloadId(id);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      {/* Toast Alert */}
      {message && (
        <div className="toast-container">
          <div className={`toast ${message.type}`}>
            <span>{message.type === 'success' ? '✅' : 'ℹ️'}</span>
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: '700' }}>System Event Logs</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Audit trail of seat inventory releases, booking payments, and passenger boarding activity.</p>
      </div>

      {/* Filters Card */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '11px' }}>Event Type</label>
          <select value={filterEventType} onChange={(e) => setFilterEventType(e.target.value)}>
            <option value="">All Event Types</option>
            <option value="trip.created">trip.created</option>
            <option value="booking.paid">booking.paid</option>
            <option value="seat.blocked">seat.blocked</option>
            <option value="passenger.checked_in">passenger.checked_in</option>
            <option value="ticket.checked_in">ticket.checked_in</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ fontSize: '11px' }}>Entity Type</label>
          <select value={filterEntityType} onChange={(e) => setFilterEntityType(e.target.value)}>
            <option value="">All Entity Types</option>
            <option value="TRIP">TRIP</option>
            <option value="BOOKING">BOOKING</option>
            <option value="SEAT">SEAT</option>
            <option value="TICKET">TICKET</option>
          </select>
        </div>
        <button onClick={handleQueryLogs} className="btn btn-secondary" style={{ height: '40px' }} disabled={loading}>
          {loading ? <div className="spinner"></div> : 'Search DB'}
        </button>
      </div>

      {/* Timeline Section */}
      <div className="glass-card" style={{ padding: '40px', minHeight: '400px' }}>
        <h3 style={{ fontSize: '18px', marginBottom: '30px', fontWeight: '600' }}>Activity Timeline</h3>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
            No event logs matching filter criteria.
          </div>
        ) : (
          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Center line for timeline */}
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '10px',
              bottom: '10px',
              width: '2px',
              background: 'linear-gradient(to bottom, rgba(99, 102, 241, 0.4) 0%, rgba(99, 102, 241, 0.05) 100%)',
              pointerEvents: 'none'
            }}></div>

            {filteredLogs.map((log) => {
              const badge = getEventBadgeStyle(log.eventType);
              const isExpanded = expandedPayloadId === log.id;
              
              return (
                <div key={log.id} style={{ display: 'flex', gap: '20px', position: 'relative' }}>
                  {/* Timeline bullet */}
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'var(--bg-surface)',
                    border: `1px solid ${badge.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    boxShadow: 'var(--shadow-sm)',
                    zIndex: 2,
                    flexShrink: 0
                  }}>
                    {badge.icon}
                  </div>

                  {/* Log Content Card */}
                  <div className="glass-card" style={{
                    flex: 1,
                    padding: '20px',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255, 255, 255, 0.03)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          marginRight: '10px'
                        }}>
                          {log.eventType}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                          {log.entityType}: <strong style={{ color: 'white', fontFamily: 'monospace' }}>{log.entityId}</strong>
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                        {log.eventType === 'trip.created' && `Trip ${log.entityId} scheduled for dispatch.`}
                        {log.eventType === 'booking.paid' && `Booking payment registered successfully.`}
                        {log.eventType === 'seat.blocked' && `Admin locked seat selection.`}
                        {log.eventType === 'passenger.checked_in' && `Passenger boarded bus.`}
                        {log.eventType === 'ticket.checked_in' && `Passenger boarded bus.`}
                      </span>
                      <button
                        onClick={() => toggleExpand(log.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: '600',
                          padding: '0'
                        }}
                      >
                        {isExpanded ? 'Hide Payload' : 'View Payload'}
                      </button>
                    </div>

                    {isExpanded && (
                      <pre style={{
                        marginTop: '10px',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '15px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        color: '#a7f3d0',
                        overflowX: 'auto',
                        border: '1px solid rgba(255,255,255,0.05)',
                        animation: 'fadeIn 0.2s ease forwards'
                      }}>
                        {JSON.stringify(parsePayload(log.payload), null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
