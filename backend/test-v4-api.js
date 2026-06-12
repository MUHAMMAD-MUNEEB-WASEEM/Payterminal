const axios = require('axios');

async function testV4API() {
  console.log('🔐 Testing BeyondBancard V4 API (JSON format)\n');

  const apiKey = 'v4_merchant_N6eGFG7GwJBg5z7D6cj2aZCcmtau9hew';
  
  // V4 API might use JSON with Authorization header
  const endpoints = [
    'https://api.transactiongateway.com/v1/transactions',
    'https://api.transactiongateway.com/transactions',
    'https://beyondbancard.transactiongateway.com/v1/transactions',
    'https://beyondbancard.transactiongateway.com/transactions'
  ];

  const payload = {
    transaction_type: 'sale',
    payment_method: 'credit_card',
    amount: 1.00,
    currency: 'USD',
    credit_card: {
      card_number: '4242424242424242',
      cardholder_name: 'Test User',
      expiration_month: '12',
      expiration_year: '2025',
      cvv: '999'
    },
    order: {
      order_id: 'TEST',
      description: 'Test Transaction'
    }
  };

  for (const endpoint of endpoints) {
    try {
      console.log(`\n🔄 Testing V4 API endpoint: ${endpoint}`);
      
      // Try with API key as Bearer token
      console.log('  → Trying Bearer token authorization');
      const response1 = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      console.log(`  Status: ${response1.status}`);
      if (response1.status === 200 || response1.status === 201) {
        console.log(`  Response: ${JSON.stringify(response1.data).substring(0, 100)}...`);
        if (response1.data.success || response1.data.transaction_status === 'approved') {
          console.log(`  ✅ SUCCESS!`);
          return;
        }
      } else if (response1.status === 401) {
        console.log('  ❌ Unauthorized (Bearer token format wrong?)');
      } else {
        console.log(`  Response: ${JSON.stringify(response1.data).substring(0, 100)}...`);
      }

      // Try with API key in Basic Auth
      console.log('  → Trying Basic auth');
      const response2 = await axios.post(endpoint, payload, {
        auth: {
          username: apiKey,
          password: ''
        },
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        validateStatus: () => true
      });

      console.log(`  Status: ${response2.status}`);
      if (response2.status === 200 || response2.status === 201) {
        console.log(`  Response: ${JSON.stringify(response2.data).substring(0, 100)}...`);
        if (response2.data.success || response2.data.transaction_status === 'approved') {
          console.log(`  ✅ SUCCESS!`);
          return;
        }
      }

    } catch (err) {
      console.log(`  ❌ Connection error: ${err.code || err.message}`);
    }
  }

  console.log('\n\n✅ Trying older form-encoded API with API key as merchant code...\n');
  
  // Maybe the API key is the merchant code for the old API
  try {
    console.log('🔄 Testing old API with merchant code authentication');
    
    const merchantCode = 'PPejd3YuesXf4dT6vnsuY3F44732HTf3'; // The first API key
    
    const testData = new URLSearchParams({
      type: 'sale',
      amount: '100',
      currency: 'USD',
      ccnumber: '4242424242424242',
      ccexp: '1225',
      cvv: '999',
      firstname: 'Test',
      lastname: 'User',
      merchant_code: merchantCode,
      api_key: merchantCode
    });

    const response = await axios.post(
      'https://beyondbancard.transactiongateway.com/api/transact.php',
      testData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true
      }
    );

    const params = new URLSearchParams(response.data);
    console.log(`Response: ${response.data.substring(0, 150)}...`);
    console.log(`Result Code: ${params.get('response')}`);
    console.log(`Reason: ${params.get('responsetext')}`);
    
  } catch (err) {
    console.log(`Error: ${err.message}`);
  }
}

testV4API();
