import React, { useState } from 'react';
import {
  Monitor, LayoutGrid, List, Plus, RefreshCw, Edit3,
  Wifi, WifiOff, Settings, Trash2, ExternalLink, X, Check,
  Eye, AlertCircle, Activity, ArrowUp, ArrowDown,
  Repeat, Clock
} from 'lucide-react';

export default function ScreenManager() {
  const [view, setView] = useState('grid');
  const [activeNav, setActiveNav] = useState('screens');
  const [selectedScreen, setSelectedScreen] = useState(null);
  const [editingScreen, setEditingScreen] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewScreen, setPreviewScreen] = useState(null);
  const [toast, setToast] = useState(null);

  const [screens, setScreens] = useState([
    {
      id: 'screen-01',
      name: 'Workshop Floor',
      hostname: 'pi-workshop',
      ip: '192.168.1.121',
      urls: [
        { url: 'https://arcom.site/dashboard/production', duration: 30 },
        { url: 'https://arcom.site/dashboard/jobs', duration: 20 },
      ],
      refresh: 10,
      status: 'online',
      lastSeen: '14:32',
      uptime: '4d 12h',
      location: 'Main workshop, north wall',
    },
    {
      id: 'screen-02',
      name: 'Sales Office',
      hostname: 'pi-sales',
      ip: '192.168.1.122',
      urls: [
        { url: 'https://arcom.site/dashboard/sales', duration: 60 },
      ],
      refresh: 15,
      status: 'online',
      lastSeen: '14:31',
      uptime: '12d 03h',
      location: 'Sales desk, behind Tayla',
    },
    {
      id: 'screen-03',
      name: 'Reception KPIs',
      hostname: 'pi-reception',
      ip: '192.168.1.123',
      urls: [
        { url: 'https://arcom.site/dashboard/kpi', duration: 60 },
      ],
      refresh: 30,
      status: 'offline',
      lastSeen: '09:15',
      uptime: '—',
      location: 'Reception, above front desk',
    },
    {
      id: 'screen-04',
      name: 'Lunch Room',
      hostname: 'pi-lunchroom',
      ip: '192.168.1.124',
      urls: [
        { url: 'https://arcom.site/dashboard/team', duration: 45 },
        { url: 'https://arcom.site/dashboard/birthdays', duration: 15 },
        { url: 'https://arcom.site/dashboard/safety', duration: 30 },
      ],
      refresh: 10,
      status: 'online',
      lastSeen: '14:32',
      uptime: '2d 18h',
      location: 'Lunch room, mounted above fridge',
    },
  ]);

  const [activity, setActivity] = useState([
    { id: 1, type: 'refresh', screen: 'Workshop Floor', user: 'Chuck', time: '14:32', detail: 'Force refresh sent' },
    { id: 2, type: 'offline', screen: 'Reception KPIs', user: 'system', time: '09:15', detail: 'Stopped responding' },
    { id: 3, type: 'edit', screen: 'Sales Office', user: 'Chuck', time: 'Yesterday 16:48', detail: 'Refresh interval: 30m → 15m' },
    { id: 4, type: 'rotation', screen: 'Lunch Room', user: 'Chuck', time: 'Yesterday 11:22', detail: 'Added URL: dashboard/safety (30s)' },
    { id: 5, type: 'online', screen: 'Workshop Floor', user: 'system', time: 'Mon 28 Apr · 08:12', detail: 'Came online' },
    { id: 6, type: 'add', screen: 'Lunch Room', user: 'Chuck', time: 'Fri 25 Apr · 14:08', detail: 'Screen registered' },
    { id: 7, type: 'edit', screen: 'Workshop Floor', user: 'Chuck', time: 'Fri 25 Apr · 10:30', detail: 'Started rotation: production + jobs' },
  ]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const logActivity = (entry) => {
    setActivity(prev => [
      { id: Date.now(), time: 'Just now', user: 'Chuck', ...entry },
      ...prev,
    ]);
  };

  const handleSaveEdit = (updated, changes) => {
    setScreens(screens.map(s => s.id === updated.id ? updated : s));
    setEditingScreen(null);
    if (changes && changes.length > 0) {
      changes.forEach(c => logActivity({ type: 'edit', screen: updated.name, detail: c }));
    }
    showToast(`${updated.name} updated`);
  };

  const handleForceRefresh = (id) => {
    const screen = screens.find(s => s.id === id);
    logActivity({ type: 'refresh', screen: screen.name, detail: 'Force refresh sent' });
    showToast(`Refresh sent to ${screen.name}`);
  };

  const handleDelete = (id) => {
    const screen = screens.find(s => s.id === id);
    setScreens(screens.filter(s => s.id !== id));
    setSelectedScreen(null);
    setEditingScreen(null);
    logActivity({ type: 'remove', screen: screen.name, detail: 'Screen removed' });
    showToast(`${screen.name} removed`);
  };

  const handleAdd = (newScreen) => {
    const id = `screen-${String(screens.length + 1).padStart(2, '0')}`;
    const screen = { ...newScreen, id, status: 'offline', lastSeen: '—', uptime: '—' };
    setScreens([...screens, screen]);
    setShowAddModal(false);
    logActivity({ type: 'add', screen: newScreen.name, detail: 'Screen registered' });
    showToast(`${newScreen.name} added`);
  };

  const onlineCount = screens.filter(s => s.status === 'online').length;
  const offlineCount = screens.length - onlineCount;
  const rotatingCount = screens.filter(s => s.urls.length > 1).length;

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
          <div>
            <p style={styles.footerTitle}>Server online</p>
            <p style={styles.footerSub}>n8n.arcom · Pi 5</p>
          </div>
        </div>
      </aside>

      <main style={styles.main}>
        {activeNav === 'screens' && (
          <ScreensView
            screens={screens} onlineCount={onlineCount} offlineCount={offlineCount} rotatingCount={rotatingCount}
            view={view} setView={setView} setShowAddModal={setShowAddModal}
            setEditingScreen={setEditingScreen} handleForceRefresh={handleForceRefresh}
            setPreviewScreen={setPreviewScreen} setSelectedScreen={setSelectedScreen}
          />
        )}
        {activeNav === 'activity' && <ActivityView activity={activity} />}
        {activeNav === 'settings' && <SettingsView />}
      </main>

      {editingScreen && (
        <EditModal screen={editingScreen} onSave={handleSaveEdit} onClose={() => setEditingScreen(null)} onDelete={() => handleDelete(editingScreen.id)} />
      )}
      {showAddModal && <AddModal onSave={handleAdd} onClose={() => setShowAddModal(false)} />}
      {previewScreen && <PreviewModal screen={previewScreen} onClose={() => setPreviewScreen(null)} />}
      {selectedScreen && !editingScreen && !previewScreen && (
        <DetailDrawer screen={selectedScreen} onClose={() => setSelectedScreen(null)} onEdit={() => setEditingScreen(selectedScreen)} onRefresh={() => handleForceRefresh(selectedScreen.id)} />
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

function ScreensView({ screens, onlineCount, offlineCount, rotatingCount, view, setView, setShowAddModal, setEditingScreen, handleForceRefresh, setPreviewScreen, setSelectedScreen }) {
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

      {view === 'grid' ? (
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
        <p style={styles.activityUser}>{item.user}</p>
        <p style={styles.activityTime}>{item.time}</p>
      </div>
    </div>
  );
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

function ScreenCard({ screen, onEdit, onRefresh, onPreview, onSelect }) {
  const isOnline = screen.status === 'online';
  const isRotating = screen.urls.length > 1;
  const currentUrl = screen.urls[0];

  return (
    <div style={styles.card}>
      <div style={styles.cardPreview} onClick={onPreview}>
        <div style={styles.cardPreviewMock}>
          <div style={styles.mockBar} />
          <div style={{...styles.mockBar, width: '60%'}} />
          <div style={styles.mockGrid}>
            <div style={styles.mockCell} />
            <div style={styles.mockCell} />
            <div style={styles.mockCell} />
            <div style={styles.mockCell} />
          </div>
        </div>
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
            <p style={styles.cardHost}>{screen.hostname} · {screen.ip}</p>
          </div>
        </div>
        <div style={styles.cardUrlRow}>
          <ExternalLink size={11} strokeWidth={1.75} style={{flexShrink: 0, color: '#8A8275'}} />
          <span style={styles.cardUrl}>{currentUrl.url.replace('https://', '')}</span>
        </div>
        <div style={styles.cardFoot}>
          <div style={styles.cardMeta}>
            {isRotating ? (
              <>
                <Repeat size={10} strokeWidth={1.75} />
                <span>Rotating · {screen.urls.length} URLs</span>
              </>
            ) : (
              <>
                <Clock size={10} strokeWidth={1.75} />
                <span>Refresh: {screen.refresh}m</span>
              </>
            )}
            <span style={styles.cardMetaDot}>·</span>
            <span>Seen {screen.lastSeen}</span>
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
            const isRotating = s.urls.length > 1;
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
                    s.urls[0].url.replace('https://', '')
                  )}
                </td>
                <td style={{...styles.td, ...styles.tdNum}}>{s.refresh}m</td>
                <td style={styles.td}>
                  <span style={{...styles.statusChipInline, ...(isOnline ? styles.chipOnline : styles.chipOffline)}}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </td>
                <td style={{...styles.td, ...styles.tdNum}}>{s.lastSeen}</td>
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
  const [urls, setUrls] = useState(screen.urls);
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
    const changes = [];
    if (name !== screen.name) changes.push(`Name: ${screen.name} → ${name}`);
    if (refresh !== screen.refresh) changes.push(`Refresh interval: ${screen.refresh}m → ${refresh}m`);
    if (location !== screen.location) changes.push('Location updated');
    if (urls.length !== screen.urls.length) changes.push(`URL count: ${screen.urls.length} → ${urls.length}`);
    else if (JSON.stringify(urls) !== JSON.stringify(screen.urls)) changes.push('URLs/durations updated');
    onSave({ ...screen, name, urls, refresh, location }, changes);
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
              <label style={styles.fieldLabel}>
                {isRotating ? `URL Rotation (${urls.length})` : 'URL'}
              </label>
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
                    <input
                      style={{...styles.input, ...styles.urlInput}}
                      value={u.url}
                      onChange={e => updateUrl(i, { url: e.target.value })}
                      placeholder="https://arcom.site/dashboard/..."
                    />
                    {isRotating && (
                      <div style={styles.durationField}>
                        <input
                          type="number"
                          style={{...styles.input, ...styles.durationInput}}
                          value={u.duration}
                          onChange={e => updateUrl(i, { duration: parseInt(e.target.value) || 0 })}
                          min="5"
                        />
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
            <input type="number" style={styles.input} value={refresh} onChange={e => setRefresh(parseInt(e.target.value) || 0)} />
            <p style={styles.fieldHint}>
              {isRotating
                ? 'How often each page reloads to pull fresh data. Rotation timing is set per-URL above.'
                : 'How often the page reloads to pull fresh data.'}
            </p>
          </Field>

          <Field label="Location">
            <input style={styles.input} value={location} onChange={e => setLocation(e.target.value)} />
          </Field>

          <div style={styles.metaCard}>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>Hostname</span>
              <span style={styles.metaCardVal}>{screen.hostname}</span>
            </div>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>IP address</span>
              <span style={styles.metaCardVal}>{screen.ip}</span>
            </div>
            <div style={styles.metaCardRow}>
              <span style={styles.metaCardKey}>Uptime</span>
              <span style={styles.metaCardVal}>{screen.uptime}</span>
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
            <Field label="IP address">
              <input style={styles.input} value={ip} onChange={e => setIp(e.target.value)} placeholder="192.168.1.xxx" />
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
            <span>The Pi must be flashed with the Arcom kiosk image and on the office network. It will appear online once it phones home.</span>
          </div>
        </div>

        <div style={styles.modalFoot}>
          <div />
          <div style={styles.footRight}>
            <button style={styles.btnGhost} onClick={onClose}>Cancel</button>
            <button style={{...styles.btnPrimary, ...(canSave ? {} : styles.btnDisabled)}} disabled={!canSave} onClick={() => canSave && onSave({ name, hostname, ip, urls: [{ url, duration: 60 }], refresh, location })}>
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
  const isRotating = screen.urls.length > 1;
  const activeUrl = screen.urls[activeUrlIdx];

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
                <button key={i} style={{...styles.rotationTab, ...(i === activeUrlIdx ? styles.rotationTabActive : {})}} onClick={() => setActiveUrlIdx(i)}>
                  <span style={styles.rotationTabNum}>{i + 1}</span>
                  <span>{u.url.split('/').pop() || 'home'}</span>
                  <span style={styles.rotationTabDuration}>{u.duration}s</span>
                </button>
              ))}
            </div>
          )}
          <div style={styles.previewFrame}>
            <div style={styles.previewMock}>
              <div style={styles.previewMockBar} />
              <div style={{...styles.previewMockBar, width: '50%'}} />
              <div style={styles.previewMockGrid}>
                <div style={styles.previewMockCell} />
                <div style={styles.previewMockCell} />
                <div style={styles.previewMockCell} />
                <div style={styles.previewMockCell} />
                <div style={styles.previewMockCell} />
                <div style={styles.previewMockCell} />
              </div>
            </div>
          </div>
          <p style={styles.previewCaption}>
            Last screenshot captured at {screen.lastSeen} from {activeUrl.url.replace('https://', '')}
          </p>
        </div>
      </div>
    </div>
  );
}

