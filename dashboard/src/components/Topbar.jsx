import React from 'react';
import { Search, Plus } from 'lucide-react';
import { T } from '../theme.js';
import { StatusDot } from './screens/StatusChip.jsx';

export function Topbar({
  search, onSearch,
  network = { online: 0, rotating: 0, offline: 0 },
  onAdd,
  showSearch = true,
  showAdd = true,
}) {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 28px',
      background: T.bgSurface,
      borderBottom: `1px solid ${T.line1}`,
      flexShrink: 0,
    }}>
      {showSearch && (
        <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
          <Search
            size={16}
            strokeWidth={1.75}
            style={{
              position: 'absolute',
              left: 12, top: '50%', transform: 'translateY(-50%)',
              color: T.fg3, pointerEvents: 'none',
            }}
          />
          <input
            value={search || ''}
            onChange={e => onSearch?.(e.target.value)}
            placeholder="Search screens, locations, URLs…"
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              border: `1px solid ${T.line2}`,
              borderRadius: 10,
              fontFamily: T.fontBody,
              fontSize: 13.5,
              background: T.bgApp,
              color: T.fg1,
            }}
          />
        </div>
      )}

      <div style={{ flex: 1 }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '6px 14px',
        background: T.bgApp,
        borderRadius: 999,
        border: `1px solid ${T.line1}`,
      }}>
        <NetSegment color={T.arcSage} pulse>
          <b>{network.online}</b> online
        </NetSegment>
        <Divider />
        <NetSegment color={T.arcYellow} pulse>
          <b>{network.rotating}</b> rotating
        </NetSegment>
        <Divider />
        <NetSegment color={T.statusDanger} pulse={false}>
          <b>{network.offline}</b> offline
        </NetSegment>
      </div>

      {showAdd && (
        <button
          onClick={onAdd}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '9px 16px',
            background: T.arcNavy,
            color: T.fgOnDark,
            border: 'none',
            borderRadius: 999,
            fontFamily: T.fontDisplay,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.06em',
          }}
        >
          <Plus size={14} strokeWidth={2} />
          Add screen
        </button>
      )}
    </header>
  );
}

function NetSegment({ color, pulse, children }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12,
      fontFamily: T.fontMono,
      color: T.fg2,
    }}>
      <StatusDot color={color} size={7} pulse={pulse} />
      <span>{children}</span>
    </span>
  );
}

function Divider() {
  return <span style={{ width: 1, height: 14, background: T.line2 }} />;
}
