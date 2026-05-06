import React, { useState, useMemo } from 'react';
import { AlertTriangle, Eye, Check, MessageSquare, X } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { usePolling } from '../../hooks/useFetch.js';
import { formatRelative, formatActivityTime } from '../../utils/time.js';

const POLL_MS = 30000;
const TABS = [
  { id: 'open',       label: 'Open',       color: T.statusDanger },
  { id: 'monitoring', label: 'Monitoring', color: T.statusWarn },
  { id: 'resolved',   label: 'Resolved',   color: T.statusOk },
  { id: 'all',        label: 'All',        color: null },
];

export function IncidentsPage({ onToast, onError }) {
  const incidentsQ = usePolling(() => api.listIncidents(), POLL_MS, []);
  const [tab, setTab] = useState('open');
  const [selected, setSelected] = useState(null);

  const all = incidentsQ.data || [];
  const counts = useMemo(() => ({
    open: all.filter(i => i.status === 'open').length,
    monitoring: all.filter(i => i.status === 'monitoring').length,
    resolved: all.filter(i => i.status === 'resolved').length,
    all: all.length,
  }), [all]);

  const filtered = tab === 'all' ? all : all.filter(i => i.status === tab);

  async function handleStatus(incident, status) {
    try {
      await api.updateIncident(incident.id, { status });
      onToast?.(`Incident ${status}`);
      incidentsQ.refetch();
      if (selected?.id === incident.id) {
        setSelected(s => s ? { ...s, status } : s);
      }
    } catch (err) {
      onError?.(err.message || 'Could not update incident');
    }
  }

  async function handleAddNote(incident, text) {
    try {
      const updated = await api.addIncidentNote(incident.id, text);
      incidentsQ.refetch();
      setSelected(updated);
    } catch (err) {
      onError?.(err.message || 'Could not add note');
    }
  }

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHead counts={counts} />

      <Tabs value={tab} onChange={setTab} counts={counts} />

      {incidentsQ.loading ? (
        <div style={{ color: T.fg3 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <Empty status={tab} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 16 }}>
          <IncidentList
            incidents={filtered}
            selectedId={selected?.id}
            onSelect={setSelected}
          />
          {selected ? (
            <IncidentDetail
              incident={selected}
              onStatus={(s) => handleStatus(selected, s)}
              onAddNote={(text) => handleAddNote(selected, text)}
            />
          ) : (
            <NoSelection />
          )}
        </div>
      )}
    </div>
  );
}

function PageHead({ counts }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
        }}>
          Operations · {counts.open} open · {counts.monitoring} monitoring
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
          color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
        }}>Incidents</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.fg2 }}>
          Auto-created when a screen goes offline; auto-resolved when it comes back. Notes preserve context.
        </p>
        <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3,
        }}>Open now</div>
        <div style={{
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 28,
          color: counts.open > 0 ? T.statusDanger : T.statusOk,
          fontVariantNumeric: 'tabular-nums',
        }}>{counts.open}</div>
      </div>
    </div>
  );
}

function Tabs({ value, onChange, counts }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {TABS.map(t => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '7px 13px', borderRadius: 999,
              background: active ? T.arcNavy : 'transparent',
              color: active ? T.fgOnDark : T.fg2,
              border: `1px solid ${active ? T.arcNavy : T.line2}`,
              fontFamily: T.fontDisplay, fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
            }}
          >
            {t.color && <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }} />}
            {t.label}
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: active ? 'rgba(250,247,242,0.7)' : T.fg3,
            }}>{counts[t.id] || 0}</span>
          </button>
        );
      })}
    </div>
  );
}

