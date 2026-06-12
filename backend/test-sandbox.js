const axios = require('axios');

async function testSandbox() {
  console.log('🔐 Testing BeyondBancard SANDBOX endpoints\n');

  const apiKey = 'PPejd3YuesXf4dT6vnsuY3F44732HTf3';
  const v4Key = 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew';

  // Try different sandbox endpoints
  const endpoints = [
    'https://api.sandbox.transactiongateway.com/api/transact.php',
    'https://sandbox.beyondbancard.transactiongateway.com/api/transact.php',
    'https://sandbox.transactiongateway.com/api/transact.php',
    'https://test.transactiongateway.com/api/transact.php',
    'https://api-sandbox.transactiongateway.com/api/transact.php',
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔄 Testing: ${endpoint}`);
      
      const testData = new URLSearchParams({
        type: 'sale',
        amount: '100',
        currency: 'USD',
        ccnumber: '4111111111111111', // Sandbox test card
        ccexp: '1225',
        cvv: '999',
        firstname: 'Test',
        lastname: 'User',
        orderid: 'SANDBOX_TEST',
        orderdescription: 'Sandbox Test',
        username: apiKey,
        password: apiKey
      });

      const response = await axios.post(endpoint, testData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      console.log(`  Status: ${response.status}`);
      
      if (response.status === 200 && response.data) {
        const params = new URLSearchParams(response.data);
        const resultCode = params.get('response');
        const reasonText = params.get('responsetext');
        const transactionId = params.get('transactionid');
        
        console.log(`  Result: ${resultCode}`);
        console.log(`  Reason: ${reasonText}`);
        console.log(`  TransactionID: ${transactionId}`);
        
        if (resultCode === '1') {
          console.log(`  ✅✅✅ SUCCESS WITH SANDBOX!`);
          console.log(`  Endpoint that works: ${endpoint}`);
          return endpoint;
        }
      } else {
        console.log(`  Response data length: ${response.data?.length || 0}`);
        if (response.data) {
          console.log(`  First 100 chars: ${String(response.data).substring(0, 100)}`);
        }
      }

    } catch (err) {
      if (err.code === 'ENOTFOUND') {
        console.log(`  ❌ Hostname not found`);
      } else if (err.message.includes('certificate')) {
        console.log(`  ⚠️  Certificate error (endpoint exists but SSL issue)`);
      } else {
        console.log(`  ❌ Error: ${err.code || err.message}`);
      }
    }
  }

  console.log('\n\n🔐 Testing with V4 API key on sandbox\n');

  for (const endpoint of endpoints.slice(0, 2)) {
    try {
      console.log(`\n🔄 Testing V4 key on: ${endpoint}`);
      
      const testData = new URLSearchParams({
        type: 'sale',
        amount: '100',
        currency: 'USD',
        ccnumber: '4111111111111111',
        ccexp: '1225',
        cvv: '999',
        firstname: 'Test',
        lastname: 'User',
        orderid: 'SANDBOX_TEST',
        orderdescription: 'Sandbox Test',
        username: v4Key,
        password: v4Key
      });

      const response = await axios.post(endpoint, testData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status === 200 && response.data) {
        const params = new URLSearchParams(response.data);
        const resultCode = params.get('response');
        const reasonText = params.get('responsetext');
        
        console.log(`  Result: ${resultCode}, Reason: ${reasonText}`);
        
        if (resultCode === '1') {
          console.log(`  ✅✅✅ SUCCESS WITH V4 KEY!`);
          return { endpoint, key: v4Key };
        }
      }

    } catch (err) {
      console.log(`  Error: ${err.code || err.message}`);
    }
  }
}

testSandbox();
