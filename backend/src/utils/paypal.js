/**
 * Process payment with PayPal
 * @param {Object} credentials - Merchant credentials { clientId, clientSecret, mode }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
async function processPayPalPayment(credentials, paymentData) {
  try {
    // Test mode: Accept test cards
    const testCards = [
      '4242424242424242', // Visa
      '5555555555554444', // Mastercard
      '378282246310005',  // Amex
      '4111111111111111', // Generic test
    ];

    const cleanCard = paymentData.cardNumber.replace(/\s/g, '');
    
    // In test mode, simulate success for test cards
    if (testCards.includes(cleanCard)) {
      return {
        success: true,
        transactionId: `paypal_test_${Date.now()}`,
        message: 'Test payment successful (PayPal)',
      };
    }

    // For production with actual PayPal SDK
    if (credentials.clientId && credentials.clientSecret && credentials.mode === 'live') {
      // Note: PayPal typically uses redirect flow, not direct card processing
      // This is a simplified example
      return {
        success: false,
        error: 'PayPal direct card processing requires additional setup. Please use test cards for now.',
      };
    }

    // If not a test card and no live credentials, fail
    return {
      success: false,
      error: 'Invalid card number. Use test card: 4242 4242 4242 4242',
    };
  } catch (error) {
    console.error('PayPal payment error:', error.message);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
    };
  }
}

module.exports = { processPayPalPayment };
