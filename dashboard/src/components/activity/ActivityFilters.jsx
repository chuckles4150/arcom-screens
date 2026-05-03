import React from 'react';
import { T } from '../../theme.js';

// 5 chips: All / Incidents / Refreshes / Content / System.
// Maps activity event types into kind groups so the user filters on
// concepts rather than raw event types.
//
// Kind groupings (kept in sync with kindOf below):
//   incident → 'offline'
//   refresh  → 'refresh'
//   content  → 'edit'
//   system   → 'add' | 'remove' | 'online'
export const KINDS = ['all', 'incident', 'refresh', 'content', 'system'];

export function kindOf(event) {
  switch (event?.type) {
    case 'offline':       return 'incident';
    case 'refresh':       return 'refresh';
    case 'edit':          return 'content';
    case 'add':
    case 'remove':
    case 'online':        return 'system';
    case 'rotation':      return 'content';
    default:              return 'system';
  }
}

const LABELS = {
  all:      { label: 'All',      color: null },
  incident: { label: 'Incidents', color: T.statusDanger },
  refresh:  { label: 'Refreshes', color: T.arcSage },
  content:  { label: 'Content',   color: T.arcNavy500 },
  system:   { label: 'System',    color: T.arcYellow },
};

export function ActivityFilters({ value, onChange, events }) {
  const counts = countByKind(events || []);

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {KINDS.map(k => {
        const meta = LABELS[k];
        const active = value === k;
        const n = k === 'all' ? events.length : counts[k] || 0;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
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
            {meta.color && <span style={{
              width: 7, height: 7, borderRadius: '50%', background: meta.color,
            }} />}
            {meta.label}
            <span style={{
              fontFamily: T.fontMono, fontSize: 11,
              color: active ? 'rgba(250,247,242,0.7)' : T.fg3,
            }}>{n}</span>
          </button>
        );
      })}
    </div>
  );
}

function countByKind(events) {
  const out = { incident: 0, refresh: 0, content: 0, system: 0 };
  for (const e of events) out[kindOf(e)]++;
  return out;
}
