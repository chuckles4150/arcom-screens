import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { T } from '../../theme.js';

export function SettingsPage() {
  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
        }}>
          System · Config
        </div>
        <h1 style={{
          margin: 0,
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
          color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
        }}>
          Settings
        </h1>
        <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
      </div>

      <div style={{
        background: T.bgSurface,
        border: `1px solid ${T.line1}`,
        borderRadius: 14,
        padding: '40px 32px',
        display: 'flex', alignItems: 'center', gap: 18,
        boxShadow: T.shadowXs,
      }}>
        <SettingsIcon size={28} strokeWidth={1.5} color={T.fgAccent} />
        <div>
          <div style={{
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 16, color: T.fgBrand,
          }}>
            Settings panel — coming in a later phase
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: T.fg3, lineHeight: 1.5 }}>
            Once Phase 2 brings Pi-side instrumentation online, this page will
            host alert thresholds, integrations (Slack, email), team members,
            and screen-group settings.
          </p>
        </div>
      </div>
    </div>
  );
}
