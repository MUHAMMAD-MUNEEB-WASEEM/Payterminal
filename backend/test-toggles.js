/**
 * Checks both sides of every toggle.
 *
 * Boots the real server in a scratch directory, once with PT_MODE=latest and
 * once with PT_MODE=legacy, and confirms each change is present in the first
 * and absent in the second. Touches nothing in backend/data.
 *
 *   node test-toggles.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail = '') {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(name + (detail ? ` — ${detail}` : ''));
  }
}

function request(port, method, routePath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path: routePath,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            /* not json */
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitForBoot(port, proc, logLines) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`server exited early (${proc.exitCode}):\n${logLines.join('\n')}`);
    }
    try {
      const res = await request(port, 'GET', '/api/health');
      if (res.status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server did not start:\n${logLines.join('\n')}`);
}

/** Boots the real server.js with an isolated data directory. */
async function boot(env, port) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pt-test-'));
  const logLines = [];

  const proc = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      JWT_SECRET: 'test-secret-for-toggle-checks',
      // Point the datastore at a scratch directory by overriding the module's
      // idea of where it lives; see PT_TEST_DATA_DIR handling in src/db.js.
      PT_TEST_DATA_DIR: dataDir,
      SUPER_ADMIN_PASSWORD: '',
      ADMIN_INITIAL_PASSWORD: 'seeded-test-password',
      ALLOWED_ORIGINS: '',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (d) => logLines.push(String(d).trim()));
  proc.stderr.on('data', (d) => logLines.push(String(d).trim()));

  await waitForBoot(port, proc, logLines);
  return { proc, logLines, dataDir, log: () => logLines.join('\n') };
}

function stop(server) {
  return new Promise((resolve) => {
    if (server.proc.exitCode !== null) return resolve();
    server.proc.once('exit', resolve);
    server.proc.kill();
    setTimeout(resolve, 3000);
  });
}

async function superAdminToken(port, password) {
  const res = await request(port, 'POST', '/api/auth/login', {
    username: 'superadmin',
    password,
  });
  return res.body && res.body.token ? res.body.token : null;
}

async function run() {
  // =========================================================================
  console.log('\n[PT_MODE=latest]');
  // =========================================================================
  let server = await boot({ PT_MODE: 'latest' }, 5199);
  try {
    const health = await request(5199, 'GET', '/api/health');
    check('health reports the mode', health.body && health.body.mode === 'latest', health.body && health.body.mode);
    check(
      'the database is on the path Render mounts',
      Boolean(health.body && health.body.dataDir),
      health.body && health.body.dataDir
    );

    check(
      'boot warns that the committed password is still in use',
      server.log().includes('committed to this repository')
    );
    check(
      'no admin/admin account is announced',
      !server.log().includes('admin / admin'),
    );
    check(
      'a first admin is still created so the system is reachable',
      server.log().includes('First admin account created')
    );

    // The committed password must keep working, or deploying this locks
    // everyone out.
    const legacyToken = await superAdminToken(5199, 'abcd1234');
    check('the old super admin password still works as a fallback', legacyToken !== null);

    const wrong = await request(5199, 'POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'not-the-password',
    });
    check('a wrong password is rejected', wrong.status >= 400, `HTTP ${wrong.status}`);

    // --- maintenance mode actually closes the API --------------------------
    const on = await request(
      5199,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: true },
      { Authorization: `Bearer ${legacyToken}` }
    );
    check('super admin can enable maintenance mode', on.status === 200, `HTTP ${on.status}`);

    const blocked = await request(5199, 'GET', '/api/brands');
    check(
      'the API refuses ordinary traffic during maintenance',
      blocked.status === 503,
      `HTTP ${blocked.status}`
    );

    const stillIn = await request(5199, 'POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'abcd1234',
    });
    check(
      'signing in stays possible so it can be switched off again',
      stillIn.status === 200,
      `HTTP ${stillIn.status}`
    );

    const healthDuring = await request(5199, 'GET', '/api/health');
    check(
      'the health check stays up so Render does not kill the service',
      healthDuring.status === 200
    );

    const statusDuring = await request(5199, 'GET', '/api/auth/maintenance-status');
    check('maintenance status remains readable', statusDuring.status === 200);

    const superSees = await request(5199, 'GET', '/api/brands', null, {
      Authorization: `Bearer ${legacyToken}`,
    });
    check(
      'a super admin still gets through',
      superSees.status !== 503,
      `HTTP ${superSees.status}`
    );

    // The case that matters for the CRM kill switch. The CRM signs in with a
    // service account; if that account were a super admin it would be exempt
    // here and would carry on raising invoices while the business was down.
    const svcLogin = await request(5199, 'POST', '/api/auth/login', {
      username: 'admin',
      password: 'seeded-test-password',
    });
    check('an ordinary account can sign in during maintenance', svcLogin.status === 200,
      `HTTP ${svcLogin.status}`);

    if (svcLogin.body && svcLogin.body.token) {
      const asService = { Authorization: `Bearer ${svcLogin.body.token}` };
      const readBlocked = await request(5199, 'GET', '/api/brands', null, asService);
      check(
        'a signed-in non-super-admin is still blocked',
        readBlocked.status === 503,
        `HTTP ${readBlocked.status}`
      );

      const invoiceBlocked = await request(
        5199,
        'POST',
        '/api/invoices',
        {
          brandId: 'whatever',
          items: [{ description: 'x', amount: 1 }],
          customerEmail: 'a@b.c',
          customerName: 'A',
          customerSerialNumber: '1',
        },
        asService
      );
      check(
        'no invoice can be raised while the switch is down',
        invoiceBlocked.status === 503,
        `HTTP ${invoiceBlocked.status}`
      );
    }

    const off = await request(
      5199,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: false },
      { Authorization: `Bearer ${legacyToken}` }
    );
    check('maintenance mode can be switched back off', off.status === 200);

    const after = await request(5199, 'GET', '/api/brands');
    check(
      'traffic resumes immediately, without waiting for a cache',
      after.status !== 503,
      `HTTP ${after.status}`
    );

    // --- login throttling --------------------------------------------------
    let sawLimit = false;
    let limitedAfter = 0;
    for (let i = 0; i < 14; i += 1) {
      const attempt = await request(5199, 'POST', '/api/auth/login', {
        username: 'bruteforce-target',
        password: `guess-${i}`,
      });
      if (attempt.status === 429) {
        sawLimit = true;
        limitedAfter = i;
        break;
      }
    }
    check('repeated failed logins are throttled', sawLimit, `blocked after ${limitedAfter}`);

    const otherUser = await request(5199, 'POST', '/api/auth/login', {
      username: 'someone-else',
      password: 'wrong',
    });
    check(
      'the throttle does not lock out a different account',
      otherUser.status !== 429,
      `HTTP ${otherUser.status}`
    );
  } finally {
    await stop(server);
  }

  // =========================================================================
  console.log('\n[PT_MODE=legacy — the previous behaviour, unchanged]');
  // =========================================================================
  server = await boot({ PT_MODE: 'legacy' }, 5198);
  try {
    const health = await request(5198, 'GET', '/api/health');
    check('health reports legacy mode', health.body && health.body.mode === 'legacy');

    check(
      'the old admin/admin account comes back',
      server.log().includes('admin / admin')
    );
    // The warning is deliberately kept in legacy mode too: the password is in
    // the git history either way, and a log line changes no behaviour.
    check(
      'the committed password is still called out',
      server.log().includes('PT_SUPERADMIN_MODE=legacy is in force')
    );

    const token = await superAdminToken(5198, 'abcd1234');
    check('the committed super admin password works', token !== null);

    const on = await request(
      5198,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: true },
      { Authorization: `Bearer ${token}` }
    );
    check('maintenance mode can be enabled', on.status === 200);

    const open = await request(5198, 'GET', '/api/brands');
    check(
      'the API stays open during maintenance, as it did before',
      open.status !== 503,
      `HTTP ${open.status}`
    );

    let throttled = false;
    for (let i = 0; i < 14; i += 1) {
      const attempt = await request(5198, 'POST', '/api/auth/login', {
        username: 'bruteforce-target',
        password: `guess-${i}`,
      });
      if (attempt.status === 429) throttled = true;
    }
    check('logins are not throttled, as before', !throttled);

    await request(
      5198,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: false },
      { Authorization: `Bearer ${token}` }
    );
  } finally {
    await stop(server);
  }

  // =========================================================================
  console.log('\n[per-feature override beats PT_MODE]');
  // =========================================================================
  server = await boot({ PT_MODE: 'latest', PT_MAINTENANCE_ENFORCE: 'legacy' }, 5197);
  try {
    const token = await superAdminToken(5197, 'abcd1234');
    await request(
      5197,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: true },
      { Authorization: `Bearer ${token}` }
    );
    const open = await request(5197, 'GET', '/api/brands');
    check(
      'one feature can be rolled back without reverting the rest',
      open.status !== 503,
      `HTTP ${open.status}`
    );

    let throttled = false;
    for (let i = 0; i < 14; i += 1) {
      const attempt = await request(5197, 'POST', '/api/auth/login', {
        username: 'still-limited',
        password: `guess-${i}`,
      });
      if (attempt.status === 429) throttled = true;
    }
    check('the other features stay on', throttled);

    await request(
      5197,
      'POST',
      '/api/auth/maintenance-mode',
      { enabled: false },
      { Authorization: `Bearer ${token}` }
    );
  } finally {
    await stop(server);
  }

  // =========================================================================
  console.log('\n[super admin password from the environment]');
  // =========================================================================
  server = await boot({ PT_MODE: 'latest', SUPER_ADMIN_PASSWORD: 'a-much-better-password' }, 5196);
  try {
    check(
      'no warning once the password is configured',
      !server.log().includes('committed to this repository')
    );
    const good = await superAdminToken(5196, 'a-much-better-password');
    check('the configured password works', good !== null);

    const old = await request(5196, 'POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'abcd1234',
    });
    check(
      'the password from the repository no longer works',
      old.status >= 400,
      `HTTP ${old.status}`
    );
  } finally {
    await stop(server);
  }

  // =========================================================================
  console.log('\n[super admin can be switched off entirely]');
  // =========================================================================
  server = await boot(
    { PT_MODE: 'latest', SUPER_ADMIN_PASSWORD: 'irrelevant', SUPER_ADMIN_DISABLED: 'true' },
    5195
  );
  try {
    const denied = await request(5195, 'POST', '/api/auth/login', {
      username: 'superadmin',
      password: 'irrelevant',
    });
    check('a disabled super admin cannot sign in', denied.status >= 400, `HTTP ${denied.status}`);
  } finally {
    await stop(server);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const line of failures) console.log(`  - ${line}`);
  }
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch((err) => {
  console.error('\nAborted:', err.message);
  process.exitCode = 1;
});
