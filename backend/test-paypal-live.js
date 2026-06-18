const { processPayPalPayment } = require('./src/utils/paypal');

async function testPayPalPayment() {
  console.log('🅿️  Testing Live PayPal Payment Processor\n');

  // Test credentials (use your actual PayPal credentials)
  const credentials = {
    clientId: process.env.PAYPAL_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    mode: process.env.PAYPAL_MODE || 'sandbox'
  };

  const paymentData = {
    amount: 10.00,
    currency: 'USD',
    cardNumber: '4111111111111111', // Test Visa
    cardHolder: 'John Doe',
    expiryMonth: '12',
    expiryYear: '2025',
    cvv: '123',
    description: 'Test Invoice Payment'
  };

  console.log('Credentials:', {
    mode: credentials.mode,
    hasClientId: !!credentials.clientId,
    hasClientSecret: !!credentials.clientSecret
  });

  console.log('\nPayment Data:', {
    amount: paymentData.amount,
    currency: paymentData.currency,
    cardHolder: paymentData.cardHolder,
    cardNumber: paymentData.cardNumber.slice(-4),
    expiry: `${paymentData.expiryMonth}/${paymentData.expiryYear}`
  });

  console.log('\n--- Starting Payment Processing ---\n');

  const result = await processPayPalPayment(credentials, paymentData);

  console.log('\n--- Payment Result ---\n');
  console.log(JSON.stringify(result, null, 2));
}

testPayPalPayment().catch(err => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
});
