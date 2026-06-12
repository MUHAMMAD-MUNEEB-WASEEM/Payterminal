#!/usr/bin/env node
/**
 * Update BeyondBancard merchant with CORRECT credentials
 * Based on key role clarification:
 * - Private (API) PPejd3... = Security key for Payment API ✅
 * - Public (Tokenization) = For Collect.js ✅
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
    console.log('🔄 Updating BeyondBancard merchant with CORRECT credentials...\n');

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
    console.log('   API Key:', merchant.credentials?.apiKey?.substring(0, 15) + '...' || 'none');
    console.log('   API Secret:', merchant.credentials?.apiSecret?.substring(0, 15) + '...' || 'none');

    // Update with CORRECT credentials
    // Private (API) is the security key for Payment API
    const correctCredentials = {
      apiKey: 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',      // Private (API) - security key
      apiSecret: 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',  // Same key used twice (common pattern)
      mode: 'sandbox'  // Keep in sandbox/test mode
    };

    await promisify(db, {
      type: 'update',
      query: { _id: merchant._id },
      update: { $set: { credentials: correctCredentials } },
      opts: {}
    });

    console.log('\n✅ UPDATED TO CORRECT CREDENTIALS');
    console.log('✅ Using Private (API) key for Payment API\n');

    console.log('📝 New Configuration:');
    console.log('   API Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3 (Private API key)');
    console.log('   API Secret: PPejd3YuesXf4dT6vnsuY3F44732HTf3 (Security key)');
    console.log('   Tokenization: Q8N5U4-543kky-kZr2CC-ns8K2Y (already set)');
    console.log('   Mode: sandbox (test mode)\n');

    console.log('✅ Key Roles Configured:');
    console.log('   ✅ Public (Tokenization): Used by Collect.js in frontend');
    console.log('   ✅ Private (API): Used for Payment API authentication\n');

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
