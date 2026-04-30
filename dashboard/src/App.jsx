import React, { useState, useEffect, useCallback } from 'react';
import { Login } from './components/Login.jsx';
import { ScreenManager } from './components/ScreenManager.jsx';
import { api, getPassword, clearPassword } from './api.js';

export default function App() {
  const [authed, setAuthed] = useState(!!getPassword());
  const [screens, setScreens] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [screensRes, activityRes] = await Promise.all([
        api.listScreens(),
        api.listActivity(),
      ]);
      setScreens(screensRes.screens || []);
      setActivity(activityRes.activity || []);
    } catch (err) {
      console.error('load failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 5s polling for live updates
  useEffect(() => {
    if (!authed) return;
    loadAll();
    const interval = setInterval(loadAll, 5000);
    return () => clearInterval(interval);
  }, [authed, loadAll]);

  const handleSignOut = () => {
    clearPassword();
    setAuthed(false);
  };

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <ScreenManager
      screens={screens}
      activity={activity}
      loading={loading}
      onReload={loadAll}
      onSignOut={handleSignOut}
    />
  );
}
