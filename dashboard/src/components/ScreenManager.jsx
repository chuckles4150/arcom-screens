import React, { useState, useCallback } from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { T } from '../theme.js';
import { Sidebar } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { ScreensPage } from './pages/ScreensPage.jsx';
import { ActivityPage } from './pages/ActivityPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { PlaylistsPage } from './pages/PlaylistsPage.jsx';
import { SchedulesPage } from './pages/SchedulesPage.jsx';
import { IncidentsPage } from './pages/IncidentsPage.jsx';
import { api } from '../api.js';
import { useFetch } from '../hooks/useFetch.js';

// Layout shell: sidebar + topbar + the active page. Owns:
//   - which page is active (nav)
//   - the search-field value (read by ScreensPage to filter tiles)
//   - the global toast state
//   - a refresh signal that increments when modals/actions report a change,
//     so subordinate pollers refetch immediately
//   - an "open add modal" signal so the topbar Add button can trigger
//     ScreensPage's modal regardless of which nav was active
//
// Hard-coded screen/activity arrays from the previous version are gone —
// every visible number now comes from the server.
export default function ScreenManager() {
  const [nav, setNav] = useState('screens');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [openAddSignal, setOpenAddSignal] = useState(0);

  const screensQ = useFetch(() => api.listScreens(), [refreshSignal]);
  const screenCount = screensQ.data?.length ?? 0;

  const network = {
    online:   (screensQ.data || []).filter(s => s.status === 'online').length,
    rotating: (screensQ.data || []).filter(s => (s.urls?.length || 0) > 1).length,
    offline:  (screensQ.data || []).filter(s => s.status === 'offline').length,
  };

  const showToast = useCallback((text) => {
    setToast({ kind: 'ok', text });
    setTimeout(() => setToast(null), 2400);
  }, []);
  const showError = useCallback((text) => {
    setToast({ kind: 'err', text });
    setTimeout(() => setToast(null), 3200);
  }, []);

  const bumpRefresh = useCallback(() => setRefreshSignal(s => s + 1), []);

  const handleAddClick = useCallback(() => {
    setNav('screens');
    setOpenAddSignal(s => s + 1);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: T.bgApp, color: T.fg1 }}>
      <Sidebar active={nav} onNav={setNav} screenCount={screenCount} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar
          search={nav === 'screens' ? search : ''}
          onSearch={setSearch}
          showSearch={nav === 'screens'}
          showAdd={nav === 'screens'}
          network={network}
          onAdd={handleAddClick}
        />

        {nav === 'screens' && (
          <ScreensPage
            search={search}
            onToast={(t) => { showToast(t); bumpRefresh(); }}
            onError={showError}
            refreshSignal={refreshSignal}
            openAddSignal={openAddSignal}
          />
        )}
        {nav === 'activity' && <ActivityPage onError={showError} />}
        {nav === 'playlists' && <PlaylistsPage onToast={showToast} onError={showError} />}
        {nav === 'schedules' && <SchedulesPage onToast={showToast} onError={showError} />}
        {nav === 'incidents' && <IncidentsPage onToast={showToast} onError={showError} />}
        {nav === 'settings'  && <SettingsPage  onToast={showToast} onError={showError} />}
      </main>

      {toast && <Toast {...toast} />}
    </div>
  );
}

function Toast({ kind, text }) {
  const isErr = kind === 'err';
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 24, right: 24,
        background: isErr ? T.statusDanger : T.arcNavy,
        color: T.fgOnDark,
        padding: '12px 18px',
        borderRadius: 999,
        fontSize: 13,
        fontFamily: T.fontDisplay, fontWeight: 700, letterSpacing: '0.04em',
        boxShadow: T.shadowMd,
        display: 'flex', alignItems: 'center', gap: 8,
        zIndex: 200,
        animation: 'arc-fade 200ms ease-out',
      }}
    >
      {isErr ? <AlertTriangle size={14} strokeWidth={2} /> : <Check size={14} strokeWidth={2} />}
      {text}
    </div>
  );
}
