const { features } = require('../config/features');

/**
 * A small fixed-window limiter for the login endpoint.
 *
 * There was nothing stopping an attacker working through passwords against
 * /api/auth/login as fast as the network allowed, and the super admin password
 * is eight lowercase characters — well within reach of an unthrottled loop.
 *
 * Deliberately hand-rolled rather than pulling in express-rate-limit: this is
 * one small file with no supply chain attached, and the app runs as a single
 * Render instance so an in-memory counter is accurate. If it is ever scaled to
 * more than one instance this becomes per-instance and should move to a shared
 * store.
 *
 * Only failures count. Someone signing in correctly all day is not attacking
 * anything, and locking out a busy office would be its own outage.
 */

const WINDOW_MS = Number(process.env.LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);
const MAX_FAILURES = Number(process.env.LOGIN_RATE_MAX || 10);

const attempts = new Map();

function keyFor(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (forwarded ? String(forwarded).split(',')[0] : req.ip || '').trim();
  const username = req.body && req.body.username ? String(req.body.username).toLowerCase() : '';
  return `${ip}|${username}`;
}

/** Drops expired entries so the map cannot grow without bound. */
function sweep(now) {
  for (const [key, entry] of attempts) {
    if (now - entry.first > WINDOW_MS) attempts.delete(key);
  }
}

function loginRateLimit(req, res, next) {
  if (!features.loginRateLimit) return next();

  const now = Date.now();
  if (attempts.size > 5000) sweep(now);

  const key = keyFor(req);
  const entry = attempts.get(key);

  if (entry && now - entry.first < WINDOW_MS && entry.count >= MAX_FAILURES) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.first)) / 1000);
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      message: `Too many failed sign-in attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
    });
  }

  // Let the route report the outcome, and only count the failures.
  res.on('finish', () => {
    if (res.statusCode < 400) {
      attempts.delete(key);
      return;
    }
    if (res.statusCode === 429) return;

    const current = attempts.get(key);
    if (current && now - current.first < WINDOW_MS) {
      current.count += 1;
    } else {
      attempts.set(key, { count: 1, first: now });
    }
  });

  next();
}

/** Exposed for tests. */
function reset() {
  attempts.clear();
}

module.exports = { loginRateLimit, reset, WINDOW_MS, MAX_FAILURES };
