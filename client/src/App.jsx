import { useState } from 'react';
import Auth from './Auth';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));

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
  }

  if (!token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="card">
      <h1>Welcome, {user?.name}</h1>
      <p className="muted">Readings screen coming next.</p>
      <button onClick={handleLogout}>Log out</button>
    </div>
  );
}