const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');
const { features } = require('./config/features');

/**
 * Where the database files live.
 *
 * render.yaml mounts the persistent disk at
 *   /opt/render/project/src/backend/data
 * which is exactly `<this file>/../data`, because Render checks the repo out
 * at /opt/render/project/src. So one path works both locally and in
 * production — the NODE_ENV branch was never needed.
 *
 * The previous code used /data in production instead. That directory is not
 * the mounted disk, so every deploy started from an empty database: users,
 * brands, invoices and merchants written in production did not survive a
 * redeploy. LEGACY_DIR is that old location, kept so the data can be recovered.
 */
const MOUNTED_DIR = path.join(__dirname, '../data');
const LEGACY_DIR = '/data';

const COLLECTIONS = {
  users: 'users.db',
  brands: 'brands.db',
  invoices: 'invoices.db',
  merchants: 'merchants.db',
  brandMerchants: 'brand_merchants.db',
  userBrands: 'user_brands.db',
  notifications: 'notifications.db',
  verificationCodes: 'verification_codes.db',
  systemSettings: 'system_settings.db',
  otpCodes: 'otp_codes.db',
};

/**
 * Copies anything still sitting in the old location across to the disk.
 *
 * Only ever writes where the new side is missing or empty, and never deletes
 * from the old side — so running it repeatedly is harmless, and if the result
 * looks wrong the originals are still there to fall back on.
 */
function migrateLegacyData(fromDir, toDir) {
  if (fromDir === toDir) return;
  if (!fs.existsSync(fromDir)) return;

  const moved = [];
  for (const fileName of Object.values(COLLECTIONS)) {
    const source = path.join(fromDir, fileName);
    const target = path.join(toDir, fileName);

    if (!fs.existsSync(source)) continue;
    if (fs.statSync(source).size === 0) continue;

    // Never overwrite data that already exists on the disk.
    if (fs.existsSync(target) && fs.statSync(target).size > 0) continue;

    fs.copyFileSync(source, target);
    moved.push(fileName);
  }

  if (moved.length > 0) {
    console.log(
      `[db] recovered ${moved.length} database file(s) from ${fromDir}: ${moved.join(', ')}`
    );
    console.log('[db] the originals were left in place and can be deleted once verified');
  }
}

/**
 * PT_DATA_DIR overrides the location outright.
 *
 * Useful if the disk is ever remounted somewhere else, and it is what the
 * toggle tests use so they never touch real data.
 */
const OVERRIDE_DIR = process.env.PT_DATA_DIR || process.env.PT_TEST_DATA_DIR || '';

const dbDir = OVERRIDE_DIR
  ? OVERRIDE_DIR
  : features.persistentDataPath
    ? MOUNTED_DIR
    : process.env.NODE_ENV === 'production'
      ? LEGACY_DIR
      : MOUNTED_DIR;

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

if (features.persistentDataPath) {
  try {
    migrateLegacyData(LEGACY_DIR, dbDir);
  } catch (err) {
    // Recovery is best effort: a failure here must not stop the app booting.
    console.error('[db] could not check the old data directory:', err.message);
  }
}

console.log(`[db] using ${dbDir}`);

const db = {};
for (const [key, fileName] of Object.entries(COLLECTIONS)) {
  db[key] = new Datastore({ filename: path.join(dbDir, fileName), autoload: true });
}

// Promisify helpers
function promisify(ds) {
  return {
    findOne: (q) => new Promise((res, rej) => ds.findOne(q, (e, d) => e ? rej(e) : res(d))),
    find: (q, sort) => new Promise((res, rej) => {
      let cursor = ds.find(q);
      if (sort) cursor = cursor.sort(sort);
      cursor.exec((e, d) => e ? rej(e) : res(d));
    }),
    insert: (doc) => new Promise((res, rej) => ds.insert(doc, (e, d) => e ? rej(e) : res(d))),
    update: (q, upd, opts = {}) => new Promise((res, rej) => ds.update(q, upd, opts, (e, n, d) => e ? rej(e) : res(opts.returnUpdatedDocs ? d : n))),
    remove: (q, opts = {}) => new Promise((res, rej) => ds.remove(q, opts, (e, n) => e ? rej(e) : res(n))),
    count: (q) => new Promise((res, rej) => ds.count(q, (e, n) => e ? rej(e) : res(n))),
  };
}

const api = {};
for (const key of Object.keys(COLLECTIONS)) {
  api[key] = promisify(db[key]);
}

/** Exposed for the health endpoint, so the live path is visible remotely. */
api.__dataDir = dbDir;

module.exports = api;
