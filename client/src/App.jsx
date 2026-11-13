import { useState } from 'react';
import Auth from './Auth';
import Readings from './Readings';

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
    <>
      <div className="card header">
        <div>
          <h1>Sweety</h1>
          <p className="muted">Hi, {user?.name}</p>
        </div>
        <button onClick={handleLogout}>Log out</button>
      </div>
      <Readings token={token} />
    </>
  );
}