# Backend changes, and how to switch them off

Six changes to `backend/`. Every one is behind a toggle, so if anything
misbehaves in production you change an environment variable on Render and
restart — no redeploy of older code, no git revert.

```
PT_MODE=latest    # the updated behaviour (default)
PT_MODE=legacy    # exactly what the app did before
```

Individual settings override `PT_MODE`, so one change can be rolled back
without losing the rest:

```
PT_MODE=latest
PT_CORS_MODE=legacy      # everything new except the CORS change
```

Run `node backend/test-toggles.js` to check both sides. It boots the real
server in a scratch directory and asserts each change is present under
`latest` and absent under `legacy`. 33 checks, all passing.

---

## 1. The database was not on the persistent disk

`PT_DATA_PATH_MODE` · **the important one**

`render.yaml` mounts the disk at `/opt/render/project/src/backend/data`.
`src/db.js` wrote to `/data` whenever `NODE_ENV=production`. Those are
different directories, and `/data` is ordinary container storage — so every
deploy started from an empty database. Users, brands, invoices and merchants
created in production did not survive a redeploy.

Render checks the repo out at `/opt/render/project/src`, so the mounted path is
exactly `<repo>/backend/data`, which is what `path.join(__dirname, '../data')`
already resolved to locally. The `NODE_ENV` branch was never needed.

On boot the app now copies anything still sitting in `/data` onto the disk. It
only writes where the disk side is missing or empty, and never deletes from
`/data`, so it is safe to run repeatedly and the originals remain if the result
looks wrong.

`GET /api/health` reports the directory in use, so this is verifiable from
outside without shell access:

```json
{ "status": "ok", "mode": "latest", "dataDir": "/opt/render/project/src/backend/data" }
```

**Check this first after deploying.** If `dataDir` is still `/data`, the toggle
is off.

## 2. The super admin password was in the repository

`PT_SUPERADMIN_MODE`

`src/routes/auth.js` contained `password: 'abcd1234'` in plain text. It is in
the git history, so anyone who has ever had a copy of this repo can sign in as
super admin — which means maintenance mode and every brand.

It now comes from `SUPER_ADMIN_PASSWORD`. Comparison is constant-time.

**Deploying this does not lock you out**: with the variable unset, the old
password still works and the server warns on every boot. Set the variable to
close it, and the old one stops working immediately.

```
SUPER_ADMIN_USERNAME=superadmin     # optional
SUPER_ADMIN_PASSWORD=<a long random string>
SUPER_ADMIN_DISABLED=false          # true switches the account off entirely
```

Changing the password does not invalidate tokens already issued — they last
seven days. `SUPER_ADMIN_DISABLED=true` does reject existing tokens.

Rotating it is worth doing regardless of this change, because the old value
cannot be un-published from the git history.

## 3. `admin` / `admin` was recreated on every boot

`PT_ADMIN_SEED_MODE`

`server.js` created a user called `admin` with the password `admin` whenever no
such user existed — on a live payment system, and recreated on every deploy
that started from an empty disk (see change 1).

An account is now only created when the database has **no users at all**, and
its password comes from `ADMIN_INITIAL_PASSWORD` or is generated and printed to
the deploy log once. A fresh database always has a way in; it is never a
password an outsider can guess.

Existing accounts are untouched.

## 4. Maintenance mode did not apply to the API

`PT_MAINTENANCE_ENFORCE`

The flag only told the React app to render a 404 page. The API kept accepting
requests, so anything not going through that UI — a saved payment link, a
script, the CRM, a browser with the page already open — could still transact
while the business was supposedly switched off.

The API now returns `503` while maintenance is on. Still reachable, whatever
the flag says:

- `POST /api/auth/login`, so a super admin can always get back in
- `GET /api/auth/maintenance-status` and `POST /api/auth/maintenance-mode`
- `GET /api/health`, so Render does not mark the service unhealthy

Super admins bypass it. Everyone else, signed in or not, gets 503.

### This affects the CRM — see below

## 5. CORS accepted every origin with credentials

`PT_CORS_MODE`

`origin: true` with `credentials: true` means any website a signed-in user
visits can call this API as them.

Set `ALLOWED_ORIGINS` to close it:

```
ALLOWED_ORIGINS=https://payterminal.vercel.app,https://your-crm-host
```

While the variable is empty the old behaviour continues, so turning the toggle
on without configuring it changes nothing.

## 6. Unlimited login attempts

`PT_RATE_LIMIT`

Nothing throttled `/api/auth/login`, and the super admin password was eight
lowercase characters — within reach of an unattended loop.

Ten failed attempts per IP-and-username in fifteen minutes, then `429`.
Successful sign-ins reset the counter, so a busy office is unaffected.

```
LOGIN_RATE_MAX=10
LOGIN_RATE_WINDOW_MS=900000
```

Counted in memory. Accurate on one Render instance; if this is ever scaled out
it becomes per-instance and should move to a shared store.

---

## Action needed on the CRM side

The CRM is configured with the **super admin** credentials as its service
account:

```
PAYTERMINAL_SERVICE_USERNAME="superadmin"
```

That matters now, because super admins are exempt from maintenance mode. As it
stands the CRM would carry on creating invoices in PayTerminal while the kill
switch was down — which is the one thing the kill switch exists to prevent.

Raising an invoice and reading brands only need an approved account, so:

```bash
cd backend
node create-service-account.js
```

It prints a username and password. Set those on the CRM as
`PAYTERMINAL_SERVICE_USERNAME` / `PAYTERMINAL_SERVICE_PASSWORD`, and leave
`PAYTERMINAL_SUPERADMIN_*` pointing at the super admin — the kill switch needs
that, and only that.

Verified: with a non-super-admin service account, `GET /api/brands` and
`POST /api/invoices` both return 503 while maintenance is on, and the super
admin still gets through to switch it back off.

---

## Suggested rollout

1. Deploy with `PT_MODE=latest` and nothing else set. Every change is either
   inert (CORS, until `ALLOWED_ORIGINS` is set) or backwards-compatible (the
   old super admin password still works).
2. Check `GET /api/health` shows the right `dataDir`, and look for the
   `[db] recovered ... database file(s)` line in the deploy log.
3. Set `SUPER_ADMIN_PASSWORD` and update the CRM's
   `PAYTERMINAL_SUPERADMIN_PASSWORD` to match.
4. Run `create-service-account.js` and repoint the CRM's service credentials.
5. Set `ALLOWED_ORIGINS`.

If anything goes wrong at any point: `PT_MODE=legacy`, restart, and the backend
behaves exactly as it did before.

## Files

| File | |
|---|---|
| `backend/src/config/features.js` | new — the toggles |
| `backend/src/config/superAdmin.js` | new — super admin credentials |
| `backend/src/middleware/maintenance.js` | new — the API-level gate |
| `backend/src/middleware/rateLimit.js` | new — login throttling |
| `backend/src/db.js` | data path and recovery |
| `backend/server.js` | CORS, gate, first-admin seed, health |
| `backend/src/routes/auth.js` | super admin lookup, rate limit |
| `backend/src/middleware/auth.js` | honours `SUPER_ADMIN_DISABLED` |
| `backend/render.yaml` | declares the new variables |
| `backend/.env.example` | new — documents them |
| `backend/create-service-account.js` | new — provisions the CRM account |
| `backend/test-toggles.js` | new — checks both sides of every toggle |

No dependencies were added.
