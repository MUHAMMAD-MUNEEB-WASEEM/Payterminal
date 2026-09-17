/**
 * Feature toggles.
 *
 * Every behaviour change added on top of the original code is gated here so it
 * can be switched off without redeploying older code.
 *
 *   PT_MODE=latest   (default) — the updated behaviour
 *   PT_MODE=legacy             — exactly what the app did before
 *
 * Each feature also has its own variable, which wins over PT_MODE. That is the
 * escape hatch: if one change causes trouble in production you turn off that
 * one thing rather than reverting the whole lot.
 *
 *   PT_MODE=latest
 *   PT_CORS_MODE=legacy        # everything new except the CORS change
 *
 * Accepted values per feature: "latest" / "on" / "true"  and
 *                              "legacy" / "off" / "false".
 *
 * The defaults are chosen so that turning everything on cannot lock anyone out
 * of the system or break a working deployment — see the notes on each one.
 */

const MASTER = String(process.env.PT_MODE || 'latest').trim().toLowerCase();

const ON = new Set(['latest', 'on', 'true', '1', 'yes', 'new']);
const OFF = new Set(['legacy', 'off', 'false', '0', 'no', 'old', 'previous']);

function flag(name) {
  const raw = process.env[name];
  if (raw !== undefined && String(raw).trim() !== '') {
    const value = String(raw).trim().toLowerCase();
    if (ON.has(value)) return true;
    if (OFF.has(value)) return false;
    console.warn(
      `[features] ${name}="${raw}" is not a recognised value — falling back to PT_MODE=${MASTER}`
    );
  }
  return ON.has(MASTER);
}

const features = {
  /** Which mode the process came up in, for logging. */
  mode: ON.has(MASTER) ? 'latest' : 'legacy',

  /**
   * Write the database to the directory Render actually mounts the disk on.
   *
   * The old code wrote to /data in production while render.yaml mounts the
   * disk at <repo>/backend/data, so nothing written in production was on the
   * persistent disk. Safe to leave on: if the old location still holds data
   * and the new one is empty, the files are copied across before first use.
   * Nothing is ever deleted.
   */
  persistentDataPath: flag('PT_DATA_PATH_MODE'),

  /**
   * Read the super admin password from SUPER_ADMIN_PASSWORD instead of the
   * constant that was committed to git.
   *
   * Safe to leave on: if the variable is not set the old password still works,
   * with a warning on every boot. Nobody gets locked out by deploying this.
   */
  superAdminFromEnv: flag('PT_SUPERADMIN_MODE'),

  /**
   * Stop creating an "admin"/"admin" login on boot.
   *
   * Safe to leave on: an account is still created when the database is
   * completely empty, using ADMIN_INITIAL_PASSWORD, or a random password
   * printed once to the logs. What goes away is the publicly known default.
   */
  noDefaultAdminPassword: flag('PT_ADMIN_SEED_MODE'),

  /**
   * Make maintenance mode apply to the API, not just the React frontend.
   *
   * Previously the flag only hid the UI; the API kept accepting payments. Auth
   * and the maintenance endpoints themselves stay open so a super admin can
   * always sign in and switch it back off.
   */
  enforceMaintenance: flag('PT_MAINTENANCE_ENFORCE'),

  /**
   * Restrict CORS to ALLOWED_ORIGINS instead of reflecting any origin.
   *
   * Only takes effect when ALLOWED_ORIGINS is set, so turning this on without
   * configuring it leaves the current behaviour untouched.
   */
  corsAllowlist: flag('PT_CORS_MODE'),

  /** Throttle repeated failed logins from one IP. */
  loginRateLimit: flag('PT_RATE_LIMIT'),
};

/** One line at boot so the running configuration is never a guess. */
function describe() {
  const rows = Object.entries(features)
    .filter(([key]) => key !== 'mode')
    .map(([key, on]) => `${on ? '+' : '-'}${key}`);
  return `[features] PT_MODE=${features.mode} ${rows.join(' ')}`;
}

module.exports = { features, describe };
