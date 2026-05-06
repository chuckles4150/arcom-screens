import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Edit3, Save, X, ListVideo, ArrowUp, ArrowDown,
} from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { useFetch } from '../../hooks/useFetch.js';

export function PlaylistsPage({ onToast, onError }) {
  const playlistsQ = useFetch(() => api.listPlaylists(), []);
  const [editing, setEditing] = useState(null); // playlist object or { id: null } for new
  const [creating, setCreating] = useState(false);

  const playlists = playlistsQ.data || [];

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await api.addPlaylist({ name: 'New playlist', urls: [] });
      onToast?.('Playlist created');
      playlistsQ.refetch();
      setEditing(created);
    } catch (err) {
      onError?.(err.message || 'Could not create playlist');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(playlist) {
    if (playlist.usedBy > 0) {
      const ok = window.confirm(`${playlist.name} is used by ${playlist.usedBy} screen(s). Delete anyway?`);
      if (!ok) return;
    }
    try {
      await api.deletePlaylist(playlist.id);
      onToast?.('Playlist removed');
      playlistsQ.refetch();
      if (editing?.id === playlist.id) setEditing(null);
    } catch (err) {
      onError?.(err.message || 'Could not delete playlist');
    }
  }

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead playlists={playlists} onCreate={handleCreate} creating={creating} />

      {playlistsQ.loading ? (
        <Loading />
      ) : playlistsQ.error ? (
        <Failed />
      ) : playlists.length === 0 ? (
        <EmptyState onCreate={handleCreate} creating={creating} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
          <PlaylistList
            playlists={playlists}
            selectedId={editing?.id}
            onSelect={setEditing}
            onDelete={handleDelete}
          />
          {editing ? (
            <PlaylistEditor
              key={editing.id}
              playlist={editing}
              onSaved={(updated) => {
                onToast?.('Playlist saved');
                playlistsQ.refetch();
                setEditing(updated);
              }}
              onError={onError}
            />
          ) : (
            <NoSelection />
          )}
        </div>
      )}
    </div>
  );
}

function PageHead({ playlists, onCreate, creating }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
        }}>
          Content · {playlists.length} playlist{playlists.length === 1 ? '' : 's'}
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
          color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
        }}>Playlists</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.fg2 }}>
          Reusable URL collections — assign to screens or use in time-based schedules.
        </p>
        <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
      </div>
      <button
        onClick={onCreate}
        disabled={creating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 18px',
          background: T.arcNavy, color: T.fgOnDark,
          border: 'none', borderRadius: 999,
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
        }}
      >
        <Plus size={14} strokeWidth={2} /> {creating ? 'Creating…' : 'New playlist'}
      </button>
    </div>
  );
}

