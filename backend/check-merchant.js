const db = require('./src/db');

async function checkMerchant() {
  try {
    console.log('Checking Test Beyond merchant...\n');
    
    const merchant = await db.merchants.findOne({ nickname: 'Test Beyond' });
    
    if (!merchant) {
      console.log('❌ No merchant found with nickname "Test Beyond"');
      return;
    }
    
    console.log('✅ Merchant found:');
    console.log('  ID:', merchant._id);
    console.log('  Nickname:', merchant.nickname);
    console.log('  Gateway:', merchant.gateway);
    console.log('  IsActive:', merchant.isActive);
    console.log('  Credentials:');
    console.log('    API Key:', merchant.credentials?.apiKey ? '***' + merchant.credentials.apiKey.slice(-4) : 'MISSING');
    console.log('    API Secret:', merchant.credentials?.apiSecret ? '***' + merchant.credentials.apiSecret.slice(-4) : 'MISSING');
    console.log('    Mode:', merchant.credentials?.mode);
    console.log('\n  Full credentials object:');
    console.log('   ', JSON.stringify(merchant.credentials, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

checkMerchant();
