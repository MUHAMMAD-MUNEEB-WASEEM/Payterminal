const checkoutNodeJssdk = require('@paypal/checkout-server-sdk');

/**
 * Process payment with PayPal
 * @param {Object} credentials - Merchant credentials { clientId, clientSecret, mode }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
async function processPayPalPayment(credentials, paymentData) {
  try {
    console.log('🅿️  PayPal payment processor started');
    console.log('Mode:', credentials.mode);
    console.log('Amount:', paymentData.amount);

    if (!credentials.clientId || !credentials.clientSecret) {
      console.error('❌ Missing PayPal credentials');
      return {
        success: false,
        error: 'PayPal credentials not configured',
      };
    }

    // Create PayPal environment
    const environment = credentials.mode === 'live'
      ? new checkoutNodeJssdk.LiveEnvironment(credentials.clientId, credentials.clientSecret)
      : new checkoutNodeJssdk.SandboxEnvironment(credentials.clientId, credentials.clientSecret);

    const client = new checkoutNodeJssdk.PayPalHttpClient(environment);

    // Parse cardholder name
    const nameParts = paymentData.cardHolder.split(' ');
    const firstName = nameParts[0] || 'Customer';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Create payment request
    const request = new checkoutNodeJssdk.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: paymentData.currency || 'USD',
            value: String(paymentData.amount), // Send as string decimal
            breakdown: {
              item_total: {
                currency_code: paymentData.currency || 'USD',
                value: String(paymentData.amount)
              }
            }
          },
          items: [
            {
              name: paymentData.description || 'Invoice Payment',
              description: paymentData.description || 'Invoice Payment',
              quantity: '1',
              unit_amount: {
                currency_code: paymentData.currency || 'USD',
                value: String(paymentData.amount)
              }
            }
          ],
          description: paymentData.description || 'Invoice Payment'
        }
      ],
      payer: {
        name: {
          given_name: firstName,
          surname: lastName || 'Customer'
        }
      },
      payment_source: {
        card: {
          number: paymentData.cardNumber.replace(/\s/g, ''),
          expiry: `${String(paymentData.expiryMonth).padStart(2, '0')}/${paymentData.expiryYear}`,
          cvv: String(paymentData.cvv),
          name: {
            given_name: firstName,
            surname: lastName || 'Customer'
          }
        }
      }
    });

    console.log('📤 Sending PayPal request...');
    console.log('Amount:', paymentData.amount, paymentData.currency);

    let response;
    try {
      response = await client.execute(request);
      console.log('✅ PayPal response received - Status:', response.statusCode);
    } catch (executeError) {
      console.error('❌ PayPal API error:', executeError.message);
      console.error('Error details:', executeError.details || executeError);
      
      // Extract error message
      let errorMessage = 'Payment processing failed';
      if (executeError.details && executeError.details[0]) {
        errorMessage = executeError.details[0].issue || executeError.message;
      } else if (executeError.message) {
        errorMessage = executeError.message;
      }

      return {
        success: false,
        error: `PayPal error: ${errorMessage}`,
        errorCode: executeError.statusCode || 'PAYMENT_ERROR'
      };
    }

    // Check response status
    if (response.statusCode === 201 || response.statusCode === 200) {
      const order = response.result;
      
      console.log('✅ Order created:', order.id);
      console.log('Order status:', order.status);

      // For card payments, we typically need to capture immediately
      const captureRequest = new checkoutNodeJssdk.orders.OrdersCaptureRequest(order.id);
      captureRequest.requestBody({});

      console.log('📤 Capturing payment...');
      
      let captureResponse;
      try {
        captureResponse = await client.execute(captureRequest);
        console.log('✅ Payment captured - Status:', captureResponse.statusCode);
      } catch (captureError) {
        console.error('❌ Capture error:', captureError.message);
        
        let errorMessage = 'Payment capture failed';
        if (captureError.details && captureError.details[0]) {
          errorMessage = captureError.details[0].issue || captureError.message;
        }

        return {
          success: false,
          error: `PayPal capture failed: ${errorMessage}`,
          errorCode: 'CAPTURE_FAILED'
        };
      }

      if (captureResponse.statusCode === 201 || captureResponse.statusCode === 200) {
        const capturedOrder = captureResponse.result;
        
        // Get transaction ID from purchase units
        let transactionId = capturedOrder.id;
        if (capturedOrder.purchase_units && capturedOrder.purchase_units[0]) {
          const payments = capturedOrder.purchase_units[0].payments;
          if (payments && payments.captures && payments.captures[0]) {
            transactionId = payments.captures[0].id;
          }
        }

        console.log('✅ Payment successful! Transaction ID:', transactionId);
        
        return {
          success: true,
          transactionId: transactionId,
          message: 'Payment processed successfully',
          reference: transactionId,
          orderId: capturedOrder.id
        };
      } else {
        console.error('❌ Unexpected capture response status:', captureResponse.statusCode);
        return {
          success: false,
          error: 'Unexpected PayPal response during capture',
          errorCode: 'UNEXPECTED_RESPONSE'
        };
      }
    } else if (response.statusCode === 422) {
      // Unprocessable Entity - validation error
      console.error('❌ Validation error in request');
      return {
        success: false,
        error: 'Invalid payment data provided',
        errorCode: 'VALIDATION_ERROR'
      };
    } else {
      console.error('❌ Unexpected response status:', response.statusCode);
      return {
        success: false,
        error: `PayPal returned status ${response.statusCode}`,
        errorCode: 'UNEXPECTED_STATUS'
      };
    }
  } catch (error) {
    console.error('🅿️  PayPal payment error:', error.message);
    console.error('Stack:', error.stack);
    return {
      success: false,
      error: error.message || 'Payment processing failed',
      errorCode: 'PAYMENT_ERROR'
    };
  }
}

module.exports = { processPayPalPayment };
