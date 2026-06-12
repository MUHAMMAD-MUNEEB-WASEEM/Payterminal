const axios = require('axios');

async function testCredentials() {
  const credentials = {
    apiKey: "PPejd3YuesXf4dT6vnsuY3F44732HTf3",
    apiSecret: "v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew",
    mode: "live"
  };

  const endpoints = [
    'https://beyondbancard.transactiongateway.com/api/transact.php',
    'https://api.sandbox.transactiongateway.com/api/transact.php'
  ];

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
    username: credentials.apiKey,
    password: credentials.apiSecret
  });

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔄 Testing: ${endpoint}`);
      const response = await axios.post(endpoint, testData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      console.log('Status:', response.status);
      console.log('Response:', response.data);

      // Parse response
      const params = new URLSearchParams(response.data);
      const resultCode = params.get('response');
      const reasonText = params.get('responsetext');
      
      console.log(`Result Code: ${resultCode}, Reason: ${reasonText}`);

      if (resultCode === '3' && reasonText && reasonText.includes('Authentication')) {
        console.log('❌ Authentication failed with these credentials');
      } else if (resultCode) {
        console.log('✅ Credentials appear to work (got response code)');
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
    }
  }
}

testCredentials();
