import React from 'react';
import { Eye, RefreshCw, Edit3, Repeat } from 'lucide-react';
import { T } from '../../theme.js';
import { StatusChip } from './StatusChip.jsx';
import { formatRelative } from '../../utils/time.js';

export function ScreenTable({ screens, onSelect, onRefresh, onEdit }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line2}`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: T.shadowXs,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <Th>SCREEN</Th>
            <Th>HOSTNAME</Th>
            <Th>URL</Th>
            <Th align="right">REFRESH</Th>
            <Th>STATUS</Th>
            <Th align="right">LAST SEEN</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {screens.map(s => {
            const isRotating = (s.urls?.length || 0) > 1;
            const url = (s.currentUrl || s.urls?.[0]?.url || '').replace(/^https?:\/\//, '');
            return (
              <tr
                key={s.id}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.bgApp}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                onClick={() => onSelect?.(s)}
              >
                <Td>
                  <span style={{
                    fontFamily: T.fontDisplay, fontWeight: 600, fontSize: 13, color: T.fgBrand,
                  }}>
                    {s.name}
                  </span>
                </Td>
                <Td mono>{s.hostname}</Td>
                <Td mono ellipsis style={{ color: T.arcNavy500 }}>
                  {isRotating ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: T.arcNavy500 }}>
                      <Repeat size={11} strokeWidth={1.75} /> {s.urls.length} URLs rotating
                    </span>
                  ) : url || '(no URL)'}
                </Td>
                <Td mono align="right">{s.refresh}m</Td>
                <Td><StatusChip status={s.status} /></Td>
                <Td mono align="right">{formatRelative(s.lastSeen)}</Td>
                <Td align="right" style={{ width: 110 }}>
                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    <IconBtn title="Preview" onClick={(e) => { e.stopPropagation(); onSelect?.(s); }}>
                      <Eye size={14} strokeWidth={1.75} />
                    </IconBtn>
                    <IconBtn title="Force refresh" onClick={(e) => { e.stopPropagation(); onRefresh?.(s); }}>
                      <RefreshCw size={14} strokeWidth={1.75} />
                    </IconBtn>
                    <IconBtn title="Edit" onClick={(e) => { e.stopPropagation(); onEdit?.(s); }}>
                      <Edit3 size={14} strokeWidth={1.75} />
                    </IconBtn>
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.14em', color: T.fgAccent, textTransform: 'uppercase',
      textAlign: align,
      padding: '14px 16px',
      borderBottom: `1px solid ${T.line1}`,
      background: T.bgApp,
    }}>
      {children}
    </th>
  );
}

function Td({ children, mono, align = 'left', ellipsis, style }) {
  return (
    <td style={{
      padding: '14px 16px',
      borderBottom: `1px solid ${T.line1}`,
      fontSize: mono ? 12 : 13,
      fontFamily: mono ? T.fontMono : T.fontBody,
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      color: T.fg1,
      textAlign: align,
      maxWidth: ellipsis ? 320 : undefined,
      overflow: ellipsis ? 'hidden' : undefined,
      textOverflow: ellipsis ? 'ellipsis' : undefined,
      whiteSpace: ellipsis ? 'nowrap' : undefined,
      ...style,
    }}>
      {children}
    </td>
  );
}

function IconBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 30, height: 30, borderRadius: 8,
        color: T.fg3,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = T.bgInset; e.currentTarget.style.color = T.fgBrand; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.fg3; }}
    >
      {children}
    </button>
  );
}
