#!/usr/bin/env node
/**
 * Switch BeyondBancard merchant to TEST MODE
 * In test mode, all test cards auto-approve
 */

const path = require('path');
const Datastore = require('@seald-io/nedb');

const db = new Datastore({ 
  filename: path.join(__dirname, 'data', 'merchants.db'), 
  autoload: true 
});

// Promisify update
function promisify(ds, action) {
  return new Promise((res, rej) => {
    if (action.type === 'findOne') {
      ds.findOne(action.query, (e, d) => e ? rej(e) : res(d));
    } else if (action.type === 'update') {
      ds.update(action.query, action.update, action.opts || {}, (e, n, d) => e ? rej(e) : res(d));
    }
  });
}

async function main() {
  try {
    console.log('🔄 Switching BeyondBancard to TEST MODE...\n');

    // Find merchant
    const merchant = await promisify(db, {
      type: 'findOne',
      query: { gateway: 'beyondbancard' }
    });

    if (!merchant) {
      console.log('❌ BeyondBancard merchant not found');
      process.exit(1);
    }

    console.log('📋 Current Merchant:', merchant.nickname);
    console.log('📋 Current Mode:', merchant.credentials?.mode || 'unknown');

    // Update to sandbox mode
    await promisify(db, {
      type: 'update',
      query: { _id: merchant._id },
      update: { $set: { 'credentials.mode': 'sandbox' } },
      opts: {}
    });

    console.log('\n✅ SWITCHED TO TEST MODE');
    console.log('✅ All test cards will now auto-approve\n');

    console.log('🎟️  Test Cards You Can Use:');
    console.log('   4111 1111 1111 1111 (Visa) ✅ Approved');
    console.log('   5555 5555 5555 4444 (Mastercard) ✅ Approved');
    console.log('   3782 822463 10005 (Amex) ✅ Approved');
    console.log('   4222 2222 2222 2220 (Declined) ❌ For testing decline flow\n');

    console.log('📝 Payment Details:');
    console.log('   Name: Any name (e.g., John Doe)');
    console.log('   Expiry: 12/25 (any future date)');
    console.log('   CVV: 999 (any 3-4 digits)\n');

    console.log('🚀 Ready to test! Go to:');
    console.log('   http://localhost:5174/pay/96blK1TMqHn493Br\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
