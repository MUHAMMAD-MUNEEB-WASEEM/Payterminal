const jwt = require('jsonwebtoken');
const db = require('../db');
const { features } = require('../config/features');

/**
 * Makes maintenance mode mean something on the API.
 *
 * Before this, the flag only told the React app to render a 404 page. The API
 * carried on accepting requests, so anything not going through that UI — a
 * saved payment link, a script, the CRM, a browser with the page already
 * loaded — could still transact while the business was supposedly offline.
 * For a switch whose whole job is "take everything down", that was the gap.
 *
 * Always reachable, whatever the flag says:
 *   - signing in, so a super admin can get in to turn it off again
 *   - the maintenance endpoints themselves, for the same reason
 *   - the health check, so Render does not mark the service unhealthy
 *
 * Super admins bypass it entirely; everyone else gets 503.
 */

const ALWAYS_OPEN = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/maintenance-status',
  '/api/auth/maintenance-mode',
  '/api/auth/me',
];

let cached = { value: false, at: 0 };
const CACHE_MS = 5000;

/**
 * Reading a NeDB file on every request would be wasteful, and the flag changes
 * about once a year. Five seconds is short enough that switching it on takes
 * effect immediately in human terms.
 */
async function maintenanceEnabled() {
  const now = Date.now();
  if (now - cached.at < CACHE_MS) return cached.value;

  try {
    const settings = await db.systemSettings.findOne({ _id: 'system_maintenance' });
    cached = { value: Boolean(settings && settings.maintenanceMode), at: now };
  } catch (err) {
    // If the setting cannot be read, do not take the site down by accident.
    console.error('[maintenance] could not read the flag:', err.message);
    cached = { value: false, at: now };
  }
  return cached.value;
}

/** Called by the toggle endpoint so the change is not delayed by the cache. */
function invalidate() {
  cached = { value: cached.value, at: 0 };
}

function isSuperAdmin(req) {
  const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.role === 'superadmin';
  } catch {
    return false;
  }
}

async function maintenanceGate(req, res, next) {
  if (!features.enforceMaintenance) return next();

  const routePath = req.path || '';
  if (ALWAYS_OPEN.includes(routePath)) return next();

  let enabled;
  try {
    enabled = await maintenanceEnabled();
  } catch {
    return next();
  }
  if (!enabled) return next();

  if (isSuperAdmin(req)) return next();

  return res.status(503).json({
    message: 'PayTerminal is temporarily unavailable for maintenance.',
    maintenanceMode: true,
  });
}

module.exports = { maintenanceGate, invalidate, maintenanceEnabled };
