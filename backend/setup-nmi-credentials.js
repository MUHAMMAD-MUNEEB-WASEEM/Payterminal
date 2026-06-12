#!/usr/bin/env node
/**
 * Setup NMI (BeyondBancard) merchant with security_key
 * This is the correct method that actually works
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
    console.log('🔄 Setting up NMI (BeyondBancard) with security_key...\n');

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
    if (merchant.credentials) {
      console.log('   - apiKey:', merchant.credentials.apiKey?.substring(0, 15) + '...' || 'none');
      console.log('   - apiSecret:', merchant.credentials.apiSecret?.substring(0, 15) + '...' || 'none');
      console.log('   - security_key:', merchant.credentials.security_key?.substring(0, 15) + '...' || 'none');
    }

    // Update with NMI security_key method (this is what actually works!)
    const nmiCredentials = {
      security_key: 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',  // Use Private (API) key as security_key
      mode: 'sandbox'  // Keep in sandbox/test mode
    };

    await promisify(db, {
      type: 'update',
      query: { _id: merchant._id },
      update: { $set: { credentials: nmiCredentials } },
      opts: {}
    });

    console.log('\n✅ SETUP COMPLETE - NMI METHOD (SECURITY_KEY)');
    console.log('✅ Using security_key for NMI API authentication\n');

    console.log('📝 New Configuration:');
    console.log('   Method: NMI API (Direct)');
    console.log('   Security Key: PPejd3YuesXf4dT6vnsuY3F44732HTf3');
    console.log('   Tokenization: Q8N5U4-543kky-kZr2CC-ns8K2Y');
    console.log('   Mode: sandbox (test)\n');

    console.log('✅ What Changed:');
    console.log('   ✅ Using NMI endpoint (secure.nmi.com)');
    console.log('   ✅ security_key method (simpler, more reliable)');
    console.log('   ✅ Compatible with Collect.js tokens');
    console.log('   ✅ Better error handling\n');

    console.log('🚀 Ready to test! Go to:');
    console.log('   http://localhost:5174/pay/96blK1TMqHn493Br\n');

    console.log('🎟️  Test Cards:');
    console.log('   ✅ 4111 1111 1111 1111 (Visa)');
    console.log('   ✅ 5555 5555 5555 4444 (Mastercard)');
    console.log('   ✅ 3782 822463 10005 (Amex)');
    console.log('   ❌ 4222 2222 2222 2220 (Decline test)\n');

    console.log('📊 Expected Result:');
    console.log('   ✅ Success: Green "Payment Successful!" page');
    console.log('   ⚠️  Error: Red error message with details\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
