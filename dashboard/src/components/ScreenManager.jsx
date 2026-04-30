import React, { useState } from 'react';
import {
  Monitor, LayoutGrid, List, Plus, RefreshCw, Edit3,
  Wifi, WifiOff, Settings, Trash2, ExternalLink, X, Check,
  Eye, AlertCircle, Activity, ArrowUp, ArrowDown,
  Repeat, Clock, LogOut
} from 'lucide-react';
import { api } from '../api.js';
import { styles, globalStyles } from './styles.js';

export function ScreenManager({ screens, activity, loading, onReload, onSignOut }) {
  const [view, setView] = useState('grid');
  const [activeNav, setActiveNav] = useState('screens');
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [editingScreen, setEditingScreen] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewScreen, setPreviewScreen] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // Helper: hydrate the current screen from the freshly polled list,
  // so modals stay in sync with server state.
  const liveScreen = (s) => screens.find(x => x.id === s?.id) || s;

  const handleSaveEdit = async (updated) => {
    try {
      await api.updateScreen(updated.id, {
        name: updated.name,
        urls: updated.urls,
        refresh: updated.refresh,
        location: updated.location,
      });
      setEditingScreen(null);
      showToast(`${updated.name} updated`);
      onReload();
    } catch (err) {
      showToast(`Save failed: ${err.message}`);
    }
  };

  const handleForceRefresh = async (id) => {
    const screen = screens.find(s => s.id === id);
    try {
      await api.forceRefresh(id);
      showToast(`Refresh sent to ${screen.name}`);
      onReload();
    } catch (err) {
      showToast(`Refresh failed: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    const screen = screens.find(s => s.id === id);
    try {
      await api.deleteScreen(id);
      setSelectedScreen(null);
      setEditingScreen(null);
      showToast(`${screen.name} removed`);
      onReload();
    } catch (err) {
      showToast(`Remove failed: ${err.message}`);
    }
  };

  const handleAdd = async (newScreen) => {
    try {
      await api.addScreen(newScreen);
      setShowAddModal(false);
      showToast(`${newScreen.name} added`);
      onReload();
    } catch (err) {
      showToast(`Add failed: ${err.message}`);
    }
  };

  const onlineCount = screens.filter(s => s.status === 'online').length;
  const offlineCount = screens.length - onlineCount;
  const rotatingCount = screens.filter(s => s.urls && s.urls.length > 1).length;

  return (
    <div style={styles.root}>
      <style>{globalStyles}</style>

      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>
          <div style={styles.brandMark}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="14" rx="1" stroke="#FAF7F2" strokeWidth="1.5"/>
              <path d="M8 18v3M16 18v3M6 21h12" stroke="#FAF7F2" strokeWidth="1.5"/>
            </svg>
          </div>
          <div>
            <p style={styles.brandText}>ARCOM</p>
            <p style={styles.brandSub}>Screen Manager</p>
          </div>
        </div>

        <nav style={styles.nav}>
          <NavItem icon={<Monitor size={16} strokeWidth={1.75} />} label="Screens" active={activeNav === 'screens'} onClick={() => setActiveNav('screens')} />
          <NavItem icon={<Activity size={16} strokeWidth={1.75} />} label="Activity" active={activeNav === 'activity'} onClick={() => setActiveNav('activity')} />
          <NavItem icon={<Settings size={16} strokeWidth={1.75} />} label="Settings" active={activeNav === 'settings'} onClick={() => setActiveNav('settings')} />
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.statusDot} />
          <div style={{flex: 1}}>
            <p style={styles.footerTitle}>Server online</p>
            <p style={styles.footerSub}>n8n.arcom · Pi 5</p>
          </div>
          <button style={styles.signOutBtn} onClick={onSignOut} title="Sign out">
            <LogOut size={14} strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main style={styles.main}>
        {activeNav === 'screens' && (
          <ScreensView
            screens={screens} loading={loading}
            onlineCount={onlineCount} offlineCount={offlineCount} rotatingCount={rotatingCount}
            view={view} setView={setView} setShowAddModal={setShowAddModal}
            setEditingScreen={setEditingScreen} handleForceRefresh={handleForceRefresh}
            setPreviewScreen={setPreviewScreen} setSelectedScreen={setSelectedScreen}
          />
        )}
        {activeNav === 'activity' && <ActivityView activity={activity} />}
        {activeNav === 'settings' && <SettingsView />}
      </main>

      {editingScreen && (
        <EditModal
          screen={liveScreen(editingScreen)}
          onSave={handleSaveEdit}
          onClose={() => setEditingScreen(null)}
          onDelete={() => handleDelete(editingScreen.id)}
        />
      )}
      {showAddModal && <AddModal onSave={handleAdd} onClose={() => setShowAddModal(false)} />}
      {previewScreen && <PreviewModal screen={liveScreen(previewScreen)} onClose={() => setPreviewScreen(null)} />}
      {selectedScreen && !editingScreen && !previewScreen && (
        <DetailDrawer
          screen={liveScreen(selectedScreen)}
          onClose={() => setSelectedScreen(null)}
          onEdit={() => setEditingScreen(selectedScreen)}
          onRefresh={() => handleForceRefresh(selectedScreen.id)}
        />
      )}
      {toast && (
        <div style={styles.toast}>
          <Check size={14} strokeWidth={2} />
          {toast}
        </div>
      )}
    </div>
  );
}

function ScreensView({ screens, loading, onlineCount, offlineCount, rotatingCount, view, setView, setShowAddModal, setEditingScreen, handleForceRefresh, setPreviewScreen, setSelectedScreen }) {
  return (
    <>
      <header style={styles.masthead}>
        <div>
          <p style={styles.eyebrow}>SCREENS · LIVE</p>
          <h1 style={styles.title}>Display network</h1>
        </div>
        <div style={styles.mastMeta}>
          <strong style={styles.metaLabel}>NETWORK</strong>
          <div style={styles.metaValue}>{onlineCount} online · {offlineCount} offline</div>
        </div>
      </header>
      <div style={styles.mastRule} />

      <div style={styles.stats}>
        <StatTile eyebrow="TOTAL SCREENS" value={screens.length} sub="across the office" />
        <StatTile eyebrow="ONLINE" value={onlineCount} sub="reporting now" tone="success" />
        <StatTile eyebrow="OFFLINE" value={offlineCount} sub="not responding" tone={offlineCount > 0 ? 'danger' : 'muted'} />
        <StatTile eyebrow="ROTATING" value={rotatingCount} sub="multi-URL screens" />
      </div>

      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <div style={styles.viewToggle}>
            <button style={{...styles.viewBtn, ...(view === 'grid' ? styles.viewBtnActive : {})}} onClick={() => setView('grid')}>
              <LayoutGrid size={14} strokeWidth={1.75} /> Grid
            </button>
            <button style={{...styles.viewBtn, ...(view === 'table' ? styles.viewBtnActive : {})}} onClick={() => setView('table')}>
              <List size={14} strokeWidth={1.75} /> Table
            </button>
          </div>
        </div>
        <button style={styles.btnPrimary} onClick={() => setShowAddModal(true)}>
          <Plus size={14} strokeWidth={2} /> Add screen
        </button>
      </div>

      {screens.length === 0 && !loading ? (
        <div style={styles.emptyState}>
          <p style={styles.emptyText}>No screens registered yet. Click "Add screen" to register your first display.</p>
        </div>
      ) : view === 'grid' ? (
        <div style={styles.grid}>
          {screens.map(s => (
            <ScreenCard key={s.id} screen={s}
              onEdit={() => setEditingScreen(s)}
              onRefresh={() => handleForceRefresh(s.id)}
              onPreview={() => setPreviewScreen(s)}
              onSelect={() => setSelectedScreen(s)}
            />
          ))}
        </div>
      ) : (
        <ScreenTable screens={screens} onEdit={setEditingScreen} onRefresh={handleForceRefresh} onPreview={setPreviewScreen} onSelect={setSelectedScreen} />
      )}
    </>
  );
}

function ActivityView({ activity }) {
  const [filter, setFilter] = useState('all');
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'edit', label: 'Edits' },
    { id: 'refresh', label: 'Refreshes' },
    { id: 'status', label: 'Status changes' },
    { id: 'screens', label: 'Add / remove' },
  ];

  const matches = (item, f) => {
    if (f === 'all') return true;
    if (f === 'status') return item.type === 'online' || item.type === 'offline';
    if (f === 'screens') return item.type === 'add' || item.type === 'remove';
    return item.type === f;
  };

  const filtered = activity.filter(a => matches(a, filter));

  return (
    <>
      <header style={styles.masthead}>
        <div>
          <p style={styles.eyebrow}>ACTIVITY · LOG</p>
          <h1 style={styles.title}>What's happened</h1>
        </div>
        <div style={styles.mastMeta}>
          <strong style={styles.metaLabel}>EVENTS</strong>
          <div style={styles.metaValue}>{activity.length} total · {filtered.length} shown</div>
        </div>
      </header>
      <div style={styles.mastRule} />

      <div style={styles.filterRow}>
        {filters.map(f => (
          <button key={f.id} style={{...styles.filterChip, ...(filter === f.id ? styles.filterChipActive : {})}} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={styles.activityList}>
        {filtered.length === 0 ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>No activity matches this filter.</p>
          </div>
        ) : (
          filtered.map(item => <ActivityRow key={item.id} item={item} />)
        )}
      </div>
    </>
  );
}

function ActivityRow({ item }) {
  const config = {
    refresh: { icon: <RefreshCw size={14} strokeWidth={1.75} />, color: '#1E5079', label: 'Refresh' },
    edit: { icon: <Edit3 size={14} strokeWidth={1.75} />, color: '#567B49', label: 'Edit' },
    online: { icon: <Wifi size={14} strokeWidth={1.75} />, color: '#7BA06A', label: 'Online' },
    offline: { icon: <WifiOff size={14} strokeWidth={1.75} />, color: '#B3432B', label: 'Offline' },
    add: { icon: <Plus size={14} strokeWidth={1.75} />, color: '#7BA06A', label: 'Added' },
    remove: { icon: <Trash2 size={14} strokeWidth={1.75} />, color: '#B3432B', label: 'Removed' },
    rotation: { icon: <Repeat size={14} strokeWidth={1.75} />, color: '#1E5079', label: 'Rotation' },
  }[item.type] || { icon: <Activity size={14} strokeWidth={1.75} />, color: '#8A8275', label: 'Event' };

  const time = item.timestamp ? formatTime(item.timestamp) : item.time;

  return (
    <div style={styles.activityRow}>
      <div style={{...styles.activityIcon, color: config.color}}>{config.icon}</div>
      <div style={styles.activityMain}>
        <div style={styles.activityTop}>
          <span style={styles.activityScreen}>{item.screen}</span>
          <span style={styles.activityType}>{config.label.toUpperCase()}</span>
        </div>
        <p style={styles.activityDetail}>{item.detail}</p>
      </div>
      <div style={styles.activityMeta}>
        <p style={styles.activityUser}>{item.user || 'system'}</p>
        <p style={styles.activityTime}>{time}</p>
      </div>
    </div>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' +
         d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function SettingsView() {
  return (
    <>
      <header style={styles.masthead}>
        <div>
          <p style={styles.eyebrow}>SYSTEM · CONFIG</p>
          <h1 style={styles.title}>Settings</h1>
        </div>
      </header>
      <div style={styles.mastRule} />
      <div style={styles.emptyState}>
        <p style={styles.emptyText}>Settings panel — coming soon.</p>
      </div>
    </>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{...styles.navItem, ...(active ? styles.navItemActive : {})}}>
      {active && <div style={styles.navAccent} />}
      <span style={{...styles.navIcon, opacity: active ? 1 : 0.7}}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function StatTile({ eyebrow, value, sub, tone = 'default' }) {
  const valueColor = { default: '#2B2A27', success: '#567B49', danger: '#B3432B', muted: '#8A8275' }[tone];
  return (
    <div style={styles.tile}>
      <p style={styles.tileEyebrow}>{eyebrow}</p>
      <p style={{...styles.tileValue, color: valueColor}}>{value}</p>
      <p style={styles.tileSub}>{sub}</p>
    </div>
  );
}

function lastSeenLabel(lastSeen) {
  if (!lastSeen) return '—';
  const d = new Date(lastSeen);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function ScreenCard({ screen, onEdit, onRefresh, onPreview, onSelect }) {
  const isOnline = screen.status === 'online';
  const isRotating = screen.urls && screen.urls.length > 1;
  const currentUrl = screen.urls?.[0] || { url: '' };
  const screenshotUrl = `/screenshots/${screen.hostname}.png?t=${screen.lastSeen || 0}`;

  return (
    <div style={styles.card}>
      <div style={styles.cardPreview} onClick={onPreview}>
        <img
          src={screenshotUrl}
          alt={screen.name}
          style={styles.cardScreenshot}
          onError={e => { e.target.style.display = 'none'; }}
        />
        <div style={{...styles.statusChip, ...(isOnline ? styles.chipOnline : styles.chipOffline)}}>
          {isOnline ? <Wifi size={10} strokeWidth={2} /> : <WifiOff size={10} strokeWidth={2} />}
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </div>
        {isRotating && (
          <div style={styles.rotationBadge}>
            <Repeat size={10} strokeWidth={2} />
            {screen.urls.length} URLS
          </div>
        )}
      </div>
      <div style={styles.cardBody}>
        <div style={styles.cardHeader}>
          <div onClick={onSelect} style={{cursor: 'pointer', flex: 1, minWidth: 0}}>
            <p style={styles.cardName}>{screen.name}</p>
            <p style={styles.cardHost}>{screen.hostname} · {screen.ip || '—'}</p>
          </div>
        </div>
        <div style={styles.cardUrlRow}>
          <ExternalLink size={11} strokeWidth={1.75} style={{flexShrink: 0, color: '#8A8275'}} />
          <span style={styles.cardUrl}>{currentUrl.url.replace(/^https?:\/\//, '')}</span>
        </div>
        <div style={styles.cardFoot}>
          <div style={styles.cardMeta}>
            {isRotating ? (
              <><Repeat size={10} strokeWidth={1.75} /><span>Rotating · {screen.urls.length} URLs</span></>
            ) : (
              <><Clock size={10} strokeWidth={1.75} /><span>Refresh: {screen.refresh}m</span></>
            )}
            <span style={styles.cardMetaDot}>·</span>
            <span>Seen {lastSeenLabel(screen.lastSeen)}</span>
          </div>
        </div>
        <div style={styles.cardActions}>
          <button style={styles.btnGhost} onClick={onRefresh}>
            <RefreshCw size={12} strokeWidth={1.75} /> Refresh
          </button>
          <button style={styles.btnGhost} onClick={onEdit}>
            <Edit3 size={12} strokeWidth={1.75} /> Edit
          </button>
        </div>
      </div>
    </div>
  );
}

function ScreenTable({ screens, onEdit, onRefresh, onPreview, onSelect }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>SCREEN</th>
            <th style={styles.th}>HOSTNAME</th>
            <th style={styles.th}>URL</th>
            <th style={{...styles.th, ...styles.thNum}}>REFRESH</th>
            <th style={styles.th}>STATUS</th>
            <th style={{...styles.th, ...styles.thNum}}>LAST SEEN</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {screens.map(s => {
            const isOnline = s.status === 'online';
            const isRotating = s.urls && s.urls.length > 1;
            return (
              <tr key={s.id} style={styles.tr}>
                <td style={styles.td}>
                  <button style={styles.linkBtn} onClick={() => onSelect(s)}>{s.name}</button>
                </td>
                <td style={{...styles.td, ...styles.tdMono}}>{s.hostname}</td>
                <td style={{...styles.td, ...styles.tdMono, ...styles.tdUrl}}>
                  {isRotating ? (
                    <span style={styles.rotationInline}>
                      <Repeat size={11} strokeWidth={1.75} /> {s.urls.length} URLs rotating
                    </span>
                  ) : (
                    s.urls?.[0]?.url.replace(/^https?:\/\//, '') || '—'
                  )}
                </td>
                <td style={{...styles.td, ...styles.tdNum}}>{s.refresh}m</td>
                <td style={styles.td}>
                  <span style={{...styles.statusChipInline, ...(isOnline ? styles.chipOnline : styles.chipOffline)}}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </td>
                <td style={{...styles.td, ...styles.tdNum}}>{lastSeenLabel(s.lastSeen)}</td>
                <td style={{...styles.td, textAlign: 'right'}}>
                  <div style={styles.tableActions}>
                    <button style={styles.iconBtn} onClick={() => onPreview(s)} title="Preview">
                      <Eye size={14} strokeWidth={1.75} />
                    </button>
                    <button style={styles.iconBtn} onClick={() => onRefresh(s.id)} title="Force refresh">
                      <RefreshCw size={14} strokeWidth={1.75} />
                    </button>
                    <button style={styles.iconBtn} onClick={() => onEdit(s)} title="Edit">
                      <Edit3 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EditModal({ screen, onSave, onClose, onDelete }) {
  const [name, setName] = useState(screen.name);
  const [urls, setUrls] = useState(screen.urls || []);
  const [refresh, setRefresh] = useState(screen.refresh);
  const [location, setLocation] = useState(screen.location);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateUrl = (i, patch) => setUrls(urls.map((u, idx) => idx === i ? { ...u, ...patch } : u));
  const addUrl = () => setUrls([...urls, { url: 'https://arcom.site/', duration: 30 }]);
  const removeUrl = (i) => setUrls(urls.filter((_, idx) => idx !== i));
  const moveUrl = (i, dir) => {
    const next = [...urls];
    const target = i + dir;
    if (target < 0 || target >= urls.length) return;
    [next[i], next[target]] = [next[target], next[i]];
    setUrls(next);
  };

  const handleSave = () => {
    onSave({ ...screen, name, urls, refresh, location });
  };

  const isRotating = urls.length > 1;

  return (
    <div style={styles.modalScrim} onClick={onClose}>
      <div style={{...styles.modal, maxWidth: 620}} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <div>
            <p style={styles.eyebrow}>EDIT SCREEN</p>
            <h2 style={styles.modalTitle}>{screen.name}</h2>
          </div>
          <button style={styles.modalClose} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <Field label="Name">
            <input style={styles.input} value={name} onChange={e => setName(e.target.value)} />
          </Field>

          <div>
            <div style={styles.urlsHeader}>
              <label style={styles.fieldLabel}>{isRotating ? `URL Rotation (${urls.length})` : 'URL'}</label>
              {isRotating && (
                <span style={styles.rotationHint}>
                  <Repeat size={10} strokeWidth={2} /> Cycles through in order
                </span>
              )}
            </div>
            <div style={styles.urlsList}>
              {urls.map((u, i) => (
                <div key={i} style={styles.urlRow}>
                  {isRotating && (
                    <div style={styles.urlOrder}>
                      <span style={styles.urlOrderNum}>{i + 1}</span>
                    </div>
                  )}
                  <div style={styles.urlInputs}>
                    <input style={{...styles.input, ...styles.urlInput}} value={u.url}
                      onChange={e => updateUrl(i, { url: e.target.value })}
                      placeholder="https://arcom.site/dashboard/..." />
                    {isRotating && (
                      <div style={styles.durationField}>
                        <input type="number" style={{...styles.input, ...styles.durationInput}}
                          value={u.duration}
                          onChange={e => updateUrl(i, { duration: parseInt(e.target.value) || 0 })}
                          min="5" />
                        <span style={styles.durationLabel}>sec</span>
                      </div>
                    )}
                  </div>
                  {isRotating && (
                    <div style={styles.urlControls}>
                      <button style={styles.urlIconBtn} onClick={() => moveUrl(i, -1)} disabled={i === 0} title="Move up">
                        <ArrowUp size={12} strokeWidth={1.75} />
                      </button>
                      <button style={styles.urlIconBtn} onClick={() => moveUrl(i, 1)} disabled={i === urls.length - 1} title="Move down">
                        <ArrowDown size={12} strokeWidth={1.75} />
                      </button>
                      <button style={{...styles.urlIconBtn, color: '#B3432B'}} onClick={() => removeUrl(i)} title="Remove URL">
                        <X size={14} strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button style={styles.btnGhostSm} onClick={addUrl}>
              <Plus size={12} strokeWidth={2} />
              {isRotating ? 'Add another URL' : 'Add second URL (start rotation)'}
            </button>
          </div>

          <Field label={isRotating ? 'Page reload interval (minutes)' : 'Refresh interval (minutes)'}>
            <input type="number" style={styles.input} value={refresh}
              onChange={e => setRefresh(parseInt(e.target.value) || 0)} />
            <p style={styles.fieldHint}>
              {isRotating
                ? 'How often each page reloads to pull fresh data. Rotation timing is set per-URL above.'
                : 'How often the page reloads to pull fresh data.'}
            </p>
          </Field>

          <Field label="Location">
            <input style={styles.input} value={location || ''} onChange={e => setLocation(e.target.value)} />
          </Field>

          <div style={styles.metaCard}>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>Hostname</span>
              <span style={styles.metaCardVal}>{screen.hostname}</span>
            </div>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>IP address</span>
              <span style={styles.metaCardVal}>{screen.ip || '—'}</span>
            </div>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>Last seen</span>
              <span style={styles.metaCardVal}>{lastSeenLabel(screen.lastSeen)}</span>
            </div>
          </div>
        </div>

        <div style={styles.modalFoot}>
          {!confirmDelete ? (
            <button style={styles.btnDangerGhost} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} strokeWidth={1.75} /> Remove screen
            </button>
          ) : (
            <div style={styles.confirmRow}>
              <span style={styles.confirmText}>Remove permanently?</span>
              <button style={styles.btnGhost} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button style={styles.btnDanger} onClick={onDelete}>Yes, remove</button>
            </div>
          )}
          <div style={styles.footRight}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={styles.btnPrimary} onClick={handleSave}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [ip, setIp] = useState('');
  const [url, setUrl] = useState('https://arcom.site/');
  const [refresh, setRefresh] = useState(10);
  const [location, setLocation] = useState('');
  const canSave = name && hostname && url;

  return (
    <div style={styles.modalScrim} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <div>
            <p style={styles.eyebrow}>NEW SCREEN</p>
            <h2 style={styles.modalTitle}>Register a display</h2>
          </div>
          <button style={styles.modalClose} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div style={styles.modalBody}>
          <Field label="Name">
            <input style={styles.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Workshop floor" />
          </Field>
          <div style={styles.fieldRow}>
            <Field label="Hostname">
              <input style={styles.input} value={hostname} onChange={e => setHostname(e.target.value)} placeholder="pi-workshop" />
            </Field>
            <Field label="IP address (optional)">
              <input style={styles.input} value={ip} onChange={e => setIp(e.target.value)} placeholder="auto-detected" />
            </Field>
          </div>
          <Field label="URL">
            <input style={styles.input} value={url} onChange={e => setUrl(e.target.value)} />
            <p style={styles.fieldHint}>Add a single URL to start. Rotation can be configured after the screen is registered.</p>
          </Field>
          <Field label="Refresh interval (minutes)">
            <input type="number" style={styles.input} value={refresh} onChange={e => setRefresh(parseInt(e.target.value) || 0)} />
          </Field>
          <Field label="Location">
            <input style={styles.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="Where is this screen mounted?" />
          </Field>
          <div style={styles.helperBanner}>
            <AlertCircle size={14} strokeWidth={1.75} style={{flexShrink: 0, color: '#567B49'}} />
            <span>The Pi must be flashed with the Arcom kiosk image and on the office network. The hostname must match the Pi's actual hostname. It will appear online once it phones home.</span>
          </div>
        </div>

        <div style={styles.modalFoot}>
          <div />
          <div style={styles.footRight}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={{...styles.btnPrimary, ...(canSave ? {} : styles.btnDisabled)}} disabled={!canSave}
              onClick={() => canSave && onSave({ name, hostname, ip, urls: [{ url, duration: 60 }], refresh, location })}>
              Add screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ screen, onClose }) {
  const [activeUrlIdx, setActiveUrlIdx] = useState(0);
  const isRotating = screen.urls && screen.urls.length > 1;
  const activeUrl = screen.urls?.[activeUrlIdx];
  const screenshotUrl = `/screenshots/${screen.hostname}.png?t=${screen.lastSeen || 0}`;

  return (
    <div style={styles.modalScrim} onClick={onClose}>
      <div style={{...styles.modal, maxWidth: 880}} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHead}>
          <div>
            <p style={styles.eyebrow}>LIVE PREVIEW</p>
            <h2 style={styles.modalTitle}>{screen.name}</h2>
          </div>
          <button style={styles.modalClose} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div style={styles.previewBody}>
          {isRotating && (
            <div style={styles.rotationTabs}>
              {screen.urls.map((u, i) => (
                <button key={i} style={{...styles.rotationTab, ...(i === activeUrlIdx ? styles.rotationTabActive : {})}}
                  onClick={() => setActiveUrlIdx(i)}>
                  <span style={styles.rotationTabNum}>{i + 1}</span>
                  <span>{u.url.split('/').pop() || 'home'}</span>
                  <span style={styles.rotationTabDuration}>{u.duration}s</span>
                </button>
              ))}
            </div>
          )}
          <div style={styles.previewFrame}>
            <img src={screenshotUrl} alt={screen.name} style={styles.previewImage}
              onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <p style={styles.previewCaption}>
            Last screenshot captured at {lastSeenLabel(screen.lastSeen)} from {activeUrl?.url.replace(/^https?:\/\//, '') || '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ screen, onClose, onEdit, onRefresh }) {
  const isRotating = screen.urls && screen.urls.length > 1;
  return (
    <div style={styles.drawerScrim} onClick={onClose}>
      <div style={styles.drawer} onClick={e => e.stopPropagation()}>
        <div style={styles.drawerHead}>
          <div>
            <p style={styles.eyebrow}>SCREEN DETAIL</p>
            <h2 style={styles.modalTitle}>{screen.name}</h2>
          </div>
          <button style={styles.modalClose} onClick={onClose}>
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <div style={styles.drawerBody}>
          <DetailRow k="Status" v={
            <span style={{...styles.statusChipInline, ...(screen.status === 'online' ? styles.chipOnline : styles.chipOffline)}}>
              {(screen.status || 'offline').toUpperCase()}
            </span>
          } />
          <DetailRow k="Hostname" v={screen.hostname} mono />
          <DetailRow k="IP address" v={screen.ip || '—'} mono />
          <DetailRow k="Mode" v={isRotating ? `Rotating · ${screen.urls.length} URLs` : 'Single URL'} />
          {isRotating ? (
            <div style={styles.rotationDetail}>
              <p style={styles.rotationDetailHead}>URL ROTATION</p>
              {screen.urls.map((u, i) => (
                <div key={i} style={styles.rotationDetailRow}>
                  <span style={styles.rotationDetailNum}>{i + 1}</span>
                  <span style={styles.rotationDetailUrl}>{u.url.replace(/^https?:\/\//, '')}</span>
                  <span style={styles.rotationDetailDur}>{u.duration}s</span>
                </div>
              ))}
            </div>
          ) : (
            <DetailRow k="URL" v={screen.urls?.[0]?.url.replace(/^https?:\/\//, '') || '—'} mono />
          )}
          <DetailRow k="Reload interval" v={`${screen.refresh} minutes`} />
          <DetailRow k="Last seen" v={lastSeenLabel(screen.lastSeen)} mono />
          <DetailRow k="Location" v={screen.location || '—'} />
        </div>
        <div style={styles.drawerFoot}>
          <button style={styles.btnGhost} onClick={onRefresh}>
            <RefreshCw size={14} strokeWidth={1.75} /> Force refresh
          </button>
          <button style={styles.btnPrimary} onClick={onEdit}>
            <Edit3 size={14} strokeWidth={1.75} /> Edit settings
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function DetailRow({ k, v, mono }) {
  return (
    <div style={styles.detailRow}>
      <span style={styles.detailKey}>{k}</span>
      <span style={{...styles.detailVal, ...(mono ? styles.detailValMono : {})}}>{v}</span>
    </div>
  );
}