function IncidentList({ incidents, selectedId, onSelect }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: T.shadowXs,
      alignSelf: 'start',
    }}>
      {incidents.map(i => {
        const active = i.id === selectedId;
        const colour = STATUS_COLOR[i.status] || T.fg3;
        return (
          <div
            key={i.id}
            onClick={() => onSelect(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px',
              borderBottom: `1px solid ${T.line1}`,
              cursor: 'pointer',
              background: active ? T.bgSurfaceAlt : 'transparent',
              borderLeft: `3px solid ${active ? T.arcYellow : colour}`,
            }}
          >
            <AlertTriangle size={16} strokeWidth={1.75} color={colour} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13.5, color: T.fg1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{i.screen}</div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg3, marginTop: 2 }}>
                {i.type} · {formatRelative(i.createdAt)}
              </div>
            </div>
            <span style={{
              fontFamily: T.fontDisplay, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '0.14em',
              padding: '3px 8px', borderRadius: 999,
              background: colour + '22', color: colour,
              flexShrink: 0,
            }}>
              {i.status.toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function IncidentDetail({ incident, onStatus, onAddNote }) {
  const [noteText, setNoteText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!noteText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(noteText.trim());
      setNoteText('');
    } finally {
      setSubmitting(false);
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
        <div>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
          }}>
            Incident · {incident.type} · opened {formatRelative(incident.createdAt)}
          </div>
          <h2 style={{
            margin: 0,
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 22, color: T.fgBrand,
          }}>{incident.screen}</h2>
        </div>
        <span style={{
          fontFamily: T.fontDisplay, fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.14em',
          padding: '4px 10px', borderRadius: 999,
          background: (STATUS_COLOR[incident.status] || T.fg3) + '22',
          color: STATUS_COLOR[incident.status] || T.fg3,
        }}>
          {incident.status.toUpperCase()}
        </span>
      </div>

      {/* Status actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {incident.status !== 'monitoring' && incident.status !== 'resolved' && (
          <button onClick={() => onStatus('monitoring')} style={ghostBtnStyle()}>
            <Eye size={13} strokeWidth={1.75} /> Mark monitoring
          </button>
        )}
        {incident.status !== 'resolved' && (
          <button onClick={() => onStatus('resolved')} style={primaryBtnStyle()}>
            <Check size={13} strokeWidth={1.75} /> Resolve
          </button>
        )}
        {incident.status === 'resolved' && (
          <button onClick={() => onStatus('open')} style={ghostBtnStyle()}>
            Re-open
          </button>
        )}
      </div>

      {/* Notes timeline */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        background: T.bgSurfaceAlt, padding: 14, borderRadius: 8,
      }}>
        {(incident.notes || []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.fg3, fontStyle: 'italic' }}>No notes yet.</p>
        ) : (
          incident.notes.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <MessageSquare size={13} strokeWidth={1.75} color={T.fg3} style={{ marginTop: 3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.fg1, lineHeight: 1.5 }}>{n.text}</div>
                <div style={{ fontFamily: T.fontMono, fontSize: 10.5, color: T.fg3, marginTop: 2 }}>
                  {n.user || 'system'} · {formatActivityTime(n.ts)}
                </div>
              </div>
            </div>
          ))
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note…"
            style={{
              flex: 1, height: 36, padding: '0 12px',
              border: `1px solid ${T.line2}`, borderRadius: T.radiusSm,
              background: T.bgSurface, color: T.fg1,
              fontFamily: T.fontBody, fontSize: 13, outline: 'none',
            }}
          />
          <button type="submit" disabled={!noteText.trim() || submitting} style={primaryBtnStyle(!noteText.trim() || submitting)}>
            {submitting ? '…' : 'Add'}
          </button>
        </form>
      </div>

      {/* Created/resolved timestamps */}
      <div style={{
        fontFamily: T.fontMono, fontSize: 11, color: T.fg3,
        paddingTop: 8, borderTop: `1px solid ${T.line1}`,
      }}>
        Created {formatActivityTime(incident.createdAt)}
        {incident.resolvedAt && <> · Resolved {formatActivityTime(incident.resolvedAt)}</>}
      </div>
    </div>
  );
}

function Empty({ status }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px dashed ${T.line2}`, borderRadius: 12,
      padding: 48, textAlign: 'center',
    }}>
      <p style={{ margin: 0, color: T.fg3, fontSize: 13 }}>
        {status === 'open' && 'No open incidents — everything\'s healthy.'}
        {status === 'monitoring' && 'No incidents are being monitored right now.'}
        {status === 'resolved' && 'No resolved incidents in the history yet.'}
        {status === 'all' && 'No incidents recorded yet.'}
      </p>
    </div>
  );
}

function NoSelection() {
  return (
    <div style={{
      background: T.bgSurface, border: `1px dashed ${T.line2}`, borderRadius: 12,
      padding: 48, textAlign: 'center', color: T.fg3, fontSize: 13,
    }}>
      Select an incident to see details and add notes.
    </div>
  );
}

const STATUS_COLOR = {
  open:       T.statusDanger,
  monitoring: T.statusWarn,
  resolved:   T.statusOk,
};

function primaryBtnStyle(disabled) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    background: disabled ? T.fg3 : T.arcNavy, color: T.fgOnDark,
    border: 'none', borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
function ghostBtnStyle() {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    background: 'transparent', color: T.fgBrand,
    border: `1px solid ${T.line2}`, borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
  };
}
