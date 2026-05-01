import React, { useState, useEffect } from 'react';
import { Login } from './components/Login.jsx';
import ScreenManager from './components/ScreenManager.jsx';
import { getStoredPassword, api } from './api.js';

export default function App() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    const stored = getStoredPassword();
    if (!stored) {
      setAuthed(false);
      return;
    }
    api.ping()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return null;  // booting
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return <ScreenManager />;
}
