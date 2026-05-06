// Dashboard settings. Currently houses the alert webhook config; future
// phases can extend without churning the router.

import express from 'express';
import { getSettings, updateSettings, getScreens, getScreen } from '../storage.js';
import { fireAlert, formatAlertMessage } from '../alerter.js';

export const settingsRouter = express.Router();

// Mask the webhook URL on read so it doesn't leak to anyone with dashboard
// access who shouldn't see the secret token. Configured? Yes/no + last few
// chars are usually enough for ops.
function publicView(s) {
  const url = s.alertWebhookUrl || '';
  const tail = url.length > 8 ? '…' + url.slice(-6) : '';
  return {
    ...s,
    alertWebhookUrlMask: url ? `webhook${tail}` : '',
    alertWebhookConfigured: Boolean(url),
    alertWebhookUrl: undefined,
  };
}

settingsRouter.get('/', (req, res) => {
  res.json(publicView(getSettings()));
});

settingsRouter.put('/', async (req, res) => {
  const { alertWebhookUrl, alertOnOffline, alertOnReboot, alertCooldownMinutes } = req.body || {};
  const patch = {};
  if (alertWebhookUrl !== undefined) patch.alertWebhookUrl = String(alertWebhookUrl).trim();
  if (typeof alertOnOffline === 'boolean') patch.alertOnOffline = alertOnOffline;
  if (typeof alertOnReboot === 'boolean') patch.alertOnReboot = alertOnReboot;
  if (Number.isFinite(alertCooldownMinutes) && alertCooldownMinutes >= 0) {
    patch.alertCooldownMinutes = Math.min(60, alertCooldownMinutes);
  }
  const updated = await updateSettings(patch);
  res.json(publicView(updated));
});

// Manual one-off — used by the Settings "Send test" button and the
// incident bar's "ALERT TEAM" button. Force=true bypasses cooldown.
settingsRouter.post('/alert-test', async (req, res) => {
  const { screenId, kind = 'test' } = req.body || {};
  const screen = screenId ? getScreen(screenId) : null;
  const message = formatAlertMessage(screen, kind, { from: 'dashboard' });
  const result = await fireAlert({
    settings: getSettings(), screen, kind, message, force: true,
  });
  res.json(result);
});
