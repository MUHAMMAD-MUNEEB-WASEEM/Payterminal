#!/usr/bin/env node
/**
 * Update BeyondBancard merchant with V4 API credentials
 * V4 API is the newer format that should work better
 */

const path = require('path');
const Datastore = require('@seald-io/nedb');

const db = new Datastore({ 
  filename: path.join(__dirname, 'data', 'merchants.db'), 
  autoload: true 
});

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
    console.log('🔄 Updating BeyondBancard merchant with V4 API credentials...\n');

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
    console.log('📋 Current Credentials:');
    console.log('   API Key:', merchant.credentials?.apiKey?.substring(0, 10) + '...' || 'none');
    console.log('   API Secret:', merchant.credentials?.apiSecret?.substring(0, 10) + '...' || 'none');
    console.log('   Mode:', merchant.credentials?.mode || 'sandbox');

    // Update with V4 API credentials
    const newCredentials = {
      apiKey: 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',
      apiSecret: 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew',
      mode: 'sandbox'  // Keep in sandbox/test mode
    };

    await promisify(db, {
      type: 'update',
      query: { _id: merchant._id },
      update: { $set: { credentials: newCredentials } },
      opts: {}
    });

    console.log('\n✅ UPDATED TO V4 API CREDENTIALS');
    console.log('✅ Using proper V4 API format\n');

    console.log('📝 New Configuration:');
    console.log('   API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3');
    console.log('   API Secret: v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew');
    console.log('   Mode: sandbox (test mode)\n');

    console.log('🚀 Ready to test! The backend will auto-reload.\n');
    
    console.log('🎟️  Test with test card:');
    console.log('   Card: 4111 1111 1111 1111');
    console.log('   Expiry: 12/25');
    console.log('   CVV: 999\n');

    console.log('Go to: http://localhost:5174/pay/96blK1TMqHn493Br\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
