// Simple shared-password auth. Dashboard sends the password in
// the Authorization header on every API call. No sessions, no JWTs —
// this is an internal tool on a Cloudflare-tunnelled subdomain.

const PASSWORD = process.env.DASHBOARD_PASSWORD;

if (!PASSWORD) {
  console.warn('⚠  DASHBOARD_PASSWORD not set — auth is DISABLED');
}

export function authMiddleware(req, res, next) {
  if (!PASSWORD) return next(); // dev mode fallback

  const header = req.headers.authorization || '';
  const provided = header.replace(/^Bearer\s+/i, '');

  if (provided !== PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  next();
}
