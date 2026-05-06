// Relative-time helpers used across tiles, drill panels, and the activity log.

export function formatRelative(input, now = new Date()) {
  if (!input) return '—';
  const t = typeof input === 'string' ? new Date(input).getTime() : input;
  if (!Number.isFinite(t)) return '—';
  const seconds = Math.max(0, Math.round((now.getTime() - t) / 1000));
  if (seconds < 60)         return `${seconds}s ago`;
  if (seconds < 3600)       return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400)     return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86_400) return `${Math.floor(seconds / 86_400)}d ago`;
  return new Date(t).toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

// "Today · 14:30", "Yesterday · 09:15", "Mon 28 Apr · 08:12"
export function formatActivityTime(input, now = new Date()) {
  if (!input) return '';
  const t = typeof input === 'string' ? new Date(input).getTime() : input;
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const ystdy0 = new Date(today0.getTime() - 86_400_000);
  const hhmm = d.toTimeString().slice(0, 5);
  if (t >= today0.getTime()) return `Today · ${hhmm}`;
  if (t >= ystdy0.getTime()) return `Yesterday · ${hhmm}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' })} · ${hhmm}`;
}

// "TODAY", "YESTERDAY", "MON 28 APR" — used as activity-page day group headers.
export function formatDayHeader(input, now = new Date()) {
  if (!input) return '';
  const t = typeof input === 'string' ? new Date(input).getTime() : input;
  if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const ystdy0 = new Date(today0.getTime() - 86_400_000);
  const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
  if (dayStart.getTime() === today0.getTime()) return 'TODAY';
  if (dayStart.getTime() === ystdy0.getTime()) return 'YESTERDAY';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
}
