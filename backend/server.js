require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./src/db');
const { features, describe } = require('./src/config/features');
const SUPER_ADMIN = require('./src/config/superAdmin');
const { maintenanceGate } = require('./src/middleware/maintenance');

const app = express();

// Render terminates TLS in front of the app, so the client IP arrives in
// X-Forwarded-For. Without this, req.ip is the proxy and every visitor shares
// one rate-limit bucket.
app.set('trust proxy', 1);

/**
 * CORS.
 *
 * `origin: true` reflects whichever origin asked, and with credentials: true
 * that means any website a signed-in user visits can call this API as them.
 * Set ALLOWED_ORIGINS to a comma-separated list to close that.
 *
 *   ALLOWED_ORIGINS=https://payterminal.vercel.app,https://crm.example.com
 *
 * Left as-is when the variable is unset, so this cannot break a deployment
 * that has not been configured yet.
 */
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (features.corsAllowlist && allowedOrigins.length > 0) {
  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, server-to-server, same-origin. Not a
        // browser cross-site request, so there is nothing to protect against.
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    })
  );
  console.log(`[cors] restricted to: ${allowedOrigins.join(', ')}`);
} else {
  app.use(cors({ origin: true, credentials: true }));
  if (features.corsAllowlist) {
    console.warn('[cors] open to every origin — set ALLOWED_ORIGINS to restrict it');
  }
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'PayTerminal API is running',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      brands: '/api/brands',
      invoices: '/api/invoices',
      merchants: '/api/merchants',
      userBrands: '/api/user-brands',
      notifications: '/api/notifications',
      verification: '/api/verification'
    }
  });
});

// Applies maintenance mode to the API, not just the React app. Sign-in and
// the maintenance endpoints stay reachable so it can always be switched back.
app.use(maintenanceGate);

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/brands', require('./src/routes/brands'));
app.use('/api/invoices', require('./src/routes/invoices'));
app.use('/api/merchants', require('./src/routes/merchants'));
app.use('/api/user-brands', require('./src/routes/userBrands'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/verification', require('./src/routes/verification'));
app.get('/api/health', (req, res) =>
  res.json({
    status: 'ok',
    mode: features.mode,
    // Makes the data-path fix verifiable from outside without shell access.
    dataDir: db.__dataDir,
  })
);

/**
 * First-run admin account.
 *
 * The original seeded admin/admin whenever no user called "admin" existed —
 * a publicly known login on a live payment system, recreated on every deploy
 * that started from an empty disk.
 *
 * Now an account is only created when there are no users at all, and its
 * password comes from ADMIN_INITIAL_PASSWORD or, failing that, is generated
 * and printed once. Either way there is always a way in on a fresh database,
 * and it is never a password an outsider can guess.
 */
async function seedFirstAdmin() {
  if (!features.noDefaultAdminPassword) {
    const existing = await db.users.findOne({ username: 'admin' });
    if (!existing) {
      const hashed = await bcrypt.hash('admin', 10);
      await db.users.insert({
        username: 'admin',
        email: 'admin@uspto.com',
        password: hashed,
        role: 'admin',
        status: 'approved',
        createdAt: new Date().toISOString(),
      });
      console.log('✅ Admin user created: admin / admin');
    }
    return;
  }

  const userCount = await db.users.count({});
  if (userCount > 0) return;

  const generated = !process.env.ADMIN_INITIAL_PASSWORD;
  const password = process.env.ADMIN_INITIAL_PASSWORD || require('crypto').randomBytes(12).toString('base64url');

  await db.users.insert({
    username: process.env.ADMIN_INITIAL_USERNAME || 'admin',
    email: process.env.ADMIN_INITIAL_EMAIL || 'admin@uspto.com',
    password: await bcrypt.hash(password, 10),
    role: 'admin',
    status: 'approved',
    createdAt: new Date().toISOString(),
  });

  console.log('✅ First admin account created (the database was empty)');
  if (generated) {
    console.log('   username: admin');
    console.log(`   password: ${password}`);
    console.log('   This is shown once. Sign in and change it, or set ADMIN_INITIAL_PASSWORD.');
  } else {
    console.log('   password taken from ADMIN_INITIAL_PASSWORD');
  }
}

async function start() {
  console.log(describe());
  SUPER_ADMIN.warnIfInsecure();

  await seedFirstAdmin();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('📦 Using embedded NeDB (no MongoDB required)');
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
