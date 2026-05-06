import React, { useState, useMemo, useEffect } from 'react';
import { LayoutGrid, List, AlertTriangle, Bell, Terminal, Plus } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { usePolling } from '../../hooks/useFetch.js';
import { MetricCard } from '../screens/MetricCard.jsx';
import { ScreenTile } from '../screens/ScreenTile.jsx';
import { ScreenTable } from '../screens/ScreenTable.jsx';
import { DrillPanel } from '../screens/DrillPanel.jsx';
import { AddScreenModal } from '../screens/AddScreenModal.jsx';
import { EditScreenModal } from '../screens/EditScreenModal.jsx';

const POLL_MS = 15000;

export function ScreensPage({ search, onToast, onError, refreshSignal, openAddSignal }) {
  const screensQ = usePolling(() => api.listScreens(), POLL_MS, [refreshSignal]);
  const summaryQ = usePolling(() => api.networkSummary(), POLL_MS, [refreshSignal]);

  const [view, setView] = useState('grid');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  // Topbar's Add button triggers an incrementing signal; open the modal
  // when it changes (skip the initial 0 → no-modal-on-mount).
  useEffect(() => {
    if (openAddSignal) setShowAdd(true);
  }, [openAddSignal]);

  const screens = screensQ.data || [];
  const summary = summaryQ.data || { counts: { total: 0, online: 0, offline: 0, rotating: 0 }, history: {}, uptimePct7d: 100 };
  const counts = summary.counts;

  // Apply status filter then search
  const filtered = useMemo(() => {
    let list = screens;
    if (filter !== 'all') list = list.filter(s => s.status === filter || (filter === 'rotating' && s.urls?.length > 1));
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.location || '').toLowerCase().includes(q) ||
        (s.hostname || '').toLowerCase().includes(q) ||
        (s.currentUrl || '').toLowerCase().includes(q) ||
        (s.urls || []).some(u => (u.url || '').toLowerCase().includes(q))
      );
    }
    return list;
  }, [screens, filter, search]);

  const offlineNames = screens.filter(s => s.status === 'offline').map(s => s.name);
  const lastOfflineSeen = screens.find(s => s.status === 'offline')?.lastSeen;

  async function handleForceRefresh(screen) {
    try {
      await api.refreshScreen(screen.id);
      onToast?.(`Refresh queued for ${screen.name}`);
      screensQ.refetch();
    } catch (err) {
      onError?.(err.message || 'Could not send refresh');
    }
  }

  function handleAdded(created) {
    setShowAdd(false);
    onToast?.(`${created.name} added`);
    screensQ.refetch();
    summaryQ.refetch();
  }

  function handleSaved(updated) {
    setEditing(null);
    onToast?.(`${updated.name} updated`);
    screensQ.refetch();
    if (selected && selected.id === updated.id) setSelected(updated);
  }

  function handleDeleted(id) {
    const removed = screens.find(s => s.id === id);
    setSelected(null);
    setEditing(null);
    onToast?.(removed ? `${removed.name} removed` : 'Screen removed');
    screensQ.refetch();
    summaryQ.refetch();
  }

  // Empty install
  if (!screensQ.loading && screens.length === 0) {
    return (
      <Content>
        <PageHead counts={counts} summary={summary} />
        <EmptyInstall onAdd={() => setShowAdd(true)} />
        {showAdd && <AddScreenModal onClose={() => setShowAdd(false)} onAdded={handleAdded} onError={onError} />}
      </Content>
    );
  }

  return (
    <Content>
      <PageHead counts={counts} summary={summary} />

      {counts.offline > 0 && (
        <IncidentBar
          offlineCount={counts.offline}
          offlineNames={offlineNames}
          lastSeen={lastOfflineSeen}
          onDiagnose={() => {
            const first = screens.find(s => s.status === 'offline');
            if (first) setSelected(first);
          }}
          onAlert={() => onToast?.('Team alerts arrive in Phase 2')}
        />
      )}

      {/* Hero metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <MetricCard
          label="TOTAL SCREENS"
          value={counts.total}
          sub={`${distinctSites(screens)} sites`}
          history={summary.history?.total}
          kind="bar"
          accent="navy"
        />
        <MetricCard
          label="ONLINE"
          value={counts.online}
          sub={`of ${counts.total} reporting · ${summary.uptimePct7d}% 7d`}
          history={summary.history?.online}
          accent="sage"
        />
        <MetricCard
          label="OFFLINE"
          value={counts.offline}
          sub={offlineNames.length ? offlineNames.slice(0, 2).join(' · ') : 'all healthy'}
          history={summary.history?.offline}
          kind="bar"
          accent="danger"
          tone={counts.offline > 0 ? 'danger' : 'default'}
        />
        <MetricCard
          label="ROTATING"
          value={counts.rotating}
          sub={`${counts.rotating} multi-URL screens`}
          history={summary.history?.rotating}
          accent="yellow"
        />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <FilterChips value={filter} onChange={setFilter} counts={counts} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontFamily: T.fontMono, fontSize: 11.5, color: T.fg3 }}>
            {filtered.length} of {counts.total} shown
          </span>
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      {/* Grid or table */}
      {filtered.length === 0 ? (
        <NoMatches onClear={() => setFilter('all')} hasSearch={!!search} />
      ) : view === 'grid' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {filtered.map(s => (
            <ScreenTile
              key={s.id}
              screen={s}
              onSelect={setSelected}
              onEdit={setEditing}
              onRefresh={handleForceRefresh}
            />
          ))}
        </div>
      ) : (
        <ScreenTable
          screens={filtered}
          onSelect={setSelected}
          onEdit={setEditing}
          onRefresh={handleForceRefresh}
        />
      )}

      {selected && !editing && (
        <DrillPanel
          screen={selected}
          onClose={() => setSelected(null)}
          onEdit={(s) => { setSelected(null); setEditing(s); }}
          onRefresh={handleForceRefresh}
          onDeleted={handleDeleted}
          onError={onError}
        />
      )}

      {editing && (
        <EditScreenModal
          screen={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onError={onError}
        />
      )}

      {showAdd && (
        <AddScreenModal
          onClose={() => setShowAdd(false)}
          onAdded={handleAdded}
          onError={onError}
        />
      )}
    </Content>
  );
}

