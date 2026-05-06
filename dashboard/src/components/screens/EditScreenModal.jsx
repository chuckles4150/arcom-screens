import React, { useState } from 'react';
import { Plus, ArrowUp, ArrowDown, X, Repeat } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { ModalShell, ModalFoot, Field, Input } from './AddScreenModal.jsx';

// Edit existing screen. Supports rotation editing (multiple URLs with
// per-URL durations). Deletion is NOT here — it lives on the DrillPanel
// footer in the new design.
export function EditScreenModal({ screen, onClose, onSaved, onError }) {
  const [name, setName] = useState(screen.name);
  const [urls, setUrls] = useState(screen.urls || [{ url: '', duration: 30 }]);
  const [refresh, setRefresh] = useState(screen.refresh);
  const [location, setLocation] = useState(screen.location || '');
  const [submitting, setSubmitting] = useState(false);

  // Phase-5/6: source of truth for what plays on this screen.
  // 'inline' = use the urls array below (Phase 1 behaviour, default).
  // 'playlist' = pull URLs from a saved playlist by id.
  const [source, setSource] = useState(screen.playlistId ? 'playlist' : 'inline');
  const [playlistId, setPlaylistId] = useState(screen.playlistId || '');
  const [scheduleEnabled, setScheduleEnabled] = useState(screen.scheduleEnabled !== false);

  const playlistsQ = useFetch(() => api.listPlaylists(), []);
  const playlists = playlistsQ.data || [];

  const isRotating = urls.length > 1;

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

  async function handleSave(e) {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const patch = {
        name,
        refresh: parseInt(refresh, 10) || 0,
        location,
        scheduleEnabled,
      };
      if (source === 'playlist') {
        patch.playlistId = playlistId || null;
      } else {
        patch.urls = urls;
        patch.playlistId = null;
      }
      const updated = await api.updateScreen(screen.id, patch);
      onSaved?.(updated);
    } catch (err) {
      onError?.(err.message || 'Could not save changes');
      setSubmitting(false);
    }
  }

  return (
    <ModalShell title={screen.name} eyebrow="EDIT SCREEN" onClose={onClose} maxWidth={620}>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="Name">
          <Input value={name} onChange={setName} />
        </Field>

        {/* Phase-5: source picker (inline URLs vs saved playlist) */}
        <Field label="Content source">
          <div style={{
            display: 'flex',
            background: T.bgSurfaceAlt,
            borderRadius: 999,
            padding: 3,
            border: `1px solid ${T.line1}`,
            alignSelf: 'flex-start',
          }}>
            {[
              { id: 'inline',   label: 'Inline URLs' },
              { id: 'playlist', label: 'Use a playlist' },
            ].map(opt => {
              const active = source === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSource(opt.id)}
                  style={{
                    padding: '7px 14px',
                    fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                    color: active ? T.fgBrand : T.fg3,
                    background: active ? T.bgSurface : 'transparent',
                    borderRadius: 999, border: 'none',
                    boxShadow: active ? T.shadowXs : 'none',
                  }}
                >{opt.label}</button>
              );
            })}
          </div>
        </Field>

        {source === 'playlist' && (
          <Field label="Playlist">
            {playlists.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: T.fg3 }}>
                No playlists yet — create one on the Playlists page first.
              </p>
            ) : (
              <select
                value={playlistId}
                onChange={(e) => setPlaylistId(e.target.value)}
                style={{
                  height: 40, padding: '0 14px',
                  border: `1px solid ${T.line2}`, borderRadius: T.radiusSm,
                  background: T.bgSurface, color: T.fg1,
                  fontFamily: T.fontBody, fontSize: 14, outline: 'none',
                }}
              >
                <option value="">— pick a playlist —</option>
                {playlists.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.urls?.length || 0} URLs)</option>
                ))}
              </select>
            )}
          </Field>
        )}

        {source === 'inline' && (
        <div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            gap: 12, marginBottom: 8,
          }}>
            <label style={{
              fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.06em', color: T.fgAccent, textTransform: 'uppercase',
            }}>
              {isRotating ? `URL Rotation (${urls.length})` : 'URL'}
            </label>
            {isRotating && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 10, color: T.arcNavy500, fontStyle: 'italic',
              }}>
                <Repeat size={10} strokeWidth={2} /> Cycles through in order
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {urls.map((u, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: 8, background: T.bgSurface,
                border: `1px solid ${T.line2}`, borderRadius: 8,
              }}>
                {isRotating && (
                  <div style={{
                    width: 24, height: 24,
                    background: T.arcNavy, color: T.fgOnDark,
                    borderRadius: '50%',
                    fontFamily: T.fontMono, fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{i + 1}</div>
                )}

                <div style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0 }}>
                  <Input
                    value={u.url}
                    onChange={(v) => updateUrl(i, { url: v })}
                    placeholder="https://arcom.site/dashboard/..."
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  {isRotating && (
                    <div style={{ position: 'relative', flexShrink: 0, width: 110 }}>
                      <Input
                        type="number"
                        value={u.duration}
                        onChange={(v) => updateUrl(i, { duration: parseInt(v, 10) || 0 })}
                        style={{ paddingRight: 38 }}
                      />
                      <span style={{
                        position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                        fontFamily: T.fontMono, fontSize: 11, color: T.fg3, pointerEvents: 'none',
                      }}>sec</span>
                    </div>
                  )}
                </div>

                {isRotating && (
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <SmallIconBtn onClick={() => moveUrl(i, -1)} disabled={i === 0} title="Move up">
                      <ArrowUp size={12} strokeWidth={1.75} />
                    </SmallIconBtn>
                    <SmallIconBtn onClick={() => moveUrl(i, 1)} disabled={i === urls.length - 1} title="Move down">
                      <ArrowDown size={12} strokeWidth={1.75} />
                    </SmallIconBtn>
                    <SmallIconBtn onClick={() => removeUrl(i)} title="Remove URL" danger>
                      <X size={14} strokeWidth={2} />
                    </SmallIconBtn>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addUrl}
            style={{
              marginTop: 8,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 12px', borderRadius: 999,
              border: `1px solid ${T.arcSage300}`, background: 'transparent',
              color: T.fgAccent,
              fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
            }}
          >
            <Plus size={12} strokeWidth={2} />
            {isRotating ? 'Add another URL' : 'Add second URL (start rotation)'}
          </button>
        </div>
        )}

        <Field
          label={isRotating ? 'Page reload interval (minutes)' : 'Refresh interval (minutes)'}
          hint={isRotating
            ? 'How often each page reloads to pull fresh data. Rotation timing is set per-URL above.'
            : 'How often the page reloads to pull fresh data.'}
        >
          <Input type="number" value={refresh} onChange={(v) => setRefresh(parseInt(v, 10) || 0)} />
        </Field>

        <Field label="Location">
          <Input value={location} onChange={setLocation} />
        </Field>

        {/* Phase-6: schedule override toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', border: `1px solid ${T.line1}`,
          borderRadius: 10, background: T.bgSurfaceAlt, cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, color: T.fg1,
            }}>Apply schedules</div>
            <div style={{ fontSize: 11.5, color: T.fg3, lineHeight: 1.5 }}>
              When on, time-based blocks from the Schedules page take priority over the source above.
            </div>
          </div>
        </label>

        <MetaCard screen={screen} />

        <ModalFoot
          onCancel={onClose}
          submitLabel={submitting ? 'Saving…' : 'Save changes'}
          disabled={submitting}
        />
      </form>
    </ModalShell>
  );
}

function SmallIconBtn({ children, onClick, disabled, title, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6,
        color: danger ? T.statusDanger : T.fg3,
        background: 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function MetaCard({ screen }) {
  return (
    <div style={{
      background: T.bgSurfaceAlt,
      borderRadius: 8,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 4,
    }}>
      <MetaRow k="Hostname" v={screen.hostname} />
      <MetaRow k="IP address" v={screen.ip || '—'} />
      <MetaRow k="Created" v={screen.createdAt ? new Date(screen.createdAt).toLocaleDateString() : '—'} />
    </div>
  );
}

function MetaRow({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
      <span style={{
        color: T.fg3, fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{k}</span>
      <span style={{ fontFamily: T.fontMono, color: T.fg1 }}>{v}</span>
    </div>
  );
}
