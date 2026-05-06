// Playlist CRUD. Reusable named URL collections that screens can reference.
// A screen's `playlistId` overrides its inline `urls` at heartbeat time
// (resolved by routes/screens.js).

import express from 'express';
import {
  getPlaylists, getPlaylist, addPlaylist, updatePlaylist, deletePlaylist,
  getScreens, logActivity,
} from '../storage.js';

export const playlistsRouter = express.Router();

// List all + a "used by" count per playlist (computed from screens).
playlistsRouter.get('/', (req, res) => {
  const screens = getScreens();
  const playlists = getPlaylists().map(p => ({
    ...p,
    usedBy: screens.filter(s => s.playlistId === p.id).length,
  }));
  res.json({ playlists });
});

playlistsRouter.get('/:id', (req, res) => {
  const playlist = getPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'not found' });
  res.json(playlist);
});

playlistsRouter.post('/', async (req, res) => {
  const { name, urls } = req.body || {};
  if (!name) return res.status(400).json({ error: 'missing name' });
  const id = `playlist-${Date.now()}`;
  const playlist = {
    id, name,
    urls: Array.isArray(urls) ? urls : [],
    createdAt: new Date().toISOString(),
  };
  await addPlaylist(playlist);
  await logActivity({ type: 'edit', screen: '—', user: 'Chuck', detail: `Playlist created: ${name}` });
  res.status(201).json(playlist);
});

playlistsRouter.put('/:id', async (req, res) => {
  const before = getPlaylist(req.params.id);
  if (!before) return res.status(404).json({ error: 'not found' });
  const { name, urls } = req.body || {};
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (urls !== undefined) patch.urls = urls;
  const updated = await updatePlaylist(req.params.id, patch);
  await logActivity({ type: 'edit', screen: '—', user: 'Chuck', detail: `Playlist updated: ${updated.name}` });
  res.json(updated);
});

playlistsRouter.delete('/:id', async (req, res) => {
  const removed = await deletePlaylist(req.params.id);
  if (!removed) return res.status(404).json({ error: 'not found' });
  await logActivity({ type: 'remove', screen: '—', user: 'Chuck', detail: `Playlist removed: ${removed.name}` });
  res.json({ ok: true });
});
