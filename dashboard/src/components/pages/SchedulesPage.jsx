import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CalendarClock, X } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { useFetch } from '../../hooks/useFetch.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_HEIGHT = 24; // px per hour in the week grid

export function SchedulesPage({ onToast, onError }) {
  const screensQ = useFetch(() => api.listScreens(), []);
  const playlistsQ = useFetch(() => api.listPlaylists(), []);
  const schedulesQ = useFetch(() => api.listSchedules(), []);

  const screens = screensQ.data || [];
  const playlists = playlistsQ.data || [];
  const schedules = schedulesQ.data || [];

  const [selectedScreenId, setSelectedScreenId] = useState(null);
  const [adding, setAdding] = useState(false);

  // Default-select the first screen once data lands.
  if (!selectedScreenId && screens.length > 0) {
    setSelectedScreenId(screens[0].id);
  }

  const selectedScreen = screens.find(s => s.id === selectedScreenId);
  const screenSchedules = useMemo(
    () => schedules.filter(s => s.screenId === selectedScreenId),
    [schedules, selectedScreenId]
  );

  async function handleAdd(payload) {
    try {
      const result = await api.addSchedule(payload);
      onToast?.(result.conflicts?.length
        ? `Schedule added (overlaps with ${result.conflicts.length} other block${result.conflicts.length === 1 ? '' : 's'})`
        : 'Schedule added');
      schedulesQ.refetch();
      setAdding(false);
    } catch (err) {
      onError?.(err.message || 'Could not add schedule');
    }
  }

  async function handleDelete(scheduleId) {
    try {
      await api.deleteSchedule(scheduleId);
      onToast?.('Schedule removed');
      schedulesQ.refetch();
    } catch (err) {
      onError?.(err.message || 'Could not delete schedule');
    }
  }

  if (screensQ.loading || playlistsQ.loading || schedulesQ.loading) {
    return <div style={{ padding: 32, color: T.fg3 }}>Loading…</div>;
  }

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead screens={screens} schedules={schedules} />

      {screens.length === 0 ? (
        <NoScreens />
      ) : playlists.length === 0 ? (
        <NoPlaylists />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <ScreenPicker
              screens={screens}
              selectedId={selectedScreenId}
              onChange={setSelectedScreenId}
              schedules={schedules}
            />
            <button
              onClick={() => setAdding(true)}
              disabled={!selectedScreen}
              style={primaryBtnStyle(!selectedScreen)}
            >
              <Plus size={14} strokeWidth={2} /> Add block
            </button>
          </div>

          {selectedScreen && (
            <WeekGrid
              schedules={screenSchedules}
              playlists={playlists}
              onDelete={handleDelete}
            />
          )}

          {adding && (
            <AddScheduleModal
              screen={selectedScreen}
              playlists={playlists}
              onClose={() => setAdding(false)}
              onAdd={handleAdd}
            />
          )}
        </>
      )}
    </div>
  );
}

function PageHead({ schedules }) {
  return (
    <div>
      <div style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
      }}>
        Content · {schedules.length} block{schedules.length === 1 ? '' : 's'} configured
      </div>
      <h1 style={{
        margin: 0,
        fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
        color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
      }}>Schedules</h1>
      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.fg2 }}>
        Time-based playlist swaps per screen. Falls back to the screen's default when no block is active.
      </p>
      <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
    </div>
  );
}

