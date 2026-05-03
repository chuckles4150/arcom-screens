import React from 'react';
import { ExternalLink, RefreshCw, Edit3, Repeat, Clock } from 'lucide-react';
import { T, hashHostname } from '../../theme.js';
import { StatusChip } from './StatusChip.jsx';
import { formatRelative } from '../../utils/time.js';

export function ScreenTile({ screen, onSelect, onEdit, onRefresh }) {
  const isRotating = (screen.urls?.length || 0) > 1;
  const currentUrl = screen.currentUrl || screen.urls?.[0]?.url || '';
  const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
  const placeholderColor = hashHostname(screen.hostname);

  return (
    <div
      onClick={() => onSelect?.(screen)}
      style={{
        background: T.bgSurface,
        border: `1px solid ${T.line2}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: T.shadowXs,
        cursor: 'pointer',
        transition: 'box-shadow 200ms, transform 200ms',
        display: 'flex',
        flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = T.shadowMd;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = T.shadowXs;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
      className="arc-tile"
    >
      {/* Preview */}
      <div style={{
        position: 'relative',
        aspectRatio: '16 / 9',
        background: screen.snapshotAt ? T.bgInset : placeholderColor,
        borderBottom: `1px solid ${T.line1}`,
        overflow: 'hidden',
      }}>
        {screen.snapshotAt ? (
          <img
            src={`/screenshots/${screen.hostname}.png?t=${encodeURIComponent(screen.snapshotAt)}`}
            alt={`${screen.name} screenshot`}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18, letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase',
          }}>
            {screen.name}
          </div>
        )}

        {/* Status chip overlay */}
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <StatusChip status={screen.status} />
        </div>

        {/* Rotating badge */}
        {isRotating && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,43,73,0.85)', color: T.fgOnDark,
            fontFamily: T.fontMono, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 8px', borderRadius: 999,
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Repeat size={10} strokeWidth={2} /> {screen.urls.length} URLS
          </div>
        )}

        {/* Hover actions */}
        <TileActions
          screen={screen}
          onEdit={onEdit}
          onRefresh={onRefresh}
          currentUrl={currentUrl}
        />
      </div>

      {/* Body */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 14, color: T.fg1 }}>
            {screen.name}
          </div>
          <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg3, marginTop: 2 }}>
            {screen.hostname}{screen.ip ? ` · ${screen.ip}` : ''}
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px', background: T.bgSurfaceAlt,
          borderRadius: T.radiusSm, overflow: 'hidden',
        }}>
          <ExternalLink size={11} strokeWidth={1.75} style={{ flexShrink: 0, color: T.fg3 }} />
          <span style={{
            fontFamily: T.fontMono, fontSize: 11, color: T.fg1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {cleanUrl || '(no URL)'}
          </span>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontFamily: T.fontMono, fontSize: 10.5, color: T.fg3,
        }}>
          {isRotating ? (
            <>
              <Repeat size={11} strokeWidth={1.75} />
              <span>Rotating · {screen.urls.length} URLs</span>
            </>
          ) : (
            <>
              <Clock size={11} strokeWidth={1.75} />
              <span>Refresh: {screen.refresh}m</span>
            </>
          )}
          <span style={{ color: T.arcStone }}>·</span>
          <span>Seen {formatRelative(screen.lastSeen)}</span>
        </div>

        {screen.snapshotAt && (
          <div style={{
            fontFamily: T.fontMono, fontSize: 10, color: T.fg3,
            paddingTop: 4,
            borderTop: `1px solid ${T.line1}`,
          }}>
            Snap {formatRelative(screen.snapshotAt)}
          </div>
        )}
      </div>
    </div>
  );
}

function TileActions({ screen, currentUrl, onEdit, onRefresh }) {
  const stop = (handler) => (e) => { e.stopPropagation(); handler?.(screen); };
  return (
    <div className="arc-tile-actions" style={{
      position: 'absolute', bottom: 10, right: 10,
      display: 'flex', gap: 6,
      opacity: 0,
      transition: 'opacity 180ms',
    }}>
      {currentUrl && (
        <a
          href={/^https?:\/\//.test(currentUrl) ? currentUrl : `http://${currentUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="Open URL"
          style={iconBtnStyle}
        >
          <ExternalLink size={13} strokeWidth={1.75} />
        </a>
      )}
      <button onClick={stop(onRefresh)} title="Force refresh" style={iconBtnStyle}>
        <RefreshCw size={13} strokeWidth={1.75} />
      </button>
      <button onClick={stop(onEdit)} title="Edit" style={iconBtnStyle}>
        <Edit3 size={13} strokeWidth={1.75} />
      </button>
      <style>{`.arc-tile:hover .arc-tile-actions { opacity: 1 !important; }`}</style>
    </div>
  );
}

const iconBtnStyle = {
  width: 30, height: 30,
  border: 0,
  background: 'rgba(0,43,73,0.92)',
  backdropFilter: 'blur(6px)',
  borderRadius: 8,
  cursor: 'pointer',
  color: '#FAF7F2',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none',
};
