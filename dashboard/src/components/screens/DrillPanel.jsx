import React, { useState, useEffect } from 'react';
import {
  X, RefreshCw, Edit3, ExternalLink, Terminal, Repeat, Trash2,
} from 'lucide-react';
import { T, hashHostname } from '../../theme.js';
import { api } from '../../api.js';
import { useFetch } from '../../hooks/useFetch.js';
import { StatusChip } from './StatusChip.jsx';
import { Sparkline } from './Sparkline.jsx';
import { ConsoleModal } from './ConsoleModal.jsx';
import { formatRelative, formatActivityTime } from '../../utils/time.js';

export function DrillPanel({ screen, onClose, onEdit, onRefresh, onDeleted, onError }) {
  const uptimeQ = useFetch(() => api.screenUptime(screen.id), [screen.id]);
  const metricsQ = useFetch(() => api.screenMetrics(screen.id, '24h'), [screen.id]);
  const activityQ = useFetch(() => api.listActivity({ screen: screen.name, limit: 10 }), [screen.id, screen.name]);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);

  // Esc to close
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isRotating = (screen.urls?.length || 0) > 1;
  const currentUrl = screen.currentUrl || screen.urls?.[0]?.url || '';
  const placeholderColor = hashHostname(screen.hostname);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deleteScreen(screen.id);
      onDeleted?.(screen.id);
    } catch (err) {
      onError?.(err.message || 'Could not remove screen');
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <>
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,43,73,0.45)',
        display: 'flex', justifyContent: 'flex-end',
        zIndex: 100,
        animation: 'arc-fade 160ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 460, maxWidth: '90vw',
          background: T.bgApp,
          display: 'flex', flexDirection: 'column',
          height: '100vh',
          boxShadow: '-12px 0 48px rgba(0,43,73,0.24)',
          animation: 'arc-slide-in-right 220ms ease-out',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${T.line1}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
          background: T.bgSurface,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fgAccent,
            }}>
              SCREEN DETAIL
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <h2 style={{
                margin: 0,
                fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 700,
                color: T.fgBrand, letterSpacing: '-0.01em',
              }}>{screen.name}</h2>
              <StatusChip status={screen.status} size="md" />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 8,
              color: T.fg3, background: 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Big preview */}
          <div>
            <div style={{
              aspectRatio: '16/9',
              background: screen.snapshotAt ? T.arcChar : placeholderColor,
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: T.shadowSm,
            }}>
              {screen.snapshotAt ? (
                <img
                  src={`/screenshots/${screen.hostname}.png?t=${encodeURIComponent(screen.snapshotAt)}`}
                  alt={`${screen.name} screenshot`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 24, letterSpacing: '0.14em',
                  color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase',
                }}>
                  {screen.name}
                </div>
              )}
            </div>
            <p style={{
              margin: '8px 0 0',
              fontFamily: T.fontMono, fontSize: 11, color: T.fg3,
              textAlign: 'center',
            }}>
              {screen.snapshotAt ? `Snap ${formatRelative(screen.snapshotAt)}` : 'No snapshot yet'}
              {currentUrl && <> · {currentUrl.replace(/^https?:\/\//, '')}</>}
            </p>
          </div>

          {/* Action row */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ActionPill onClick={() => onRefresh?.(screen)} icon={<RefreshCw size={13} strokeWidth={1.75} />}>Force refresh</ActionPill>
            <ActionPill onClick={() => onEdit?.(screen)} icon={<Edit3 size={13} strokeWidth={1.75} />}>Edit settings</ActionPill>
            {currentUrl && (
              <ActionPill
                as="a"
                href={/^https?:\/\//.test(currentUrl) ? currentUrl : `http://${currentUrl}`}
                icon={<ExternalLink size={13} strokeWidth={1.75} />}
              >
                Open URL
              </ActionPill>
            )}
            <ActionPill
              onClick={() => setConsoleOpen(true)}
              title="Live Pi logs (≈30 s latency)"
              icon={<Terminal size={13} strokeWidth={1.75} />}
            >
              Console
            </ActionPill>
          </div>

          {/* Stats grid: uptime + bandwidth + restarts + response time, plus an
              optional load/memory card below (Phase 2 — populated from
              /api/screens/:id/metrics). */}
          <StatsGrid uptimeQ={uptimeQ} metricsQ={metricsQ} />

          {/* Rotation schedule */}
          {isRotating && (
            <RotationSchedule urls={screen.urls} currentUrl={currentUrl} />
          )}

          {/* Recent activity */}
          <RecentActivity query={activityQ} screenName={screen.name} />

          {/* Detail rows */}
          <div style={{
            background: T.bgSurface,
            border: `1px solid ${T.line1}`,
            borderRadius: 12,
            padding: '4px 16px',
          }}>
            <DetailRow k="Hostname" v={screen.hostname} mono />
            <DetailRow k="IP address" v={screen.ip || '—'} mono />
            <DetailRow k="Mode" v={isRotating ? `Rotating · ${screen.urls.length} URLs` : 'Single URL'} />
            <DetailRow k="Reload interval" v={`${screen.refresh} minutes`} />
            <DetailRow k="Last seen" v={formatRelative(screen.lastSeen)} mono />
            <DetailRow k="Created" v={screen.createdAt ? new Date(screen.createdAt).toLocaleDateString() : '—'} />
            <DetailRow k="Location" v={screen.location || '—'} last />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: 20,
          borderTop: `1px solid ${T.line1}`,
          background: T.bgSurface,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 12px',
                background: 'transparent',
                color: T.statusDanger,
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.06em',
                border: `1px solid transparent`,
              }}
            >
              <Trash2 size={13} strokeWidth={1.75} /> Remove screen
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: T.statusDanger, fontWeight: 600 }}>
                Remove permanently?
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: `1px solid ${T.line2}`, background: 'transparent', color: T.fgBrand,
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
                }}
              >Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  background: T.statusDanger, color: T.fgOnDark, border: 'none',
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                }}
              >{deleting ? 'Removing…' : 'Yes, remove'}</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => onRefresh?.(screen)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 14px', background: 'transparent',
                color: T.fgBrand, border: `1px solid ${T.line2}`, borderRadius: 999,
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
              }}
            >
              <RefreshCw size={13} strokeWidth={1.75} /> Refresh
            </button>
            <button
              onClick={() => onEdit?.(screen)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', background: T.arcNavy, color: T.fgOnDark,
                border: 'none', borderRadius: 999,
                fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
              }}
            >
              <Edit3 size={13} strokeWidth={1.75} /> Edit
            </button>
          </div>
        </div>
      </div>
    </div>
    {consoleOpen && <ConsoleModal screen={screen} onClose={() => setConsoleOpen(false)} />}
    </>
  );
}

