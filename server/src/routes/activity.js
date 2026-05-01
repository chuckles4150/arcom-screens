// Activity log endpoint — read-only.
import express from 'express';
import { getActivity } from '../storage.js';

export const activityRouter = express.Router();

activityRouter.get('/', (req, res) => {
  const { limit = 100, type, screen } = req.query;
  let activity = getActivity();

  if (type) activity = activity.filter(a => a.type === type);
  if (screen) activity = activity.filter(a => a.screen === screen);

  res.json({ activity: activity.slice(0, parseInt(limit, 10)) });
});
