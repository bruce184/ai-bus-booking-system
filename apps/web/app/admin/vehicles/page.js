'use client';

import { useState, useRef } from 'react';
import { queryGraphQL } from '../../graphql.js';

// Pre-seeded vehicles from B-3
const INITIAL_VEHICLES = [
  { id: 'veh-01', operatorName: 'Phương Trang Demo', vehicleCode: 'V01', licensePlate: '51B-123.45', vehicleType: 'SEAT', seatCount: 29 },
  { id: 'veh-02', operatorName: 'Thành Bưởi Demo', vehicleCode: 'V02', licensePlate: '49B-678.90', vehicleType: 'SLEEPER', seatCount: 34 },
  { id: 'veh-03', operatorName: 'Kumho Samco Demo', vehicleCode: 'V03', licensePlate: '51B-555.22', vehicleType: 'LIMOUSINE', seatCount: 22 }
];

export default function VehiclesCrud() {
  const [vehicles, setVehicles] = useState(INITIAL_VEHICLES);
  const [operatorName, setOperatorName] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [vehicleType, setVehicleType] = useState('SEAT');
  const [seatCount, setSeatCount] = useState('29');

  const [editingVehicle, setEditingVehicle] = useState(null);
  const [configuringSeatsVehicle, setConfiguringSeatsVehicle] = useState(null);

  // Seat config form states
  const [decks, setDecks] = useState(1);
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(4);
  const [generatedSeats, setGeneratedSeats] = useState([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const nextId = useRef(0);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!operatorName || !vehicleCode || !vehicleType) {
      showToast('Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);

    const isEditing = !!editingVehicle;
    const mutation = isEditing ? `
      mutation UpdateVehicle($id: ID!, $input: AdminVehicleInput!) {
        adminUpdateVehicle(id: $id, input: $input) {
          id
          seatCount
        }
      }
    ` : `
      mutation CreateVehicle($input: AdminVehicleInput!) {
        adminCreateVehicle(input: $input) {
          id
          seatCount
        }
      }
    `;

    try {
      const variables = {
        input: {
          operatorName,
          vehicleCode,
          licensePlate,
          vehicleType,
          seatCount: seatCount ? parseInt(seatCount, 10) : 0
        }
      };
      if (isEditing) {
        variables.id = editingVehicle.id;
      }

      await queryGraphQL(mutation, variables);

      if (isEditing) {
        setVehicles(vehicles.map(v => v.id === editingVehicle.id ? {
          ...v,
          operatorName,
          vehicleCode,
          licensePlate,
          vehicleType,
          seatCount: seatCount ? parseInt(seatCount, 10) : 0
        } : v));
        showToast('Vehicle updated successfully!');
      } else {
        nextId.current += 1;
        const newId = `veh-new-${nextId.current}`;
        setVehicles([...vehicles, {
          id: newId,
          operatorName,
          vehicleCode,
          licensePlate,
          vehicleType,
          seatCount: seatCount ? parseInt(seatCount, 10) : 0
        }]);
        showToast('Vehicle created successfully!');
      }

      resetForm();
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    setLoading(true);

    const deleteMutation = `
      mutation DeleteVehicle($id: ID!) {
        adminDeleteVehicle(id: $id)
      }
    `;

    try {
      await queryGraphQL(deleteMutation, { id });
      setVehicles(vehicles.filter(v => v.id !== id));
      showToast('Vehicle deleted successfully!');
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateSeatGrid = () => {
    const list = [];
    let count = 1;
    for (let d = 1; d <= decks; d++) {
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          // Label logic e.g., A01, A02 for deck 1, B01, B02 for deck 2
          const prefix = d === 1 ? 'A' : 'B';
          const numStr = count < 10 ? `0${count}` : `${count}`;
          list.push({
            label: `${prefix}${numStr}`,
            deck: d,
            row: r,
            column: c
          });
          count++;
        }
      }
    }
    setGeneratedSeats(list);
    showToast(`Generated grid with ${list.length} seats!`);
  };

  const handleSaveSeats = async () => {
    if (generatedSeats.length === 0) {
      showToast('Please generate the seat grid first.', 'error');
      return;
    }

    setLoading(true);

    const saveSeatsMutation = `
      mutation ConfigureSeats($vehicleId: ID!, $seats: [AdminVehicleSeatInput!]!) {
        adminConfigureVehicleSeats(vehicleId: $vehicleId, seats: $seats) {
          id
          label
          deck
          row
          column
        }
      }
    `;

    try {
      await queryGraphQL(saveSeatsMutation, {
        vehicleId: configuringSeatsVehicle.id,
        seats: generatedSeats.map(({ label, deck, row, column }) => ({
          label,
          deck,
          row,
          column
        }))
      });

      // Update local vehicles seatCount to match generated seats
      setVehicles(vehicles.map(v => v.id === configuringSeatsVehicle.id ? {
        ...v,
        seatCount: generatedSeats.length
      } : v));

      showToast('Vehicle seats configured successfully!');
      setConfiguringSeatsVehicle(null);
      setGeneratedSeats([]);
    } catch (err) {
      showToast(err.message || 'Error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (v) => {
    setEditingVehicle(v);
    setOperatorName(v.operatorName);
    setVehicleCode(v.vehicleCode);
    setLicensePlate(v.licensePlate || '');
    setVehicleType(v.vehicleType);
    setSeatCount(v.seatCount.toString());
  };

  const resetForm = () => {
    setEditingVehicle(null);
    setOperatorName('');
    setVehicleCode('');
    setLicensePlate('');
    setVehicleType('SEAT');
    setSeatCount('29');
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
        <h1 style={{ fontSize: '32px', fontWeight: '700' }}>Manage Vehicles</h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>Configure bus fleets and visual seat map grids.</p>
      </div>

      {!configuringSeatsVehicle ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px', alignItems: 'start' }}>
          {/* Table List Card */}
          <div className="glass-card" style={{ padding: '30px', minHeight: '400px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>Bus Fleet</h3>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px' }}>Code</th>
                  <th style={{ padding: '12px 8px' }}>Operator</th>
                  <th style={{ padding: '12px 8px' }}>License Plate</th>
                  <th style={{ padding: '12px 8px' }}>Type</th>
                  <th style={{ padding: '12px 8px' }}>Seats</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '14px' }}>
                    <td style={{ padding: '16px 8px', fontWeight: '700' }}>{v.vehicleCode}</td>
                    <td style={{ padding: '16px 8px', fontWeight: '500' }}>{v.operatorName}</td>
                    <td style={{ padding: '16px 8px', fontFamily: 'monospace' }}>{v.licensePlate || 'N/A'}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        backgroundColor: v.vehicleType === 'SEAT' ? 'rgba(59, 130, 246, 0.12)' : v.vehicleType === 'SLEEPER' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(139, 92, 246, 0.12)',
                        color: v.vehicleType === 'SEAT' ? 'var(--info)' : v.vehicleType === 'SLEEPER' ? 'var(--secondary)' : '#8b5cf6'
                      }}>
                        {v.vehicleType}
                      </span>
                    </td>
                    <td style={{ padding: '16px 8px', fontWeight: '600' }}>{v.seatCount} seats</td>
                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button onClick={() => setConfiguringSeatsVehicle(v)} className="btn btn-success" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Configure Seats
                        </button>
                        <button onClick={() => startEdit(v)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Edit
                        </button>
                        <button onClick={() => handleDelete(v.id)} className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} disabled={loading}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Card */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '18px', marginBottom: '20px', fontWeight: '600' }}>
              {editingVehicle ? 'Edit Vehicle' : 'New Vehicle'}
            </h3>

            <form onSubmit={handleCreateOrUpdate}>
              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="operator">Operator Name</label>
                <input
                  id="operator"
                  type="text"
                  placeholder="e.g. Phương Trang"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="code">Vehicle Code</label>
                <input
                  id="code"
                  type="text"
                  placeholder="e.g. V01"
                  value={vehicleCode}
                  onChange={(e) => setVehicleCode(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="plate">License Plate</label>
                <input
                  id="plate"
                  type="text"
                  placeholder="e.g. 51B-123.45"
                  value={licensePlate}
                  onChange={(e) => setLicensePlate(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="type">Vehicle Type</label>
                <select
                  id="type"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  required
                  disabled={loading}
                >
                  <option value="SEAT">SEAT</option>
                  <option value="SLEEPER">SLEEPER</option>
                  <option value="LIMOSINE">LIMOUSINE</option>
                </select>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <label htmlFor="seats">Seat Count</label>
                <input
                  id="seats"
                  type="number"
                  placeholder="e.g. 29"
                  value={seatCount}
                  onChange={(e) => setSeatCount(e.target.value)}
                  min="1"
                  required
                  disabled={loading}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? <div className="spinner"></div> : (editingVehicle ? 'Save' : 'Create')}
                </button>
                {editingVehicle && (
                  <button type="button" onClick={resetForm} className="btn btn-secondary" disabled={loading}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Visual Seat Grid Config Card */
        <div className="glass-card animate-fade-in" style={{ padding: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '20px', marginBottom: '30px' }}>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>Configuring Layout</span>
              <h2 style={{ fontSize: '24px', fontWeight: '700', marginTop: '4px' }}>
                {configuringSeatsVehicle.operatorName} ({configuringSeatsVehicle.vehicleCode})
              </h2>
            </div>
            <button onClick={() => { setConfiguringSeatsVehicle(null); setGeneratedSeats([]); }} className="btn btn-secondary">
              Back to Fleet
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '40px' }}>
            {/* Form grid inputs */}
            <div>
              <h4 style={{ fontSize: '16px', marginBottom: '18px', fontWeight: '600' }}>Grid Parameters</h4>
              
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="decks">Number of Decks</label>
                <select id="decks" value={decks} onChange={(e) => setDecks(parseInt(e.target.value))} disabled={loading}>
                  <option value={1}>1 Deck (Single-decker)</option>
                  <option value={2}>2 Decks (Double-decker sleeper)</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="gridRows">Rows</label>
                <input id="gridRows" type="number" value={rows} onChange={(e) => setRows(parseInt(e.target.value))} min="1" max="15" disabled={loading} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label htmlFor="gridCols">Columns</label>
                <input id="gridCols" type="number" value={cols} onChange={(e) => setCols(parseInt(e.target.value))} min="1" max="6" disabled={loading} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button type="button" onClick={generateSeatGrid} className="btn btn-secondary" style={{ width: '100%' }} disabled={loading}>
                  Preview Seat Map Grid
                </button>
                <button type="button" onClick={handleSaveSeats} className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? <div className="spinner"></div> : 'Save Configuration'}
                </button>
              </div>
            </div>

            {/* Grid preview panel */}
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-glass)', padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px', minHeight: '300px', justifyContent: 'center', alignItems: 'center' }}>
              {generatedSeats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
                  Select grid parameters on the left and click &quot;Preview Seat Map Grid&quot; to render the bus layout.
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '50px', justifyContent: 'center' }}>
                  {/* Render per deck */}
                  {Array.from({ length: decks }).map((_, deckIdx) => {
                    const deckNum = deckIdx + 1;
                    const deckSeats = generatedSeats.filter(s => s.deck === deckNum);
                    
                    return (
                      <div key={deckNum} style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--color-text-muted)', display: 'block', marginBottom: '15px' }}>
                          Deck {deckNum}
                        </span>
                        
                        {/* Grid container */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: `repeat(${cols}, 45px)`,
                          gap: '10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          padding: '20px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          position: 'relative'
                        }}>
                          {/* Simulated Steering Wheel for Deck 1 */}
                          {deckNum === 1 && (
                            <div style={{ gridColumn: `span ${cols}`, textAlign: 'right', fontSize: '20px', marginBottom: '10px', opacity: 0.7 }}>
                              ☸️
                            </div>
                          )}

                          {Array.from({ length: rows }).map((_, rowIdx) => {
                            const r = rowIdx + 1;
                            return Array.from({ length: cols }).map((_, colIdx) => {
                              const c = colIdx + 1;
                              const seat = deckSeats.find(s => s.row === r && s.column === c);
                              
                              return (
                                <div key={`${r}-${c}`} style={{
                                  height: '40px',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background: seat ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                                  border: seat ? '1px solid rgba(99, 102, 241, 0.3)' : '1px dashed rgba(255, 255, 255, 0.05)',
                                  color: seat ? 'var(--primary)' : 'transparent'
                                }}>
                                  {seat?.label || ''}
                                </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