function DetailDrawer({ screen, onClose, onEdit, onRefresh }) {
  const isRotating = screen.urls.length > 1;
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
              {screen.status.toUpperCase()}
            </span>
          } />
          <DetailRow k="Hostname" v={screen.hostname} mono />
          <DetailRow k="IP address" v={screen.ip} mono />
          <DetailRow k="Mode" v={isRotating ? `Rotating · ${screen.urls.length} URLs` : 'Single URL'} />
          {isRotating ? (
            <div style={styles.rotationDetail}>
              <p style={styles.rotationDetailHead}>URL ROTATION</p>
              {screen.urls.map((u, i) => (
                <div key={i} style={styles.rotationDetailRow}>
                  <span style={styles.rotationDetailNum}>{i + 1}</span>
                  <span style={styles.rotationDetailUrl}>{u.url.replace('https://', '')}</span>
                  <span style={styles.rotationDetailDur}>{u.duration}s</span>
                </div>
              ))}
            </div>
          ) : (
            <DetailRow k="URL" v={screen.urls[0].url.replace('https://', '')} mono />
          )}
          <DetailRow k="Reload interval" v={`${screen.refresh} minutes`} />
          <DetailRow k="Last seen" v={screen.lastSeen} mono />
          <DetailRow k="Uptime" v={screen.uptime} mono />
          <DetailRow k="Location" v={screen.location} />
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

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Open+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; }
  body, html { margin: 0; padding: 0; }
  button { font-family: inherit; cursor: pointer; border: none; background: none; }
  button:focus-visible, input:focus-visible { outline: 2px solid #FFB627; outline-offset: 2px; }
  button:disabled { cursor: not-allowed; opacity: 0.4; }
  input { font-family: inherit; }
`;

const styles = {
  root: { display: 'flex', minHeight: '100vh', background: '#FAF7F2', color: '#2B2A27', fontFamily: "'Open Sans', system-ui, sans-serif", fontSize: 14 },
  sidebar: { width: 240, background: '#002B49', color: '#FAF7F2', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarBrand: { padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid rgba(250,247,242,0.08)' },
  brandMark: { width: 36, height: 36, borderRadius: 8, background: 'rgba(123,160,106,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  brandText: { margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: '0.12em' },
  brandSub: { margin: 0, fontSize: 11, color: '#B6CFA9', letterSpacing: '0.04em' },
  nav: { padding: '12px 0', flex: 1 },
  navItem: { width: '100%', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, color: '#FAF7F2', fontSize: 13, fontWeight: 500, fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.02em', position: 'relative', transition: 'background 120ms' },
  navItemActive: { background: 'rgba(123,160,106,0.08)', color: '#B6CFA9' },
  navAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#7BA06A' },
  navIcon: { display: 'flex', alignItems: 'center' },
  sidebarFooter: { padding: '14px 20px', borderTop: '0.5px solid rgba(250,247,242,0.08)', display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', background: '#7BA06A', boxShadow: '0 0 0 3px rgba(123,160,106,0.18)' },
  footerTitle: { margin: 0, fontSize: 12, fontWeight: 500, color: '#FAF7F2' },
  footerSub: { margin: 0, fontSize: 10, color: '#8A8275', fontFamily: "'JetBrains Mono', monospace" },
  main: { flex: 1, padding: '40px 40px 64px', minWidth: 0 },
  masthead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 14 },
  eyebrow: { margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: '#567B49', textTransform: 'uppercase' },
  title: { margin: '4px 0 0', fontFamily: "'Montserrat', sans-serif", fontSize: 26, fontWeight: 600, color: '#2B2A27', letterSpacing: '-0.01em' },
  mastMeta: { textAlign: 'right' },
  metaLabel: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', color: '#8A8275' },
  metaValue: { marginTop: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#2B2A27' },
  mastRule: { height: 2, background: '#7BA06A', marginBottom: 24 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 },
  tile: { background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 12, padding: 18 },
  tileEyebrow: { margin: 0, fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#567B49', textTransform: 'uppercase' },
  tileValue: { margin: '8px 0 4px', fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 500, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  tileSub: { margin: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A8275' },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 },
  toolbarLeft: { display: 'flex', gap: 12 },
  viewToggle: { display: 'flex', background: '#F4EFE6', borderRadius: 999, padding: 3, border: '0.5px solid #E4DDCF' },
  viewBtn: { padding: '7px 14px', fontSize: 12, fontWeight: 500, fontFamily: "'Montserrat', sans-serif", letterSpacing: '0.04em', color: '#8A8275', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 120ms' },
  viewBtnActive: { background: '#FFFFFF', color: '#002B49', boxShadow: '0 1px 2px rgba(0,43,73,0.06)' },
  btnPrimary: { background: '#002B49', color: '#FAF7F2', height: 40, padding: '0 18px', borderRadius: 999, fontFamily: "'Montserrat', sans-serif", fontSize: 13, fontWeight: 500, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'filter 120ms' },
  btnGhost: { background: 'transparent', color: '#002B49', height: 36, padding: '0 14px', borderRadius: 999, border: '0.5px solid #002B49', fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'background 120ms' },
  btnGhostSm: { background: 'transparent', color: '#567B49', height: 32, padding: '0 12px', borderRadius: 999, border: '0.5px solid #B6CFA9', fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, transition: 'all 120ms' },
  btnDanger: { background: '#B3432B', color: '#FAF7F2', height: 36, padding: '0 14px', borderRadius: 999, fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnDangerGhost: { background: 'transparent', color: '#B3432B', height: 36, padding: '0 14px', borderRadius: 999, border: '0.5px solid #B3432B', fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  card: { background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 12, overflow: 'hidden', transition: 'box-shadow 120ms, transform 120ms', display: 'flex', flexDirection: 'column' },
  cardPreview: { position: 'relative', aspectRatio: '16 / 9', background: '#F4EFE6', borderBottom: '0.5px solid #E4DDCF', cursor: 'pointer', overflow: 'hidden' },
  cardPreviewMock: { padding: 14, height: '100%', display: 'flex', flexDirection: 'column', gap: 8 },
  mockBar: { height: 8, background: '#DCE5EE', borderRadius: 2, width: '85%' },
  mockGrid: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 },
  mockCell: { background: 'rgba(0,43,73,0.06)', borderRadius: 4 },
  statusChip: { position: 'absolute', top: 10, left: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 },
  chipOnline: { background: '#7BA06A', color: '#002B49' },
  chipOffline: { background: '#B3432B', color: '#FAF7F2' },
  rotationBadge: { position: 'absolute', top: 10, right: 10, background: 'rgba(0,43,73,0.85)', color: '#FAF7F2', fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', padding: '4px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 },
  rotationInline: { display: 'inline-flex', alignItems: 'center', gap: 6, color: '#1E5079', fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 500 },
  cardBody: { padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  cardName: { margin: 0, fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 14, color: '#2B2A27' },
  cardHost: { margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8A8275' },
  cardUrlRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#F4EFE6', borderRadius: 6, overflow: 'hidden' },
  cardUrl: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#2B2A27', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardFoot: { flex: 1 },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8A8275' },
  cardMetaDot: { color: '#C7BEAE' },
  cardActions: { display: 'flex', gap: 6, paddingTop: 4 },
  tableWrap: { background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontFamily: "'Montserrat', sans-serif", fontSize: 10, fontWeight: 500, letterSpacing: '0.08em', color: '#567B49', textAlign: 'left', padding: '14px 16px', borderBottom: '0.5px solid #E4DDCF', background: '#FAF7F2' },
  thNum: { textAlign: 'right' },
  tr: { transition: 'background 120ms' },
  td: { padding: '14px 16px', borderBottom: '0.5px solid #E4DDCF', fontSize: 13, color: '#2B2A27' },
  tdMono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 },
  tdNum: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontVariantNumeric: 'tabular-nums', textAlign: 'right' },
  tdUrl: { maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1E5079' },
  linkBtn: { fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 13, color: '#002B49', padding: 0 },
  statusChipInline: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 999, display: 'inline-block' },
  tableActions: { display: 'inline-flex', gap: 4 },
  iconBtn: { width: 30, height: 30, borderRadius: 6, color: '#8A8275', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 120ms' },
  modalScrim: { position: 'fixed', inset: 0, background: 'rgba(0,43,73,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 100 },
  modal: { background: '#FAF7F2', borderRadius: 14, width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 48px rgba(0,43,73,0.24)', overflow: 'hidden' },
  modalHead: { padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '0.5px solid #E4DDCF' },
  modalTitle: { margin: '4px 0 0', fontFamily: "'Montserrat', sans-serif", fontSize: 20, fontWeight: 600, color: '#2B2A27' },
  modalClose: { width: 32, height: 32, borderRadius: 8, color: '#8A8275', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms' },
  modalBody: { padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  modalFoot: { padding: '16px 24px', borderTop: '0.5px solid #E4DDCF', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  footRight: { display: 'flex', gap: 8 },
  confirmRow: { display: 'flex', alignItems: 'center', gap: 8 },
  confirmText: { fontSize: 12, color: '#B3432B', fontWeight: 500 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  fieldLabel: { fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: '#567B49', textTransform: 'uppercase' },
  fieldHint: { margin: '4px 0 0', fontSize: 11, color: '#8A8275', lineHeight: 1.5 },
  input: { height: 40, padding: '0 14px', border: '0.5px solid #E4DDCF', borderRadius: 8, background: '#FFFFFF', color: '#2B2A27', fontFamily: "'Open Sans', sans-serif", fontSize: 14, transition: 'border-color 120ms' },
  metaCard: { background: '#F4EFE6', borderRadius: 8, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 },
  metaCardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 },
  metaCardKey: { color: '#8A8275', fontFamily: "'Montserrat', sans-serif", fontWeight: 500, fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase' },
  metaCardVal: { fontFamily: "'JetBrains Mono', monospace", color: '#2B2A27' },
  helperBanner: { background: '#F4EFE6', borderLeft: '3px solid #7BA06A', borderRadius: 6, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: '#2B2A27', lineHeight: 1.5, marginTop: 4 },
  urlsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 },
  rotationHint: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#1E5079', fontFamily: "'Open Sans', sans-serif", fontStyle: 'italic' },
  urlsList: { display: 'flex', flexDirection: 'column', gap: 8 },
  urlRow: { display: 'flex', alignItems: 'center', gap: 8, padding: 8, background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 8 },
  urlOrder: { width: 24, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  urlOrderNum: { width: 24, height: 24, background: '#002B49', color: '#FAF7F2', borderRadius: '50%', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  urlInputs: { flex: 1, display: 'flex', gap: 8, minWidth: 0 },
  urlInput: { flex: 1, minWidth: 0 },
  durationField: { position: 'relative', flexShrink: 0, width: 100 },
  durationInput: { width: '100%', paddingRight: 38 },
  durationLabel: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A8275', pointerEvents: 'none' },
  urlControls: { display: 'flex', gap: 2, flexShrink: 0 },
  urlIconBtn: { width: 28, height: 28, borderRadius: 6, color: '#8A8275', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background 120ms, color 120ms' },
  previewBody: { padding: 24 },
  rotationTabs: { display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  rotationTab: { background: '#F4EFE6', border: '0.5px solid #E4DDCF', color: '#8A8275', height: 32, padding: '0 12px', borderRadius: 999, fontFamily: "'Open Sans', sans-serif", fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'all 120ms' },
  rotationTabActive: { background: '#FFFFFF', color: '#002B49', borderColor: '#002B49' },
  rotationTabNum: { width: 18, height: 18, borderRadius: '50%', background: '#002B49', color: '#FAF7F2', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  rotationTabDuration: { fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: '#8A8275' },
  previewFrame: { aspectRatio: '16 / 9', background: '#002B49', borderRadius: 8, padding: 8, overflow: 'hidden' },
  previewMock: { background: '#F4EFE6', height: '100%', borderRadius: 4, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 },
  previewMockBar: { height: 14, background: '#DCE5EE', borderRadius: 3, width: '70%' },
  previewMockGrid: { flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 },
  previewMockCell: { background: 'rgba(0,43,73,0.08)', borderRadius: 6 },
  previewCaption: { marginTop: 14, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A8275', textAlign: 'center' },
  drawerScrim: { position: 'fixed', inset: 0, background: 'rgba(0,43,73,0.45)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 },
  drawer: { width: 420, maxWidth: '90vw', background: '#FAF7F2', display: 'flex', flexDirection: 'column', height: '100vh', boxShadow: '-12px 0 48px rgba(0,43,73,0.24)' },
  drawerHead: { padding: '24px 24px 16px', borderBottom: '0.5px solid #E4DDCF', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  drawerBody: { padding: '20px 24px', flex: 1, overflowY: 'auto' },
  drawerFoot: { padding: 20, borderTop: '0.5px solid #E4DDCF', display: 'flex', gap: 8, justifyContent: 'flex-end' },
  detailRow: { padding: '12px 0', borderBottom: '0.5px solid #E4DDCF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  detailKey: { fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: '#8A8275', textTransform: 'uppercase' },
  detailVal: { fontSize: 13, color: '#2B2A27', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis' },
  detailValMono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 },
  rotationDetail: { padding: '12px 0', borderBottom: '0.5px solid #E4DDCF' },
  rotationDetailHead: { margin: '0 0 10px', fontFamily: "'Montserrat', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', color: '#8A8275', textTransform: 'uppercase' },
  rotationDetailRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' },
  rotationDetailNum: { width: 22, height: 22, background: '#002B49', color: '#FAF7F2', borderRadius: '50%', fontFamily: "'JetBrains Mono', monospace", fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rotationDetailUrl: { flex: 1, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#2B2A27', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  rotationDetailDur: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#8A8275', flexShrink: 0 },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 },
  filterChip: { background: '#F4EFE6', border: '0.5px solid #E4DDCF', color: '#8A8275', height: 30, padding: '0 14px', borderRadius: 999, fontFamily: "'Montserrat', sans-serif", fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', transition: 'all 120ms' },
  filterChipActive: { background: '#002B49', color: '#FAF7F2', borderColor: '#002B49' },
  activityList: { background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 12, overflow: 'hidden' },
  activityRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: '0.5px solid #E4DDCF', transition: 'background 120ms' },
  activityIcon: { width: 32, height: 32, borderRadius: 8, background: '#F4EFE6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityMain: { flex: 1, minWidth: 0 },
  activityTop: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 },
  activityScreen: { fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: 13, color: '#2B2A27' },
  activityType: { fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 500, letterSpacing: '0.08em', color: '#8A8275' },
  activityDetail: { margin: 0, fontSize: 12, color: '#8A8275', lineHeight: 1.5 },
  activityMeta: { textAlign: 'right', flexShrink: 0 },
  activityUser: { margin: 0, fontSize: 12, fontWeight: 500, color: '#2B2A27', fontFamily: "'Montserrat', sans-serif" },
  activityTime: { margin: '2px 0 0', fontSize: 10, color: '#8A8275', fontFamily: "'JetBrains Mono', monospace" },
  emptyState: { background: '#FFFFFF', border: '0.5px solid #E4DDCF', borderRadius: 12, padding: '48px 24px', textAlign: 'center' },
  emptyText: { margin: 0, color: '#8A8275', fontSize: 13 },
  toast: { position: 'fixed', bottom: 24, right: 24, background: '#002B49', color: '#FAF7F2', padding: '12px 18px', borderRadius: 999, fontSize: 13, fontFamily: "'Montserrat', sans-serif", fontWeight: 500, boxShadow: '0 8px 24px rgba(0,43,73,0.3)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 200 },
};
