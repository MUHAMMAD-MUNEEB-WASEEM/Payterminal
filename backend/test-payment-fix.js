/**
 * Quick test to verify payment endpoint returns proper status codes
 */
const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

async function testPaymentResponse() {
  try {
    console.log('Testing payment endpoint response format...\n');
    
    // Use the existing invoice from logs
    const invoiceId = 'glDbwf1kJ7ETlOYd';
    const merchantId = 'R2uYnSvxeIzUObOQ';
    
    console.log(`Invoice ID: ${invoiceId}`);
    console.log(`Merchant ID: ${merchantId}\n`);
    
    // Try a payment with test card
    const paymentData = {
      cardNumber: '4111111111111111',
      cardHolder: 'Test User',
      expiryMonth: '12',
      expiryYear: '2025',
      cvv: '999',
      merchantId: merchantId
    };
    
    console.log('Sending payment request...\n');
    
    try {
      const response = await axios.post(
        `${API_URL}/invoices/public/${invoiceId}/pay`,
        paymentData
      );
      
      console.log('✅ Response Status:', response.status);
      console.log('Response Data:', JSON.stringify(response.data, null, 2));
      
      if (response.status === 200 && response.data.status === 'failed') {
        console.log('\n✅ FIX CONFIRMED: Payment failures return HTTP 200 with status:failed');
        console.log('   Frontend will now properly handle payment errors!');
      }
    } catch (error) {
      if (error.response) {
        console.log('❌ Response Status:', error.response.status);
        console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
        
        if (error.response.status === 400) {
          console.log('\n⚠️  Still returning 400 status - backend may not have restarted');
        }
      } else {
        console.error('Error:', error.message);
      }
    }
    
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testPaymentResponse();
