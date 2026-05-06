// Pure module: pickActive(schedules, screenId, now) → schedule | null.
//
// A schedule has shape:
//   { id, screenId, playlistId, days: [0..6], startMin, endMin, createdAt }
// where 0=Sun, 6=Sat (matches Date#getDay), startMin/endMin are minutes
// from local midnight, end is exclusive.
//
// If multiple schedules match the same minute, the most recently created
// one wins — deterministic and easy for the user to reason about.

export function pickActive(schedules, screenId, now = new Date()) {
  if (!Array.isArray(schedules) || schedules.length === 0) return null;
  const day = now.getDay();
  const minOfDay = now.getHours() * 60 + now.getMinutes();

  const candidates = schedules.filter(s => {
    if (s.screenId !== screenId) return false;
    const days = Array.isArray(s.days) ? s.days : [];
    if (!days.includes(day)) return false;
    const start = Number.isFinite(s.startMin) ? s.startMin : 0;
    const end = Number.isFinite(s.endMin) ? s.endMin : 0;
    if (end <= start) return false;
    return minOfDay >= start && minOfDay < end;
  });

  if (candidates.length === 0) return null;
  // Most recent createdAt wins. createdAt is an ISO string; lexicographic
  // sort matches chronological for ISO-8601.
  candidates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return candidates[0];
}

// Detects whether a NEW schedule would overlap any existing one for the
// same screen on at least one shared day. Used by the dashboard at create
// time to surface a conflict warning (doesn't block save).
export function findConflicts(schedules, candidate) {
  if (!candidate || !candidate.screenId) return [];
  return schedules.filter(s => {
    if (s.id === candidate.id) return false;
    if (s.screenId !== candidate.screenId) return false;
    const sharedDays = (s.days || []).some(d => (candidate.days || []).includes(d));
    if (!sharedDays) return false;
    const overlap = candidate.startMin < s.endMin && s.startMin < candidate.endMin;
    return overlap;
  });
}