function PlaylistList({ playlists, selectedId, onSelect, onDelete }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: T.shadowXs,
      alignSelf: 'start',
    }}>
      {playlists.map(p => {
        const active = p.id === selectedId;
        return (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: `1px solid ${T.line1}`,
              cursor: 'pointer',
              background: active ? T.bgSurfaceAlt : 'transparent',
              borderLeft: active ? `3px solid ${T.arcYellow}` : '3px solid transparent',
              transition: 'background 150ms',
            }}
          >
            <ListVideo size={18} strokeWidth={1.75} color={active ? T.fgBrand : T.fg3} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13.5, color: T.fg1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{p.name}</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg3, marginTop: 2 }}>
                {p.urls?.length || 0} URL{p.urls?.length === 1 ? '' : 's'} · used by {p.usedBy || 0}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(p); }}
              title="Delete playlist"
              style={{
                width: 28, height: 28, borderRadius: 6,
                color: T.fg3,
                background: 'transparent',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Trash2 size={14} strokeWidth={1.75} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PlaylistEditor({ playlist, onSaved, onError }) {
  const [name, setName] = useState(playlist.name);
  const [urls, setUrls] = useState(playlist.urls || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(playlist.name);
    setUrls(playlist.urls || []);
  }, [playlist.id]);

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

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await api.updatePlaylist(playlist.id, { name, urls });
      onSaved?.(updated);
    } catch (err) {
      onError?.(err.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 14,
      boxShadow: T.shadowXs,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 10.5, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
          }}>Playlist</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: '100%',
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 22, color: T.fgBrand,
              border: 'none', borderBottom: `1px solid ${T.line2}`,
              padding: '6px 0', background: 'transparent', outline: 'none',
            }}
          />
        </div>
        <button onClick={handleSave} disabled={saving} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 18px',
          background: saving ? T.fg3 : T.arcNavy, color: T.fgOnDark,
          border: 'none', borderRadius: 999,
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
        }}>
          <Save size={13} strokeWidth={1.75} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {urls.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.fg3, fontStyle: 'italic' }}>
            No URLs yet. Add the first one below.
          </p>
        ) : urls.map((u, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 8, border: `1px solid ${T.line2}`, borderRadius: 8,
            background: T.bgSurfaceAlt,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: '50%',
              background: T.arcNavy, color: T.fgOnDark,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
              flexShrink: 0,
            }}>{i + 1}</span>
            <input
              value={u.url}
              onChange={(e) => updateUrl(i, { url: e.target.value })}
              placeholder="https://arcom.site/dashboard/..."
              style={{
                flex: 1, height: 36, padding: '0 12px',
                border: `1px solid ${T.line2}`, borderRadius: T.radiusSm,
                background: T.bgSurface, color: T.fg1,
                fontFamily: T.fontMono, fontSize: 13, outline: 'none',
              }}
            />
            <div style={{ position: 'relative', width: 100, flexShrink: 0 }}>
              <input
                type="number"
                value={u.duration}
                onChange={(e) => updateUrl(i, { duration: parseInt(e.target.value, 10) || 0 })}
                style={{
                  width: '100%', height: 36, padding: '0 36px 0 12px',
                  border: `1px solid ${T.line2}`, borderRadius: T.radiusSm,
                  background: T.bgSurface, color: T.fg1,
                  fontFamily: T.fontMono, fontSize: 13, outline: 'none',
                }}
              />
              <span style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                fontFamily: T.fontMono, fontSize: 11, color: T.fg3, pointerEvents: 'none',
              }}>sec</span>
            </div>
            <button onClick={() => moveUrl(i, -1)} disabled={i === 0} style={mini()}>
              <ArrowUp size={12} strokeWidth={1.75} />
            </button>
            <button onClick={() => moveUrl(i, 1)} disabled={i === urls.length - 1} style={mini()}>
              <ArrowDown size={12} strokeWidth={1.75} />
            </button>
            <button onClick={() => removeUrl(i)} style={mini(T.statusDanger)}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}

        <button onClick={addUrl} style={{
          alignSelf: 'flex-start',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px',
          background: 'transparent', color: T.fgAccent,
          border: `1px solid ${T.arcSage300}`, borderRadius: 999,
          fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
        }}>
          <Plus size={12} strokeWidth={2} /> Add URL
        </button>
      </div>

      <p style={{ margin: '8px 0 0', fontSize: 11.5, color: T.fg3, lineHeight: 1.55 }}>
        URLs play in order. Each duration is the time spent on that URL before advancing.
        Single-URL playlists work too — they just stay on that page (with the screen's refresh interval).
      </p>
    </div>
  );
}

function NoSelection() {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px dashed ${T.line2}`,
      borderRadius: 12,
      padding: 48,
      textAlign: 'center',
      color: T.fg3,
      fontSize: 13,
    }}>
      Select a playlist on the left to edit it.
    </div>
  );
}

function EmptyState({ onCreate, creating }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px dashed ${T.line2}`,
      borderRadius: 14,
      padding: 64,
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <ListVideo size={32} strokeWidth={1.5} color={T.arcSage} />
      <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 700, color: T.fgBrand }}>
        No playlists yet
      </div>
      <p style={{ margin: 0, fontSize: 13, color: T.fg3, maxWidth: 380 }}>
        Group URLs into reusable playlists. Then assign a playlist to a screen,
        or schedule different playlists for different times of day.
      </p>
      <button onClick={onCreate} disabled={creating} style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '12px 22px',
        background: T.arcNavy, color: T.fgOnDark,
        border: 'none', borderRadius: 999,
        fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13, letterSpacing: '0.06em',
      }}>
        <Plus size={14} strokeWidth={2} /> Create your first playlist
      </button>
    </div>
  );
}

function Loading() { return <div style={{ color: T.fg3 }}>Loading…</div>; }
function Failed()  { return <div style={{ color: T.statusDanger }}>Failed to load playlists.</div>; }

function mini(color) {
  return {
    width: 28, height: 28, borderRadius: 6,
    color: color || T.fg3, background: 'transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  };
}
