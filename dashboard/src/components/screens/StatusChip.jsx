import React from 'react';
import { T } from '../../theme.js';

const VARIANTS = {
  online:   { bg: T.statusOkBg,     fg: T.statusOk,     dot: T.statusOk,     label: 'ONLINE',   pulse: true },
  rotating: { bg: T.arcYellow50,    fg: '#B7820F',      dot: T.arcYellow,    label: 'ROTATING', pulse: true },
  offline:  { bg: T.statusDangerBg, fg: T.statusDanger, dot: T.statusDanger, label: 'OFFLINE',  pulse: false },
};

export function StatusChip({ status, size = 'sm', label, style }) {
  const v = VARIANTS[status] || VARIANTS.offline;
  const text = label != null ? label : v.label;

  const fontSize = size === 'md' ? 11 : 9.5;
  const padY = size === 'md' ? 4 : 3;
  const padX = size === 'md' ? 10 : 8;
  const dotSize = size === 'md' ? 7 : 6;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      background: v.bg,
      color: v.fg,
      fontFamily: T.fontDisplay,
      fontWeight: 700,
      fontSize,
      letterSpacing: '0.14em',
      padding: `${padY}px ${padX}px`,
      borderRadius: T.radiusPill,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      <StatusDot color={v.dot} size={dotSize} pulse={v.pulse} />
      {text}
    </span>
  );
}

export function StatusDot({ color, size = 8, pulse = true }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: size, height: size }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color }} />
      {pulse && (
        <span style={{
          position: 'absolute', inset: -3, borderRadius: '50%',
          background: color, opacity: 0.3,
          animation: 'arc-pulse 2s infinite ease-out',
        }} />
      )}
    </span>
  );
}
