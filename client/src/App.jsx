import { useState, useEffect } from 'react';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import { auth } from './api.js';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('asterope_token');
    if (!token) { setChecking(false); return; }

    auth.verify()
      .then(() => setAuthed(true))
      .catch(() => {
        localStorage.removeItem('asterope_token');
        setAuthed(false);
      })
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117]">
        <div className="w-8 h-8 border-2 border-[#30363d] border-t-[#1f6feb] rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={() => { localStorage.removeItem('asterope_token'); setAuthed(false); }} />;
}