function ActionPill({ children, icon, onClick, disabled, title, as = 'button', href }) {
  const style = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '8px 14px',
    border: `1px solid ${T.line2}`,
    background: T.bgSurface,
    color: disabled ? T.fg3 : T.fgBrand,
    borderRadius: 999,
    fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.06em',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
  };
  if (as === 'a') {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={style}>
        {icon}{children}
      </a>
    );
  }
  return (
    <button onClick={disabled ? undefined : onClick} title={title} disabled={disabled} style={style}>
      {icon}{children}
    </button>
  );
}

function StatsGrid({ uptimeQ, metricsQ }) {
  const u = uptimeQ.data;
  const m = metricsQ.data;

  return (
    <div>
      <SectionLabel>Health</SectionLabel>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
      }}>
        {/* Uptime · 7d */}
        <StatCard label="UPTIME · 7D">
          {uptimeQ.loading ? (
            <Loading />
          ) : uptimeQ.error ? (
            <Failed />
          ) : u ? (
            <BigStat
              value={`${u.uptimePct}%`}
              warn={u.uptimePct < 95}
              chart={<Sparkline values={u.history} color={u.uptimePct < 95 ? T.statusWarn : T.arcSage} height={26} />}
            />
          ) : <NoData />}
        </StatCard>

        {/* Bandwidth · 24h */}
        <StatCard label="BANDWIDTH · 24H">
          {metricsQ.loading ? <Loading />
            : metricsQ.error ? <Failed />
            : m ? <BandwidthCardBody m={m} />
            : <NoData />}
        </StatCard>

        {/* Restarts · 7d */}
        <StatCard label="RESTARTS · 7D">
          {metricsQ.loading ? <Loading />
            : metricsQ.error ? <Failed />
            : m ? <RestartsCardBody m={m} />
            : <NoData />}
        </StatCard>

        {/* Response time */}
        <StatCard label="RESPONSE TIME">
          {metricsQ.loading ? <Loading />
            : metricsQ.error ? <Failed />
            : m ? <ResponseTimeCardBody m={m} />
            : <NoData />}
        </StatCard>
      </div>

      {/* Load + memory — wide card under the grid, only when there's data */}
      {m && (m.load?.avg != null || m.memory?.totalMb) && (
        <div style={{ marginTop: 12 }}>
          <LoadMemCard m={m} />
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <span style={{ color: T.fg3, fontSize: 12 }}>Loading…</span>;
}
function Failed() {
  return <span style={{ color: T.statusDanger, fontSize: 12 }}>Failed to load</span>;
}
function NoData() {
  return <span style={{ color: T.fg3, fontSize: 12 }}>No data yet</span>;
}

function BigStat({ value, sub, warn, chart }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{
          fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 26,
          color: warn ? T.statusWarn : T.fgBrand,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>{value}</span>
        {sub != null && (
          <div style={{
            fontFamily: T.fontMono, fontSize: 10.5, color: T.fg3, marginTop: 4,
          }}>{sub}</div>
        )}
      </div>
      {chart && <div style={{ flex: 1, minWidth: 0 }}>{chart}</div>}
    </div>
  );
}

function BandwidthCardBody({ m }) {
  const total = m.bandwidth?.totalBytes24h ?? 0;
  const rx = m.bandwidth?.rxBytes24h ?? 0;
  const tx = m.bandwidth?.txBytes24h ?? 0;
  const series = (m.bandwidth?.rxHistory || []).map((v, i) =>
    (v + (m.bandwidth?.txHistory?.[i] ?? 0)));
  return (
    <BigStat
      value={formatBytes(total)}
      sub={`↓ ${formatBytes(rx)} · ↑ ${formatBytes(tx)}`}
      chart={<Sparkline values={series} color={T.arcNavy500} height={26} />}
    />
  );
}

function RestartsCardBody({ m }) {
  const n = m.restarts?.total7d ?? 0;
  const lastBoot = m.restarts?.bootTimestamps?.[m.restarts.bootTimestamps.length - 1];
  const sub = lastBoot
    ? `last: ${formatRelative(lastBoot)}`
    : 'none in 7d';
  return (
    <BigStat
      value={String(n)}
      sub={sub}
      warn={n >= 3}
      chart={<Sparkline values={m.restarts?.history || []} color={n >= 3 ? T.statusWarn : T.arcSage} height={26} fill={false} />}
    />
  );
}

function ResponseTimeCardBody({ m }) {
  const p50 = m.responseTime?.p50Ms;
  const p95 = m.responseTime?.p95Ms;
  if (!Number.isFinite(p50)) return <NoData />;
  const series = (m.responseTime?.history || []).map(v => v ?? 0);
  return (
    <BigStat
      value={`${Math.round(p50)}ms`}
      sub={Number.isFinite(p95) ? `p95 ${Math.round(p95)}ms` : ''}
      warn={p50 > 500}
      chart={<Sparkline values={series} color={p50 > 500 ? T.statusWarn : T.arcSage} height={26} />}
    />
  );
}

function LoadMemCard({ m }) {
  const load = m.load?.avg;
  const memUsed = m.memory?.usedMb;
  const memTotal = m.memory?.totalMb;
  const memPct = memTotal ? Math.round((memUsed / memTotal) * 100) : null;
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      {load != null && (
        <div>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', color: T.fg3, textTransform: 'uppercase',
          }}>Load · 1m</div>
          <div style={{
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 18,
            color: load > 1.5 ? T.statusWarn : T.fgBrand,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
          }}>{load.toFixed(2)}</div>
        </div>
      )}
      {memTotal != null && (
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            fontFamily: T.fontDisplay, fontSize: 10, fontWeight: 700,
            letterSpacing: '0.14em', color: T.fg3, textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            <span>Memory</span>
            <span style={{ fontFamily: T.fontMono, color: T.fg2, letterSpacing: 0 }}>
              {memUsed}/{memTotal} MB
            </span>
          </div>
          <div style={{
            height: 6, background: T.bgInset, borderRadius: 999, overflow: 'hidden',
          }}>
            <div style={{
              width: `${memPct}%`, height: '100%',
              background: memPct > 85 ? T.statusWarn : T.arcSage,
              transition: 'width 200ms',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

function StatCard({ label, children }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line1}`,
      borderRadius: 12,
      padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{
        fontFamily: T.fontDisplay, fontSize: 10.5, fontWeight: 700,
        letterSpacing: '0.14em', color: T.fg3, textTransform: 'uppercase',
      }}>{label}</span>
      {children}
    </div>
  );
}

function RotationSchedule({ urls, currentUrl }) {
  return (
    <div>
      <SectionLabel>URL rotation</SectionLabel>
      <div style={{
        background: T.bgSurface,
        border: `1px solid ${T.line1}`,
        borderRadius: 12,
        padding: 8,
        display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        {urls.map((u, i) => {
          const isNow = u.url === currentUrl;
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px',
              borderRadius: 8,
              background: isNow ? T.arcYellow50 : 'transparent',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: T.arcNavy, color: T.fgOnDark,
                fontFamily: T.fontMono, fontSize: 10,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{i + 1}</div>
              <span style={{
                flex: 1, fontFamily: T.fontMono, fontSize: 11, color: T.fg1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{(u.url || '').replace(/^https?:\/\//, '')}</span>
              <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3, flexShrink: 0 }}>
                {u.duration}s
              </span>
              {isNow && (
                <span style={{
                  background: T.arcYellow, color: T.arcNavy,
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 9,
                  letterSpacing: '0.14em', padding: '3px 8px', borderRadius: 999,
                }}>NOW</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecentActivity({ query, screenName }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <SectionLabel inline>Recent activity</SectionLabel>
      </div>
      <div style={{
        background: T.bgSurface,
        border: `1px solid ${T.line1}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        {query.loading ? (
          <div style={{ padding: 16, color: T.fg3, fontSize: 12 }}>Loading…</div>
        ) : query.error ? (
          <div style={{ padding: 16, color: T.statusDanger, fontSize: 12 }}>Failed to load</div>
        ) : query.data && query.data.length > 0 ? (
          query.data.map((ev, idx) => (
            <div
              key={ev.id || idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px',
                borderBottom: idx < query.data.length - 1 ? `1px solid ${T.line1}` : 'none',
              }}
            >
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: kindColor(ev.type), flexShrink: 0,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: T.fg1, lineHeight: 1.4 }}>{ev.detail || ev.type}</div>
              </div>
              <div style={{ fontFamily: T.fontMono, fontSize: 10, color: T.fg3, flexShrink: 0 }}>
                {formatActivityTime(ev.timestamp)}
              </div>
            </div>
          ))
        ) : (
          <div style={{ padding: 16, color: T.fg3, fontSize: 12 }}>No recent events.</div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ k, v, mono, last }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 0',
      borderBottom: last ? 'none' : `1px solid ${T.line1}`,
      gap: 12,
    }}>
      <span style={{
        fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
        letterSpacing: '0.06em', color: T.fg3, textTransform: 'uppercase',
      }}>{k}</span>
      <span style={{
        fontFamily: mono ? T.fontMono : T.fontBody,
        fontSize: 13, color: T.fg1,
        textAlign: 'right',
        overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{v}</span>
    </div>
  );
}

function SectionLabel({ children, inline }) {
  return (
    <div style={{
      fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
      letterSpacing: '0.14em', color: T.fgAccent, textTransform: 'uppercase',
      marginBottom: inline ? 0 : 8,
    }}>{children}</div>
  );
}

function kindColor(type) {
  switch (type) {
    case 'online':  return T.arcSage;
    case 'offline': return T.statusDanger;
    case 'refresh': return T.arcNavy500;
    case 'edit':    return T.arcNavy;
    case 'add':     return T.arcSage;
    case 'remove':  return T.statusDanger;
    case 'rotation':return T.arcYellow;
    default:        return T.fg3;
  }
}
