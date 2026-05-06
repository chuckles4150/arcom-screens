import React from 'react';
import { Monitor, Activity, Settings, LogOut } from 'lucide-react';
import { T } from '../theme.js';
import { StatusDot } from './screens/StatusChip.jsx';
import { clearStoredPassword } from '../api.js';

const NAV_ITEMS = [
  { id: 'screens',  label: 'Screens',  icon: Monitor  },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ active, onNav, screenCount }) {
  return (
    <aside style={{
      width: 232,
      background: T.arcNavy,
      color: T.fgOnDark,
      padding: '20px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      height: '100vh',
      position: 'sticky',
      top: 0,
      flexShrink: 0,
    }}>
      <div style={{ padding: '4px 10px 8px' }}>
        <img src="/logo-reversed.svg" alt="Arcom" style={{ height: 28, display: 'block' }} />
      </div>

      <div style={{
        padding: '0 10px 16px',
        borderBottom: '1px solid rgba(250,247,242,0.10)',
        marginBottom: 8,
      }}>
        <div style={{
          fontFamily: T.fontDisplay,
          fontSize: 10,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginBottom: 2,
        }}>
          Screen Manager
        </div>
        <div style={{ fontFamily: T.fontMono, fontSize: 11, opacity: 0.65 }}>
          v2.1 · arcom.local
        </div>
      </div>

      {NAV_ITEMS.map(item => {
        const isActive = active === item.id;
        const Icon = item.icon;
        const badge = item.id === 'screens' && screenCount != null ? screenCount : null;
        return (
          <button
            key={item.id}
            onClick={() => onNav(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: isActive ? 'rgba(255,182,39,0.14)' : 'transparent',
              color: isActive ? T.arcYellow : T.fgOnDark,
              fontFamily: T.fontBody,
              fontSize: 14,
              fontWeight: 500,
              textAlign: 'left',
              borderLeft: isActive ? `3px solid ${T.arcYellow}` : '3px solid transparent',
              paddingLeft: isActive ? 9 : 12,
              transition: 'background 200ms, color 200ms',
            }}
          >
            <Icon size={18} strokeWidth={1.75} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {badge != null && (
              <span style={{
                fontFamily: T.fontMono,
                fontSize: 11,
                background: 'rgba(250,247,242,0.12)',
                padding: '2px 7px',
                borderRadius: 10,
                color: T.fgOnDark,
              }}>{badge}</span>
            )}
          </button>
        );
      })}

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          padding: '12px',
          background: 'rgba(123,160,106,0.12)',
          border: '1px solid rgba(123,160,106,0.30)',
          borderRadius: 10,
          fontSize: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusDot color={T.arcSage} size={7} pulse />
            <span style={{
              fontFamily: T.fontDisplay,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '0.06em',
            }}>
              SERVER ONLINE
            </span>
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10.5, opacity: 0.7 }}>
            Pi 5 · arcom.local
          </div>
        </div>

        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            padding: '10px 12px',
            borderTop: '1px solid rgba(250,247,242,0.10)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: T.fgOnDark,
            background: 'transparent',
            textAlign: 'left',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: T.arcNavy300, color: T.fgOnDark,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11,
          }}>CW</div>
          <div style={{ fontSize: 12, lineHeight: 1.3, flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Chuck</div>
            <div style={{ opacity: 0.6, fontSize: 10.5 }}>Sign out</div>
          </div>
          <LogOut size={14} strokeWidth={1.75} style={{ opacity: 0.5 }} />
        </button>
      </div>
    </aside>
  );
}

function handleLogout() {
  clearStoredPassword();
  window.location.reload();
}
