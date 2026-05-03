import React, { useState, useMemo } from 'react';
import { AlertTriangle, RefreshCw, Upload, Cpu } from 'lucide-react';
import { T } from '../../theme.js';
import { api } from '../../api.js';
import { usePolling } from '../../hooks/useFetch.js';
import { ActivityRow } from '../activity/ActivityRow.jsx';
import { ActivityFilters, kindOf } from '../activity/ActivityFilters.jsx';
import { formatDayHeader } from '../../utils/time.js';

const POLL_MS = 30_000;
const PAGE_SIZE = 100;

export function ActivityPage({ onError }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState('all');
  const eventsQ = usePolling(() => api.listActivity({ limit }), POLL_MS, [limit]);

  const events = eventsQ.data || [];

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    return events.filter(e => kindOf(e) === filter);
  }, [events, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);
  const todayCount = useMemo(() => {
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    return events.filter(e => new Date(e.timestamp).getTime() >= today0.getTime()).length;
  }, [events]);

  const summary24h = useMemo(() => summarise24h(events), [events]);

  if (eventsQ.error) {
    onError?.(eventsQ.error.message || 'Failed to load activity');
  }

  return (
    <div style={{ padding: '24px 32px 64px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Page-head */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3, marginBottom: 4,
          }}>
            Activity log · Live
          </div>
          <h1 style={{
            margin: 0,
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32,
            color: T.fgBrand, letterSpacing: '-0.015em', lineHeight: 1.05,
          }}>
            Activity
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: T.fg2 }}>
            Every event across the screen network — incidents, content changes, system events
          </p>
          <div style={{ height: 3, background: T.arcYellow, width: 56, borderRadius: 2, marginTop: 8 }} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3,
          }}>
            Today
          </div>
          <div style={{
            fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 28, color: T.fgBrand,
          }}>
            {todayCount} <span style={{ fontSize: 14, color: T.fg3, fontWeight: 600 }}>events</span>
          </div>
        </div>
      </div>

      {/* Summary metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <SummaryCard label="Incidents · 24h" Icon={AlertTriangle} color={T.statusDanger} value={summary24h.incident} delta={summary24h.incidentDelta} />
        <SummaryCard label="Refreshes · 24h" Icon={RefreshCw}     color={T.arcSage}      value={summary24h.refresh}  delta={summary24h.refreshDelta}  />
        <SummaryCard label="Content updates" Icon={Upload}         color={T.arcNavy500}   value={summary24h.content}  delta={summary24h.contentDelta}  />
        <SummaryCard label="System events"   Icon={Cpu}             color={T.arcYellow600} value={summary24h.system}   delta={summary24h.systemDelta}   />
      </div>

      <ActivityFilters value={filter} onChange={setFilter} events={events} />

      {/* Day-grouped list */}
      {filtered.length === 0 ? (
        <Empty hasFilter={filter !== 'all'} onClear={() => setFilter('all')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map(group => (
            <div key={group.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12,
                  letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fgBrand,
                }}>{group.label}</span>
                <span style={{ flex: 1, height: 1, background: T.line2 }} />
                <span style={{ fontFamily: T.fontMono, fontSize: 11, color: T.fg3 }}>
                  {group.events.length} event{group.events.length === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{
                background: T.bgSurface,
                border: `1px solid ${T.line1}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                {group.events.map((ev, idx) => (
                  <div key={ev.id || idx} style={{
                    borderBottomColor: idx === group.events.length - 1 ? 'transparent' : T.line1,
                  }}>
                    <ActivityRow event={ev} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {events.length === limit && (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => setLimit(l => l + PAGE_SIZE)}
            style={{
              padding: '10px 18px',
              background: 'transparent', color: T.fgBrand,
              border: `1px solid ${T.line2}`, borderRadius: 999,
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
            }}
          >Load more</button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, Icon, color, value, delta }) {
  return (
    <div style={{
      background: T.bgSurface,
      border: `1px solid ${T.line2}`,
      borderRadius: 14,
      padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: T.shadowSm,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: T.fontDisplay, fontSize: 10.5, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', color: T.fg3,
        }}>{label}</span>
        <Icon size={16} strokeWidth={1.75} color={color} />
      </div>
      <span style={{
        fontFamily: T.fontDisplay, fontWeight: 800, fontSize: 32, color: T.fgBrand,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>{value}</span>
      {delta != null && (
        <span style={{
          fontFamily: T.fontMono, fontSize: 11,
          color: delta > 0 ? T.statusWarn : delta < 0 ? T.statusOk : T.fg3,
        }}>
          {delta === 0 ? 'same as yesterday' : `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)} vs yesterday`}
        </span>
      )}
    </div>
  );
}

function Empty({ hasFilter, onClear }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.line1}`, borderRadius: 14,
      padding: '48px 24px', textAlign: 'center',
    }}>
      <p style={{ margin: 0, color: T.fg3, fontSize: 13 }}>
        {hasFilter ? 'No events match this filter.' : 'No events recorded yet.'}
      </p>
      {hasFilter && (
        <button
          onClick={onClear}
          style={{
            marginTop: 10,
            padding: '8px 16px',
            background: 'transparent', color: T.fgBrand,
            border: `1px solid ${T.line2}`, borderRadius: 999,
            fontFamily: T.fontDisplay, fontWeight: 700, fontSize: 11.5, letterSpacing: '0.06em',
          }}
        >Clear filter</button>
      )}
    </div>
  );
}

function groupByDay(events) {
  const groups = new Map();
  for (const ev of events) {
    const label = formatDayHeader(ev.timestamp);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(ev);
  }
  return Array.from(groups.entries()).map(([label, events]) => ({ label, events }));
}

function summarise24h(events) {
  const now = Date.now();
  const day = 86_400_000;
  const last24 = events.filter(e => new Date(e.timestamp).getTime() >= now - day);
  const prev24 = events.filter(e => {
    const t = new Date(e.timestamp).getTime();
    return t >= now - 2 * day && t < now - day;
  });
  const c = (list, k) => list.filter(e => kindOf(e) === k).length;

  const incident = c(last24, 'incident');
  const refresh  = c(last24, 'refresh');
  const content  = c(last24, 'content');
  const system   = c(last24, 'system');
  return {
    incident, refresh, content, system,
    incidentDelta: incident - c(prev24, 'incident'),
    refreshDelta:  refresh - c(prev24, 'refresh'),
    contentDelta:  content - c(prev24, 'content'),
    systemDelta:   system - c(prev24, 'system'),
  };
}