function Content({ children }) {
  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {children}
    </div>
  );
}

function PageHead({ counts, summary }) {
  const healthColor = counts.offline > 0 ? T.statusWarn : T.statusOk;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
        }}>
          Screens · {counts.total} device{counts.total === 1 ? '' : 's'} · Live
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
          color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
        }}>
          Display network
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.fg2 }}>
          Auto-refreshing every 15s
        </p>
        <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
      </div>

      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
        }}>
          Network health
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 28,
            color: healthColor, fontVariantNumeric: 'tabular-nums',
          }}>
            {Math.round(summary.uptimePct7d)}%
          </span>
          <span style={{ fontFamily: T.fontMono, fontSize: 12, color: T.fg3 }}>uptime · 7d</span>
        </div>
      </div>
    </div>
  );
}

function IncidentBar({ offlineCount, offlineNames, lastSeen, onDiagnose, onAlert }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '12px 18px',
      background: 'linear-gradient(90deg, #002B49 0%, #0A3A5C 100%)',
      borderRadius: 12,
      color: T.fgOnDark,
      boxShadow: T.shadowSm,
    }}>
      <span style={{
        background: T.arcYellow, color: T.arcNavy,
        fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 10,
        letterSpacing: '0.14em', padding: '4px 10px', borderRadius: 999,
      }}>ATTENTION</span>
      <div style={{ flex: 1, fontSize: 13.5, minWidth: 0 }}>
        <b style={{ color: T.arcYellow }}>
          {offlineCount} screen{offlineCount > 1 ? 's' : ''} offline.
        </b>
        <span style={{ opacity: 0.85, marginLeft: 8 }}>
          {offlineNames.slice(0, 3).join(' · ')}{offlineNames.length > 3 ? ` +${offlineNames.length - 3} more` : ''}
          {lastSeen && <> · last contact {timeAgo(lastSeen)}</>}
        </span>
      </div>
      <button
        onClick={onDiagnose}
        style={incidentBtnStyle()}
      >
        <Terminal size={13} strokeWidth={1.75} /> DIAGNOSE
      </button>
      <button
        onClick={onAlert}
        style={incidentBtnStyle({ filled: true })}
      >
        <Bell size={13} strokeWidth={1.75} /> ALERT TEAM
      </button>
    </div>
  );
}

