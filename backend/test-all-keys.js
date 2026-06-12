const axios = require('axios');

async function testAllKeys() {
  const keys = {
    'API Key': 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',
    'V4API Key': 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew',
    'Cart Key': '9z46hy3TA2sE42F58vwa5rYemZxt5sY6'
  };

  const secrets = {
    'API Key': 'PPejd3YuesXf4dT6vnsuY3F44732HTf3',
    'V4API Key': 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew',
    'Cart Key': '9z46hy3TA2sE42F58vwa5rYemZxt5sY6'
  };

  // Test different combinations
  const combinations = [
    { name: 'API + API', user: keys['API Key'], pass: secrets['API Key'] },
    { name: 'V4API + V4API', user: keys['V4API Key'], pass: secrets['V4API Key'] },
    { name: 'Cart + Cart', user: keys['Cart Key'], pass: secrets['Cart Key'] },
    { name: 'V4API + Cart', user: keys['V4API Key'], pass: secrets['Cart Key'] },
    { name: 'API + Cart', user: keys['API Key'], pass: secrets['Cart Key'] },
  ];

  const endpoint = 'https://beyondbancard.transactiongateway.com/api/transact.php';

  console.log('🔐 Testing BeyondBancard API Key Combinations\n');

  for (const combo of combinations) {
    try {
      console.log(`\n🔄 Testing: ${combo.name}`);
      console.log(`   User: ${combo.user.substring(0, 10)}...${combo.user.substring(combo.user.length - 6)}`);
      console.log(`   Pass: ${combo.pass.substring(0, 10)}...${combo.pass.substring(combo.pass.length - 6)}`);

      const testData = new URLSearchParams({
        type: 'sale',
        amount: '100',
        currency: 'USD',
        ccnumber: '4242424242424242',
        ccexp: '1225',
        cvv: '999',
        firstname: 'Test',
        lastname: 'User',
        orderid: 'TEST',
        orderdescription: 'Credential Test',
        username: combo.user,
        password: combo.pass
      });

      const response = await axios.post(endpoint, testData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      // Parse response
      const params = new URLSearchParams(response.data);
      const resultCode = params.get('response');
      const reasonText = params.get('responsetext');
      const transactionId = params.get('transactionid');

      console.log(`   Response Code: ${resultCode}`);
      console.log(`   Reason: ${reasonText}`);
      
      if (resultCode === '1') {
        console.log(`   ✅✅✅ SUCCESS! Transaction ID: ${transactionId}`);
        return combo; // Return the working combination
      } else if (resultCode === '2') {
        console.log(`   ⚠️  Declined (card issue, not auth)`);
      } else if (resultCode === '3') {
        if (reasonText.toLowerCase().includes('authentication')) {
          console.log(`   ❌ Authentication Failed`);
        } else {
          console.log(`   ⚠️  Error: ${reasonText}`);
        }
      }

    } catch (err) {
      console.error(`   ❌ Connection error: ${err.message}`);
    }
  }

  console.log('\n\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  // Also test if any individual key works as both username and password
  console.log('Testing if single keys work as both username and password:\n');
  
  for (const [name, key] of Object.entries(keys)) {
    try {
      const testData = new URLSearchParams({
        type: 'sale',
        amount: '100',
        currency: 'USD',
        ccnumber: '4242424242424242',
        ccexp: '1225',
        cvv: '999',
        firstname: 'Test',
        lastname: 'User',
        orderid: 'TEST',
        orderdescription: 'Test',
        username: key,
        password: key
      });

      const response = await axios.post(endpoint, testData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        validateStatus: () => true
      });

      const params = new URLSearchParams(response.data);
      const resultCode = params.get('response');
      const reasonText = params.get('responsetext');

      console.log(`${name}: response=${resultCode}, reason=${reasonText}`);
      
      if (resultCode === '1') {
        console.log(`✅ SUCCESS with ${name}!`);
      }
    } catch (err) {
      console.log(`${name}: Error - ${err.message}`);
    }
  }
}

testAllKeys().catch(console.error);
