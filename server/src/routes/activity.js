// Activity feed — read-only for the dashboard.
// Writes happen internally from screen routes.

import express from 'express';
import { getActivity } from '../storage.js';

export const activityRouter = express.Router();

activityRouter.get('/', (req, res) => {
  res.json({ activity: getActivity() });
});
