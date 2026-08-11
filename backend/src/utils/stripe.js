const Stripe = require('stripe');

/**
 * Process payment with Stripe
 * @param {Object} credentials - Merchant credentials { secretKey, publishableKey }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
/**
 * Process payment with Stripe using Stripe.js token (PCI compliant)
 * @param {Object} credentials - Merchant credentials { secretKey, publishableKey }
 * @param {Object} paymentData - { amount, currency, stripeToken, cardHolder, description, email, ... }
 * @returns {Object} { success, transactionId, error }
 */
async function processStripePayment(credentials, paymentData) {
  try {
    console.log('💳 Stripe payment processor started');
    console.log('Amount:', paymentData.amount);
    console.log('Has token:', !!paymentData.stripeToken);
    
    // Validate we have a Stripe token (from Stripe.js)
    if (!paymentData.stripeToken) {
      console.error('❌ No Stripe token provided - raw card data not allowed');
      return {
        success: false,
        error: 'Stripe requires tokenized card data. Please ensure Stripe.js is loaded.',
        errorCode: 'MISSING_STRIPE_TOKEN'
      };
    }
    
    // Validate credentials
    if (!credentials.secretKey) {
      console.error('❌ Missing Stripe secret key');
      return {
        success: false,
        error: 'Stripe credentials not configured',
        errorCode: 'MISSING_CREDENTIALS'
      };
    }
    
    console.log('✅ Using Stripe token:', paymentData.stripeToken.substring(0, 12) + '...');
    
    // Initialize Stripe with secret key
    const stripe = Stripe(credentials.secretKey);
    
    // Create charge using the token
    console.log('📤 Creating Stripe charge...');
    const charge = await stripe.charges.create({
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: (paymentData.currency || 'USD').toLowerCase(),
      source: paymentData.stripeToken, // Use token instead of raw card data
      description: paymentData.description || 'Payment',
      receipt_email: paymentData.email || null,
      metadata: {
        invoice_number: paymentData.invoiceNumber || '',
        customer_name: `${paymentData.firstName || ''} ${paymentData.lastName || ''}`.trim(),
        company: paymentData.companyName || ''
      }
    });
    
    console.log('✅ Stripe charge response:', {
      id: charge.id,
      status: charge.status,
      paid: charge.paid,
      amount: charge.amount / 100
    });
    
    if (charge.paid && charge.status === 'succeeded') {
      console.log('✅ Payment successful!');
      return {
        success: true,
        transactionId: charge.id,
        message: 'Payment processed successfully',
        cardLast4: charge.payment_method_details?.card?.last4 || null,
        cardBrand: charge.payment_method_details?.card?.brand || null
      };
    } else {
      console.error('❌ Payment not completed:', charge.status);
      return {
        success: false,
        error: `Payment ${charge.status}`,
        errorCode: charge.status.toUpperCase()
      };
    }
  } catch (error) {
    console.error('❌ Stripe payment error:', error.message);
    console.error('Error type:', error.type);
    console.error('Error code:', error.code);
    
    // Parse Stripe error
    let errorMessage = error.message || 'Payment processing failed';
    
    if (error.type === 'StripeCardError') {
      errorMessage = `Card error: ${error.message}`;
    } else if (error.type === 'StripeInvalidRequestError') {
      errorMessage = `Invalid request: ${error.message}`;
    } else if (error.type === 'StripeAPIError') {
      errorMessage = 'Stripe API error. Please try again.';
    } else if (error.type === 'StripeConnectionError') {
      errorMessage = 'Network error. Please check your connection.';
    } else if (error.type === 'StripeAuthenticationError') {
      errorMessage = 'Authentication failed. Please contact support.';
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: error.code || 'STRIPE_ERROR',
      errorType: error.type || 'unknown'
    };
  }
}

module.exports = { processStripePayment };
