// Schedule CRUD. Per-screen time blocks that swap a playlist in for a
// window of the day. Resolution at heartbeat time uses scheduler.js.

import express from 'express';
import {
  getSchedules, getSchedule, addSchedule, updateSchedule, deleteSchedule,
  getScreen, logActivity,
} from '../storage.js';
import { findConflicts } from '../scheduler.js';

export const schedulesRouter = express.Router();

schedulesRouter.get('/', (req, res) => {
  const { screenId } = req.query;
  let list = getSchedules();
  if (screenId) list = list.filter(s => s.screenId === screenId);
  res.json({ schedules: list });
});

schedulesRouter.post('/', async (req, res) => {
  const { screenId, playlistId, days, startMin, endMin } = req.body || {};
  if (!screenId || !playlistId || !Array.isArray(days) || !Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    return res.status(400).json({ error: 'missing/invalid fields' });
  }
  if (endMin <= startMin) {
    return res.status(400).json({ error: 'endMin must be after startMin (use two blocks for overnight)' });
  }
  const screen = getScreen(screenId);
  if (!screen) return res.status(404).json({ error: 'screen not found' });

  const id = `sched-${Date.now()}`;
  const schedule = {
    id, screenId, playlistId,
    days, startMin, endMin,
    createdAt: new Date().toISOString(),
  };

  const conflicts = findConflicts(getSchedules(), schedule).map(c => c.id);
  await addSchedule(schedule);
  await logActivity({
    type: 'edit', screen: screen.name, user: 'Chuck',
    detail: `Schedule added (${prettyTime(startMin)}–${prettyTime(endMin)}, ${dayNames(days)})`,
  });

  res.status(201).json({ schedule, conflicts });
});

schedulesRouter.put('/:id', async (req, res) => {
  const before = getSchedule(req.params.id);
  if (!before) return res.status(404).json({ error: 'not found' });
  const { playlistId, days, startMin, endMin } = req.body || {};
  const patch = {};
  if (playlistId !== undefined) patch.playlistId = playlistId;
  if (Array.isArray(days)) patch.days = days;
  if (Number.isFinite(startMin)) patch.startMin = startMin;
  if (Number.isFinite(endMin)) patch.endMin = endMin;
  const updated = await updateSchedule(req.params.id, patch);
  res.json(updated);
});

schedulesRouter.delete('/:id', async (req, res) => {
  const removed = await deleteSchedule(req.params.id);
  if (!removed) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

function prettyTime(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
function dayNames(days) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.slice().sort().map(d => names[d]).join('/');
}
