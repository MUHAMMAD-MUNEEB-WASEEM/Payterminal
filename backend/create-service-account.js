/**
 * Creates (or re-passwords) the account the CRM uses to talk to this API.
 *
 * Why this exists: the CRM was configured with the super admin credentials as
 * its service account. That is more access than it needs — raising an invoice
 * and reading brands only require an approved user — and it has one concrete
 * consequence now that maintenance mode applies to the API: super admins are
 * exempt from it, so the CRM would carry on creating invoices in PayTerminal
 * while the business was supposedly switched off. The kill switch is meant to
 * stop exactly that.
 *
 * Usage:
 *   node create-service-account.js                       # generates a password
 *   node create-service-account.js "chosen-password"
 *   CRM_SERVICE_USERNAME=crm-bot node create-service-account.js
 *
 * Then set on the CRM side:
 *   PAYTERMINAL_SERVICE_USERNAME=<username printed below>
 *   PAYTERMINAL_SERVICE_PASSWORD=<password printed below>
 *
 * Leave PAYTERMINAL_SUPERADMIN_* pointing at the super admin: the kill switch
 * needs that, and only that.
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('./src/db');

const username = process.env.CRM_SERVICE_USERNAME || 'crm-service';
const email = process.env.CRM_SERVICE_EMAIL || 'crm-service@system.local';
const password = process.argv[2] || crypto.randomBytes(18).toString('base64url');

async function main() {
  const existing = await db.users.findOne({ username });
  const hashed = await bcrypt.hash(password, 10);

  if (existing) {
    await db.users.update(
      { username },
      { $set: { password: hashed, role: 'admin', status: 'approved' } }
    );
    console.log(`Updated the password for the existing account "${username}".`);
  } else {
    await db.users.insert({
      username,
      email,
      password: hashed,
      role: 'admin',
      status: 'approved',
      createdAt: new Date().toISOString(),
      note: 'Service account used by the CRM. Not a person.',
    });
    console.log(`Created service account "${username}".`);
  }

  console.log('');
  console.log('  Set these on the CRM:');
  console.log(`    PAYTERMINAL_SERVICE_USERNAME="${username}"`);
  console.log(`    PAYTERMINAL_SERVICE_PASSWORD="${password}"`);
  console.log('');
  console.log('  This password is shown once and is not stored anywhere in plain text.');

  // NeDB writes asynchronously; give it a moment before the process ends.
  setTimeout(() => process.exit(0), 300);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
