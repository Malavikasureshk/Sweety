import { useState, useEffect } from 'react';
import { api } from './api';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const SLOT_LABELS = {
  morning: 'Morning (fasting)',
  after_breakfast: 'After breakfast',
  after_lunch: 'After lunch',
  after_dinner: 'After dinner',
};

function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

// 2026-10-15 -> "15 Oct 2026"
function formatDate(str) {
  const [y, m, d] = str.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

// Same day -> "15 Oct 2026", otherwise "1 Oct – 15 Oct 2026"
function formatRange(from, to) {
  if (from === to) return formatDate(to);
  const [, m, d] = from.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]} – ${formatDate(to)}`;
}

function ReportCard({ title, report, children }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="muted">{formatRange(report.from, report.to)}</p>

      {report.empty ? (
        <p className="empty-state">No readings for this period yet. Add a reading to see your report.</p>
      ) : (
        <>
          <div className="stats">
            <div>
              <span className="stat-label">Highest</span>
              <strong>{report.highest}</strong>
            </div>
            <div>
              <span className="stat-label">Lowest</span>
              <strong>{report.lowest}</strong>
            </div>
            <div>
              <span className="stat-label">Average</span>
              <strong>{report.average.toFixed(1)}</strong>
            </div>
            <div>
              <span className="stat-label">Readings</span>
              <strong>{report.count}</strong>
            </div>
          </div>
          <p className="muted small-text">Values in mg/dl</p>
          {children}
        </>
      )}
    </div>
  );
}

export default function Reports({ token }) {
  const [date, setDate] = useState(todayString());
  const [reports, setReports] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError('');
      try {
        const [daily, monthToDate, monthly] = await Promise.all([
          api(`/reports/daily?date=${date}`, { token }),
          api(`/reports/month-to-date?date=${date}`, { token }),
          api(`/reports/monthly?date=${date}`, { token }),
        ]);
        if (!cancelled) setReports({ daily, monthToDate, monthly });
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [date, token]);

  return (
    <>
      <div className="card">
        <h2>Reports</h2>
        <label>
          Selected date
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
      </div>

      {!reports && !error && <p className="muted">Loading...</p>}

      {reports && (
        <>
          <ReportCard title="Daily report" report={reports.daily}>
            <ul className="reading-list">
              {reports.daily.readings.map((r) => (
                <li key={r.id}>
                  <span>{SLOT_LABELS[r.slot]}</span>
                  <strong>{r.value} mg/dl</strong>
                </li>
              ))}
            </ul>
          </ReportCard>

          <ReportCard title="Month-to-date report" report={reports.monthToDate} />
          <ReportCard title="Previous month report" report={reports.monthly} />
        </>
      )}
    </>
  );
}