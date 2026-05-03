import React from 'react';
import { T } from '../../theme.js';
import { Sparkline, BarMini } from './Sparkline.jsx';

// Hero-strip metric card. Used across the Screens page.
//
//   <MetricCard label="ONLINE" value={9} sub="of 12 reporting"
//               history={[97,98,96,99,98,97,97.4]} kind="sparkline"
//               accent="sage" />
//
// `accent` controls the chart and emphasis colour. When the card needs to
// shout (e.g. offline > 0), pass `tone="danger"` to flip to a navy background
// with yellow text.
export function MetricCard({
  label, value, sub, history, kind = 'sparkline',
  accent = 'sage', tone = 'default',
}) {
  const accentColor = ACCENT_COLORS[accent] || ACCENT_COLORS.sage;
  const isAlert = tone === 'danger';

  const cardStyle = {
    background: isAlert ? T.arcNavy : T.bgSurface,
    border: `1px solid ${isAlert ? T.arcNavy : T.line2}`,
    borderRadius: 14,
    padding: '16px 18px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    boxShadow: T.shadowSm,
    transition: 'box-shadow 200ms',
    minWidth: 0,
  };

  const labelStyle = {
    fontFamily: T.fontDisplay,
    fontSize: 10.5,
    fontWeight: 700,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: isAlert ? T.arcYellow : T.fg3,
  };

  const valueStyle = {
    fontFamily: T.fontDisplay,
    fontWeight: 800,
    fontSize: 36,
    color: isAlert ? T.arcWhite : (accent === 'danger' ? T.statusDanger : T.fgBrand),
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  };

  const subStyle = {
    fontFamily: T.fontMono,
    fontSize: 11,
    color: isAlert ? 'rgba(250,247,242,0.65)' : T.fg2,
    paddingTop: 6,
    borderTop: `1px solid ${isAlert ? 'rgba(250,247,242,0.15)' : T.line1}`,
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={labelStyle}>{label}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, minWidth: 0 }}>
        <span style={valueStyle}>{value}</span>
        <div style={{ flex: 1, minWidth: 0, opacity: isAlert ? 0.7 : 1 }}>
          {history && history.length > 0 && (
            kind === 'bar'
              ? <BarMini values={history} color={accentColor} height={24} />
              : <Sparkline values={history} color={accentColor} height={24} />
          )}
        </div>
      </div>

      {sub && <div style={subStyle}>{sub}</div>}
    </div>
  );
}

const ACCENT_COLORS = {
  sage:   T.arcSage,
  navy:   T.arcNavy500,
  yellow: T.arcYellow600,
  danger: T.statusDanger,
};
