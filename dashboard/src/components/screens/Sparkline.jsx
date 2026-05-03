import React from 'react';
import { T } from '../../theme.js';

// Tiny SVG sparkline. Pass any array of numbers; renders a line + soft fill.
// Renders nothing when there are <2 data points or all values are equal
// (the design opted for "no chart" rather than a flat baseline).
export function Sparkline({ values, color = T.arcSage, height = 28, fill = true }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  if (range === 0) return null;

  const W = 100;
  const H = height;
  const ptsArr = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return [x, y];
  });
  const pts = ptsArr.map(p => p.join(',')).join(' ');
  const area = `0,${H} ${pts} ${W},${H}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: H, display: 'block' }}
    >
      {fill && <polyline points={area} fill={color} opacity="0.12" />}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={ptsArr[ptsArr.length - 1][0]} cy={ptsArr[ptsArr.length - 1][1]} r="2.2" fill={color} />
    </svg>
  );
}

// BarMini — alternative "history" visual: vertical bars, optional accent bar.
export function BarMini({ values, color = T.arcSage, accentIdx = -1, accentColor = T.arcYellow, height = 32 }) {
  if (!values || values.length === 0) return null;
  const max = Math.max(...values) || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height, width: '100%' }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            minHeight: 3,
            background: i === accentIdx ? accentColor : color,
            borderRadius: '2px 2px 0 0',
            opacity: i === accentIdx ? 1 : 0.85,
          }}
        />
      ))}
    </div>
  );
}
