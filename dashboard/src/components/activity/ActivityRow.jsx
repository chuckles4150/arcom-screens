import React from 'react';
import {
  RefreshCw, Edit3, Wifi, WifiOff, Plus, Trash2, Repeat, Power,
  Activity as ActIcon,
} from 'lucide-react';
import { T } from '../../theme.js';
import { formatActivityTime } from '../../utils/time.js';

const KIND_CONFIG = {
  refresh:  { Icon: RefreshCw, color: T.arcNavy500, label: 'REFRESH' },
  edit:     { Icon: Edit3,     color: T.arcSage700, label: 'EDIT' },
  online:   { Icon: Wifi,      color: T.arcSage,    label: 'ONLINE' },
  offline:  { Icon: WifiOff,   color: T.statusDanger, label: 'OFFLINE' },
  add:      { Icon: Plus,      color: T.arcSage,    label: 'ADDED' },
  remove:   { Icon: Trash2,    color: T.statusDanger, label: 'REMOVED' },
  rotation: { Icon: Repeat,    color: T.arcNavy500, label: 'ROTATION' },
  boot:     { Icon: Power,     color: T.arcYellow600, label: 'REBOOT' },
};
const FALLBACK = { Icon: ActIcon, color: T.fg3, label: 'EVENT' };

export function ActivityRow({ event, onScreenClick }) {
  const cfg = KIND_CONFIG[event.type] || FALLBACK;
  const { Icon } = cfg;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 18px',
        borderBottom: `1px solid ${T.line1}`,
        transition: 'background 120ms',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = T.bgApp}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: T.bgSurfaceAlt,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        color: cfg.color,
      }}>
        <Icon size={14} strokeWidth={1.75} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
          {event.screen ? (
            <button
              onClick={() => onScreenClick?.(event.screen)}
              style={{
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 13, color: T.fg1,
                padding: 0, background: 'transparent',
              }}
            >
              {event.screen}
            </button>
          ) : null}
          <span style={{
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 700,
            letterSpacing: '0.14em', color: cfg.color,
          }}>
            {cfg.label}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: T.fg2, lineHeight: 1.5 }}>
          {event.detail || ''}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          margin: 0, fontSize: 12, fontWeight: 600, color: T.fg1, fontFamily: T.fontDisplay,
        }}>{event.user || 'system'}</p>
        <p style={{
          margin: '2px 0 0', fontSize: 10, color: T.fg3, fontFamily: T.fontMono,
        }}>{formatActivityTime(event.timestamp)}</p>
      </div>
    </div>
  );
}
