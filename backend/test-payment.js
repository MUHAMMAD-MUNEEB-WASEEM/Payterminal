const axios = require('axios');

// Setup
const API_URL = 'http://localhost:5000/api';

// Sample data from your system
const invoiceId = 'rbf4Fo61jOhC2Czi'; // From your error message
const merchantId = 'R2uYnSvxeIzUObOQ'; // "Test Beyond" merchant

async function testPayment() {
  try {
    console.log('🧪 Starting payment test...\n');
    
    // Step 1: Test the API connection
    console.log('1️⃣  Testing API connection...');
    try {
      const health = await axios.get(`${API_URL}/health`);
      console.log('✅ API is healthy:', health.data);
    } catch (err) {
      console.error('❌ API health check failed:', err.message);
    }

    console.log('\n2️⃣  Testing payment endpoint...');
    
    // Step 2: Make payment request
    const paymentPayload = {
      cardNumber: '4242424242424242', // Standard test card
      cardHolder: 'Ashley James',
      expiryMonth: '04',
      expiryYear: '2031',
      cvv: '753',
      merchantId: merchantId
    };
    
    console.log('Sending payment request with:', {
      invoiceId,
      cardLast4: paymentPayload.cardNumber.slice(-4),
      cardHolder: paymentPayload.cardHolder,
      expiry: `${paymentPayload.expiryMonth}/${paymentPayload.expiryYear}`,
      merchantId: paymentPayload.merchantId
    });

    const paymentRes = await axios.post(
      `${API_URL}/invoices/public/${invoiceId}/pay`,
      paymentPayload,
      { validateStatus: () => true } // Catch all responses
    );

    console.log('\n✅ Payment response received:');
    console.log('Status:', paymentRes.status);
    console.log('Data:', JSON.stringify(paymentRes.data, null, 2));
    
    if (paymentRes.status === 200 || paymentRes.status === 201) {
      console.log('\n✅✅✅ PAYMENT SUCCESSFUL!');
    } else {
      console.log('\n❌ Payment failed');
    }

  } catch (err) {
    console.error('\n❌ Test error:', err.message);
    if (err.response?.data) {
      console.error('Response data:', err.response.data);
    }
  }
}

testPayment();
