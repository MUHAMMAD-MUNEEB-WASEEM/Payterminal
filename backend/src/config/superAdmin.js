const crypto = require('crypto');
const { features } = require('./features');

/**
 * The super admin account, which lives outside the database.
 *
 * The password used to be a literal in src/routes/auth.js, which means it is
 * in the git history and readable by anyone who has ever had a copy of this
 * repository. It controls maintenance mode and every brand, so it should come
 * from the environment.
 *
 * Rotating it is now a Render environment variable change, not a code change:
 *
 *   SUPER_ADMIN_USERNAME   defaults to "superadmin"
 *   SUPER_ADMIN_PASSWORD   the password
 *   SUPER_ADMIN_DISABLED   set to "true" to switch the account off entirely
 *
 * If SUPER_ADMIN_PASSWORD is not set the old password still works, so
 * deploying this cannot lock anyone out — but it warns on every boot until
 * the variable is set.
 */

/** The value that was committed to the repository. Treat as public. */
const LEGACY_PASSWORD = 'abcd1234';

const username = process.env.SUPER_ADMIN_USERNAME || 'superadmin';
const configured = process.env.SUPER_ADMIN_PASSWORD;
const disabled = String(process.env.SUPER_ADMIN_DISABLED || '').toLowerCase() === 'true';

let password;
let usingLegacyPassword;

if (!features.superAdminFromEnv) {
  password = LEGACY_PASSWORD;
  usingLegacyPassword = true;
} else if (configured && configured.trim()) {
  password = configured;
  usingLegacyPassword = false;
} else {
  password = LEGACY_PASSWORD;
  usingLegacyPassword = true;
}

/**
 * Constant-time comparison.
 *
 * `===` on a secret leaks its length and, in principle, how much of a guess
 * matched. The cost of doing it properly here is nothing.
 */
function safeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) {
    // Still compare something so the work does not depend on the length.
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function matches(inputUsername, inputPassword) {
  if (disabled) return false;
  if (typeof inputUsername !== 'string' || typeof inputPassword !== 'string') return false;
  // The username is not a secret, so a plain comparison is fine.
  if (inputUsername !== username) return false;
  return safeEquals(inputPassword, password);
}

function warnIfInsecure() {
  if (disabled) {
    console.log('[superadmin] account disabled by SUPER_ADMIN_DISABLED');
    return;
  }
  if (usingLegacyPassword) {
    // Worth saying in either mode, because the risk is the same either way:
    // this password is in the git history and cannot be un-published.
    const why = features.superAdminFromEnv
      ? 'SUPER_ADMIN_PASSWORD is not set'
      : 'PT_SUPERADMIN_MODE=legacy is in force';
    console.warn(
      `[superadmin] WARNING: using the password committed to this repository (${why}). ` +
        'Anyone who has ever had a copy of this repo can sign in as super admin. ' +
        'Set SUPER_ADMIN_PASSWORD in the Render environment to fix this.'
    );
  } else {
    console.log('[superadmin] password loaded from SUPER_ADMIN_PASSWORD');
  }
}

module.exports = {
  username,
  role: 'superadmin',
  email: 'superadmin@system.local',
  matches,
  warnIfInsecure,
  usingLegacyPassword,
  disabled,
};
