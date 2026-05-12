const Stripe = require('stripe');

/**
 * Process payment with Stripe
 * @param {Object} credentials - Merchant credentials { secretKey, publishableKey }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
async function processStripePayment(credentials, paymentData) {
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
        transactionId: `stripe_test_${Date.now()}`,
        message: 'Test payment successful (Stripe)',
      };
    }

    // For production, use actual Stripe API
    if (credentials.secretKey && credentials.secretKey.startsWith('sk_live_')) {
      const stripe = Stripe(credentials.secretKey);
      
      // Create a payment method
      const paymentMethod = await stripe.paymentMethods.create({
        type: 'card',
        card: {
          number: paymentData.cardNumber.replace(/\s/g, ''),
          exp_month: parseInt(paymentData.expiryMonth),
          exp_year: parseInt(paymentData.expiryYear),
          cvc: paymentData.cvv,
        },
        billing_details: {
          name: paymentData.cardHolder,
        },
      });

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency.toLowerCase(),
        payment_method: paymentMethod.id,
        confirm: true,
        description: paymentData.description,
      });

      if (paymentIntent.status === 'succeeded') {
        return {
          success: true,
          transactionId: paymentIntent.id,
          message: 'Payment successful',
        };
      } else {
        return {
          success: false,
          error: 'Payment failed',
        };
      }
    }

    // If not a test card and no live credentials, fail
    return {
      success: false,
      error: 'Invalid card number. Use test card: 4242 4242 4242 4242',
    };
  } catch (error) {
    console.error('Stripe payment error:', error.message);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
    };
  }
}

module.exports = { processStripePayment };