function incidentBtnStyle({ filled } = {}) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    border: filled ? `1px solid ${T.arcYellow}` : '1px solid rgba(250,247,242,0.30)',
    background: filled ? T.arcYellow : 'transparent',
    color: filled ? T.arcNavy : T.fgOnDark,
    borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
  };
}

function FilterChips({ value, onChange, counts }) {
  const items = [
    { id: 'all',      label: 'All',      n: counts.total },
    { id: 'online',   label: 'Online',   n: counts.online },
    { id: 'offline',  label: 'Offline',  n: counts.offline },
    { id: 'rotating', label: 'Rotating', n: counts.rotating },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(it => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 13px',
              borderRadius: 999,
              background: active ? T.arcNavy : 'transparent',
              color: active ? T.fgOnDark : T.fg2,
              border: `1px solid ${active ? T.arcNavy : T.line2}`,
              fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            {it.label}
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: active ? 'rgba(250,247,242,0.7)' : T.fg3,
            }}>{it.n}</span>
          </button>
        );
      })}
    </div>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      background: T.bgSurfaceAlt,
      borderRadius: 999,
      padding: 3,
      border: `1px solid ${T.line1}`,
    }}>
      {[
        { id: 'grid',  Icon: LayoutGrid, label: 'Grid' },
        { id: 'table', Icon: List,       label: 'Table' },
      ].map(({ id, Icon, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              padding: '7px 14px', fontSize: 12, fontWeight: 700,
              fontFamily: T.fontDisplay, letterSpacing: '0.04em',
              color: active ? T.fgBrand : T.fg3,
              background: active ? T.bgSurface : 'transparent',
              borderRadius: 999,
              boxShadow: active ? T.shadowXs : 'none',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Icon size={13} strokeWidth={1.75} /> {label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyInstall({ onAdd }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px dashed ${T.line2}`,
      borderRadius: 14,
      padding: '64px 24px',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <AlertTriangle size={32} strokeWidth={1.5} color={T.arcSage} />
      <div style={{
        fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, color: T.fgBrand,
      }}>
        No screens registered yet
      </div>
      <p style={{ margin: 0, fontSize: 13, color: T.fg3, maxWidth: 380 }}>
        Pair your first Pi 3 kiosk to start showing dashboards across the office.
        Heartbeats and screenshots will populate this view automatically.
      </p>
      <button
        onClick={onAdd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          marginTop: 6,
          padding: '12px 22px',
          background: T.arcNavy, color: T.fgOnDark,
          border: 'none', borderRadius: 999,
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
        }}
      >
        <Plus size={14} strokeWidth={2} /> Register your first screen
      </button>
    </div>
  );
}

function NoMatches({ onClear, hasSearch }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 14,
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <p style={{ margin: 0, color: T.fg3, fontSize: 13.5 }}>
        {hasSearch ? 'No screens match this search.' : 'No screens match this filter.'}
      </p>
      <button
        onClick={onClear}
        style={{
          marginTop: 10,
          padding: '8px 16px',
          background: 'transparent', color: T.fgBrand,
          border: `1px solid ${T.line2}`, borderRadius: 999,
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.06em',
        }}
      >
        Clear filter
      </button>
    </div>
  );
}

function distinctSites(screens) {
  const sites = new Set();
  for (const s of screens) {
    const loc = (s.location || '').split('·')[0].trim();
    if (loc) sites.add(loc);
  }
  return sites.size || 1;
}

function timeAgo(ts) {
  if (!ts) return '—';
  const t = new Date(ts).getTime();
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
