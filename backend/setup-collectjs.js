#!/usr/bin/env node
/**
 * Setup script to add Collect.js tokenization key to BeyondBancard merchant
 * Run: node setup-collectjs.js
 */

const path = require('path');

// Use same path resolution as server
const dbDir = path.join(__dirname, 'data');
const Datastore = require('@seald-io/nedb');
const db = new Datastore({ filename: path.join(dbDir, 'merchants.db'), autoload: true });

// Promisify for easier use
function promisify(ds, action) {
  return new Promise((res, rej) => {
    switch(action.type) {
      case 'find':
        ds.find(action.query, (e, d) => e ? rej(e) : res(d));
        break;
      case 'update':
        ds.update(action.query, action.update, action.opts || {}, (e, n, d) => e ? rej(e) : res(d));
        break;
      case 'insert':
        ds.insert(action.data, (e, d) => e ? rej(e) : res(d));
        break;
      default:
        rej(new Error('Unknown action'));
    }
  });
}

async function main() {
  try {
    console.log('🔍 Connecting to merchants database...\n');

    // Your tokenization key from BeyondBancard
    const TOKENIZATION_KEY = 'Q8N5U4-543kky-kZr2CC-ns8K2Y';
    const API_KEY = 'PPejd3YuesXf4dT6vnsuY3F44732HTf3';
    const API_SECRET = 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew';

    // Find all BeyondBancard merchants
    const merchants = await promisify(db, {
      type: 'find',
      query: { gateway: 'beyondbancard' }
    });

    console.log(`Found ${merchants.length} BeyondBancard merchant(s):\n`);

    if (merchants.length === 0) {
      console.log('No BeyondBancard merchants found. Creating one...\n');

      const now = new Date().toISOString();
      const newMerchant = {
        nickname: 'BeyondBancard (Tokenized)',
        gateway: 'beyondbancard',
        credentials: {
          apiKey: API_KEY,
          apiSecret: API_SECRET,
          mode: 'sandbox'
        },
        tokenizationKey: TOKENIZATION_KEY,
        isActive: true,
        isDefault: true,
        createdAt: now,
        updatedAt: now
      };

      const result = await promisify(db, {
        type: 'insert',
        data: newMerchant
      });

      console.log('✅ Created new BeyondBancard merchant');
      console.log('   ID:', result._id);
      console.log('   Gateway: beyondbancard');
      console.log('   Tokenization Key:', TOKENIZATION_KEY);
    } else {
      // Update existing merchants with tokenization key
      console.log('Updating existing merchant(s) with tokenization key...\n');

      for (const merchant of merchants) {
        console.log(`• ${merchant.nickname} (ID: ${merchant._id})`);
        console.log('  Gateway:', merchant.gateway);

        const updated = await promisify(db, {
          type: 'update',
          query: { _id: merchant._id },
          update: { 
            $set: { 
              tokenizationKey: TOKENIZATION_KEY,
              updatedAt: new Date().toISOString()
            }
          },
          opts: { returnUpdatedDocs: true }
        });

        console.log('  ✅ Added tokenization key');
      }
    }

    // Verify update
    console.log('\n--- Verification ---');
    const updated = await promisify(db, {
      type: 'find',
      query: { gateway: 'beyondbancard' }
    });

    console.log(`\nBeyondBancard merchant(s) in database: ${updated.length}`);
    updated.forEach((m, idx) => {
      console.log(`\n${idx + 1}. ${m.nickname}`);
      console.log('   ID:', m._id);
      console.log('   Gateway:', m.gateway);
      console.log('   Has Tokenization Key:', !!m.tokenizationKey);
      if (m.tokenizationKey) {
        console.log('   Key:', m.tokenizationKey.substring(0, 10) + '...');
      }
      if (m.credentials) {
        console.log('   Has API Credentials:', !!m.credentials.apiKey);
        console.log('   Mode:', m.credentials.mode || 'sandbox');
      }
    });

    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Start the backend: npm start');
    console.log('2. Go to: http://localhost:5174/pay/<invoice-id>');
    console.log('3. Test Collect.js tokenization with test card: 4111 1111 1111 1111');
    console.log('4. Check logs: backend/logs/beyondbancard.log');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('\nTroubleshooting:');
    console.error('- Make sure backend server is NOT running');
    console.error('- Check that database file exists at:', path.join(dbDir, 'merchants.db'));
    console.error('- Run: npm install (to ensure dependencies are installed)');
    process.exit(1);
  }
}


main();
