import { useState } from 'react';
import Auth from './Auth';
import Readings from './Readings';
import Reports from './Reports';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [view, setView] = useState('readings');

  function handleLogin(newToken, newUser) {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setView('readings');
  }

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <>
      <div className="card header">
        <div>
          <h1>Sweety</h1>
          <p className="muted">Hi, {user?.name}</p>
        </div>
        <button onClick={handleLogout}>Log out</button>
      </div>

      <div className="tabs">
        <button
          className={view === 'readings' ? 'tab active' : 'tab'}
          onClick={() => setView('readings')}
        >
          Readings
        </button>
        <button
          className={view === 'reports' ? 'tab active' : 'tab'}
          onClick={() => setView('reports')}
        >
          Reports
        </button>
      </div>

      {view === 'readings' ? <Readings token={token} /> : <Reports token={token} />}
    </>
  );
}