function ScreenPicker({ screens, selectedId, onChange, schedules }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {screens.map(s => {
        const count = schedules.filter(sc => sc.screenId === s.id).length;
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
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
            {s.name}
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: active ? 'rgba(250,247,242,0.7)' : T.fg3,
            }}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function WeekGrid({ schedules, playlists, onDelete }) {
  const playlistById = Object.fromEntries(playlists.map(p => [p.id, p]));

  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      padding: '14px 18px 18px',
      boxShadow: T.shadowXs,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '54px repeat(7, 1fr)',
        gap: 4,
      }}>
        {/* Header row */}
        <div />
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.06em', color: T.fg3, textAlign: 'center', padding: '4px 0',
          }}>{d}</div>
        ))}

        {/* Hour labels + blocks per day */}
        <div style={{ position: 'relative', height: HOUR_HEIGHT * 24 }}>
          {Array.from({ length: 25 }).map((_, h) => (
            <div key={h} style={{
              position: 'absolute', top: h * HOUR_HEIGHT - 6, right: 4,
              fontFamily: T.fontMono, fontSize: 10, color: T.fg3,
            }}>{String(h).padStart(2, '0')}:00</div>
          ))}
        </div>

        {DAY_NAMES.map((_, day) => {
          const blocks = schedules.filter(s => (s.days || []).includes(day));
          return (
            <div key={day} style={{
              position: 'relative',
              height: HOUR_HEIGHT * 24,
              border: `1px solid ${T.line1}`,
              borderRadius: 6,
              background: T.bgSurfaceAlt,
              overflow: 'hidden',
            }}>
              {/* Hour grid lines */}
              {Array.from({ length: 23 }).map((_, h) => (
                <div key={h} style={{
                  position: 'absolute',
                  top: (h + 1) * HOUR_HEIGHT,
                  left: 0, right: 0,
                  borderTop: `1px dashed ${T.line1}`,
                }} />
              ))}
              {blocks.map(b => {
                const playlist = playlistById[b.playlistId];
                const top = (b.startMin / 60) * HOUR_HEIGHT;
                const height = ((b.endMin - b.startMin) / 60) * HOUR_HEIGHT;
                return (
                  <ScheduleBlock
                    key={b.id + '-' + day}
                    top={top}
                    height={height}
                    playlist={playlist}
                    onDelete={() => onDelete(b.id)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScheduleBlock({ top, height, playlist, onDelete }) {
  const colour = playlist ? blockColor(playlist.id) : T.fg3;
  return (
    <div
      title={playlist?.name || 'Unknown playlist'}
      style={{
        position: 'absolute',
        left: 2, right: 2,
        top, height: Math.max(20, height),
        background: colour + '33',
        border: `1px solid ${colour}`,
        borderLeftWidth: 3,
        borderRadius: 6,
        padding: '3px 6px',
        fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700,
        color: T.fg1,
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}
    >
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {playlist?.name || '?'}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        title="Delete block"
        style={{
          alignSelf: 'flex-end',
          width: 16, height: 16, borderRadius: 4,
          color: T.statusDanger, background: 'transparent',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={11} strokeWidth={2} />
      </button>
    </div>
  );
}

function blockColor(playlistId) {
  // Stable hue from id hash, like the tile placeholder.
  let h = 0;
  for (const c of String(playlistId)) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue}, 50%, 38%)`;
}

function AddScheduleModal({ screen, playlists, onClose, onAdd }) {
  const [playlistId, setPlaylistId] = useState(playlists[0]?.id || '');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('14:00');
  const [submitting, setSubmitting] = useState(false);

  const toggleDay = (d) => {
    setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d].sort());
  };

  async function handleSubmit(e) {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAdd({
        screenId: screen.id,
        playlistId,
        days,
        startMin: hhmmToMin(startTime),
        endMin: hhmmToMin(endTime),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={scrimStyle()}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle()}>
        <div style={modalHeadStyle()}>
          <div>
            <div style={eyebrowStyle()}>Schedule for {screen?.name}</div>
            <h2 style={titleStyle()}>Add time block</h2>
          </div>
          <button onClick={onClose} style={closeBtn()}><X size={18} strokeWidth={1.75} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Playlist">
            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              style={selectStyle()}
            >
              {playlists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <Field label="Days of week">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAY_NAMES.map((label, d) => {
                const active = days.includes(d);
                return (
                  <button
                    key={d} type="button"
                    onClick={() => toggleDay(d)}
                    style={{
                      padding: '6px 12px',
                      background: active ? T.arcNavy : 'transparent',
                      color: active ? T.fgOnDark : T.fg2,
                      border: `1px solid ${active ? T.arcNavy : T.line2}`,
                      borderRadius: 999,
                      fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.04em',
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Start time">
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle()} />
            </Field>
            <Field label="End time">
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={inputStyle()} />
            </Field>
          </div>

          <p style={{ margin: 0, fontSize: 11.5, color: T.fg3, lineHeight: 1.5 }}>
            For overnight blocks (e.g. 22:00 → 06:00), create two separate blocks
            (22:00–24:00 today + 00:00–06:00 the next day).
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: `1px solid ${T.line1}` }}>
            <button type="button" onClick={onClose} style={ghostBtnStyle()}>Cancel</button>
            <button type="submit" disabled={submitting || !playlistId || days.length === 0} style={primaryBtnStyle(submitting || !playlistId || days.length === 0)}>
              {submitting ? 'Adding…' : 'Add block'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoScreens() {
  return (
    <EmptyShell icon={CalendarClock} title="No screens registered" body="Register a screen first, then come back here to set up time-based playlist swaps." />
  );
}
function NoPlaylists() {
  return (
    <EmptyShell icon={CalendarClock} title="No playlists yet" body="Schedules need playlists to point at. Head to the Playlists page first." />
  );
}
function EmptyShell({ icon: Icon, title, body }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px dashed ${T.line2}`, borderRadius: 14,
      padding: 64, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}>
      <Icon size={32} strokeWidth={1.5} color={T.arcSage} />
      <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, color: T.fgBrand }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13, color: T.fg3, maxWidth: 380 }}>{body}</p>
    </div>
  );
}

function hhmmToMin(s) {
  const [h, m] = (s || '00:00').split(':').map(n => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', color: T.fgAccent, textTransform: 'uppercase',
      }}>{label}</label>
      {children}
    </div>
  );
}
function inputStyle() {
  return {
    height: 40, padding: '0 14px',
    border: `1px solid ${T.line2}`, borderRadius: T.radiusSm,
    background: T.bgSurface, color: T.fg1,
    fontFamily: T.fontBody, fontSize: 14, outline: 'none', width: '100%',
  };
}
function selectStyle() { return { ...inputStyle(), padding: '0 14px' }; }
function scrimStyle() {
  return {
    position: 'fixed', inset: 0,
    background: 'rgba(0,43,73,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 100,
    animation: 'arc-fade 160ms ease-out',
  };
}
function modalStyle() {
  return {
    background: T.bgApp, borderRadius: 14, width: '100%', maxWidth: 540,
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: T.shadowLg, overflow: 'hidden',
  };
}
function modalHeadStyle() {
  return {
    padding: '20px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, borderBottom: `1px solid ${T.line1}`, background: T.bgSurface,
  };
}
function eyebrowStyle() {
  return {
    fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
    letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fgAccent,
  };
}
function titleStyle() {
  return {
    margin: '4px 0 0', fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700,
    color: T.fgBrand, letterSpacing: '-0.01em',
  };
}
function closeBtn() {
  return {
    width: 32, height: 32, borderRadius: 8,
    color: T.fg3, background: 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
}
function primaryBtnStyle(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '10px 18px',
    background: disabled ? T.fg3 : T.arcNavy,
    color: T.fgOnDark, border: 'none', borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
function ghostBtnStyle() {
  return {
    padding: '9px 16px',
    background: 'transparent', color: T.fgBrand,
    border: `1px solid ${T.line2}`, borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
  };
}
