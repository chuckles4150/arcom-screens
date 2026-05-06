import { describe, it, expect } from 'vitest';
import { pickActive, findConflicts } from './scheduler.js';

// Tuesday 2026-05-12 at 09:30 local time. getDay() === 2.
const TUE_0930 = new Date(2026, 4, 12, 9, 30, 0);

const sched = (id, screenId, days, startMin, endMin, createdAt = '2026-05-01T00:00:00Z') => ({
  id, screenId, playlistId: `pl-${id}`, days, startMin, endMin, createdAt,
});

describe('pickActive', () => {
  it('returns null when there are no schedules', () => {
    expect(pickActive([], 'screen-1', TUE_0930)).toBe(null);
  });

  it('returns null when no schedule covers the moment', () => {
    const list = [sched('a', 'screen-1', [1, 3, 5], 360, 540)]; // Mon/Wed/Fri 06–09
    expect(pickActive(list, 'screen-1', TUE_0930)).toBe(null);
  });

  it('returns the matching schedule for the right day + time', () => {
    const list = [sched('a', 'screen-1', [2], 360, 600)]; // Tue 06:00–10:00
    expect(pickActive(list, 'screen-1', TUE_0930)?.id).toBe('a');
  });

  it('only considers the requested screen', () => {
    const list = [sched('a', 'screen-OTHER', [2], 360, 600)];
    expect(pickActive(list, 'screen-1', TUE_0930)).toBe(null);
  });

  it('most-recent createdAt wins when two overlap', () => {
    const list = [
      sched('a', 'screen-1', [2], 360, 600, '2026-05-01T00:00:00Z'),
      sched('b', 'screen-1', [2], 480, 720, '2026-05-05T00:00:00Z'), // overlaps & newer
    ];
    expect(pickActive(list, 'screen-1', TUE_0930)?.id).toBe('b');
  });

  it('treats endMin as exclusive', () => {
    // Tue at exactly 09:30 — endMin=570 (=09:30) should NOT match.
    const list = [sched('a', 'screen-1', [2], 360, 570)];
    expect(pickActive(list, 'screen-1', TUE_0930)).toBe(null);
  });
});

describe('findConflicts', () => {
  it('flags schedules that share a day and overlap in time', () => {
    const existing = [sched('a', 'screen-1', [1, 2], 360, 600)];
    const candidate = sched('b', 'screen-1', [2, 3], 540, 720);
    expect(findConflicts(existing, candidate).map(s => s.id)).toEqual(['a']);
  });

  it('does not flag back-to-back blocks (touching but not overlapping)', () => {
    const existing = [sched('a', 'screen-1', [2], 360, 600)];
    const candidate = sched('b', 'screen-1', [2], 600, 720); // starts where a ends
    expect(findConflicts(existing, candidate)).toEqual([]);
  });

  it('does not flag different screens', () => {
    const existing = [sched('a', 'screen-1', [2], 360, 600)];
    const candidate = sched('b', 'screen-2', [2], 360, 600);
    expect(findConflicts(existing, candidate)).toEqual([]);
  });

  it('skips itself when computing conflicts', () => {
    const existing = [sched('a', 'screen-1', [2], 360, 600)];
    const candidate = { ...existing[0] }; // same id
    expect(findConflicts(existing, candidate)).toEqual([]);
  });
});
