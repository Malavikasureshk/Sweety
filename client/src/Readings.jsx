import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

const SLOTS = [
  { value: 'morning', label: 'Morning (fasting)' },
  { value: 'after_breakfast', label: 'After breakfast' },
  { value: 'after_lunch', label: 'After lunch' },
  { value: 'after_dinner', label: 'After dinner' },
];

function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

export default function Readings({ token }) {
  const [date, setDate] = useState(todayString());
  const [slot, setSlot] = useState('morning');
  const [value, setValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [readings, setReadings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadReadings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api(`/readings?date=${date}`, { token });
      setReadings(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [date, token]);

  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  function resetForm() {
    setEditingId(null);
    setSlot('morning');
    setValue('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        await api(`/readings/${editingId}`, {
          method: 'PUT',
          token,
          body: { reading_date: date, slot, value },
        });
      } else {
        await api('/readings', {
          method: 'POST',
          token,
          body: { reading_date: date, slot, value },
        });
      }
      resetForm();
      await loadReadings();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(reading) {
    setEditingId(reading.id);
    setSlot(reading.slot);
    setValue(String(reading.value));
    setError('');
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this reading?')) return;
    setError('');
    try {
      await api(`/readings/${id}`, { method: 'DELETE', token });
      if (editingId === id) resetForm();
      await loadReadings();
    } catch (err) {
      setError(err.message);
    }
  }

  function slotLabel(slotValue) {
    return SLOTS.find((s) => s.value === slotValue)?.label || slotValue;
  }

  return (
    <>
      <div className="card">
        <h2>{editingId ? 'Edit reading' : 'Add a reading'}</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Date
            <input
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => {
                setDate(e.target.value);
                resetForm();
              }}
            />
          </label>
          <label>
            Time slot
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Glucose value (mg/dl)
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 110"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add reading'}</button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Readings for {date}</h2>
        {loading ? (
          <p className="muted">Loading...</p>
        ) : readings.length === 0 ? (
          <p className="muted">No readings for this date yet.</p>
        ) : (
          <ul className="reading-list">
            {readings.map((r) => (
              <li key={r.id}>
                <span>{slotLabel(r.slot)}</span>
                <span className="reading-right">
                  <strong>{r.value} mg/dl</strong>
                  <button type="button" className="secondary small" onClick={() => startEdit(r)}>
                    Edit
                  </button>
                  <button type="button" className="danger small" onClick={() => handleDelete(r.id)}>
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}