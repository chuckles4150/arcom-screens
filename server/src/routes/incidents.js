// Incident CRUD. Auto-create from watchdog offline events; auto-resolve
// on heartbeat (in routes/screens.js). Manual notes + status updates here.

import express from 'express';
import {
  getIncidents, getIncident, updateIncident, appendIncidentNote,
} from '../storage.js';

export const incidentsRouter = express.Router();

incidentsRouter.get('/', (req, res) => {
  const { status, screenId } = req.query;
  let list = getIncidents();
  if (status) list = list.filter(i => i.status === status);
  if (screenId) list = list.filter(i => i.screenId === screenId);
  res.json({ incidents: list });
});

incidentsRouter.get('/:id', (req, res) => {
  const inc = getIncident(req.params.id);
  if (!inc) return res.status(404).json({ error: 'not found' });
  res.json(inc);
});

incidentsRouter.put('/:id', async (req, res) => {
  const before = getIncident(req.params.id);
  if (!before) return res.status(404).json({ error: 'not found' });
  const { status } = req.body || {};
  const patch = {};
  if (status === 'open' || status === 'monitoring' || status === 'resolved') {
    patch.status = status;
    if (status === 'resolved' && !before.resolvedAt) {
      patch.resolvedAt = new Date().toISOString();
    } else if (status !== 'resolved') {
      patch.resolvedAt = null;
    }
  }
  const updated = await updateIncident(req.params.id, patch);
  res.json(updated);
});

incidentsRouter.post('/:id/notes', async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== 'string') return res.status(400).json({ error: 'missing text' });
  const updated = await appendIncidentNote(req.params.id, {
    ts: new Date().toISOString(),
    user: 'Chuck',
    text: text.slice(0, 1000),
  });
  if (!updated) return res.status(404).json({ error: 'not found' });
  res.json(updated);
});
