const axios = require('axios');

/**
 * Process payment with PayPal using REST API v2
 * Supports both sandbox (test) and live (production) modes with real card processing
 * 
 * @param {Object} credentials - Merchant credentials { clientId, clientSecret, mode }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description, firstName, lastName, companyName, addressLine1, addressLine2, city, state, postalCode, countryCode }
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

    // Set PayPal API endpoint based on mode
    const apiEndpoint = credentials.mode === 'live'
      ? 'https://api.paypal.com'
      : 'https://api.sandbox.paypal.com';

    console.log('🅿️  PayPal endpoint:', apiEndpoint);
    console.log('🔐 Mode:', credentials.mode === 'live' ? 'LIVE (Real transactions)' : 'SANDBOX (Test mode)');

    // Step 1: Get OAuth access token
    console.log('📤 Authenticating with PayPal...');
    
    let tokenResponse;
    try {
      tokenResponse = await axios.post(
        `${apiEndpoint}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: credentials.clientId,
            password: credentials.clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
    } catch (tokenErr) {
      console.error('❌ PayPal authentication failed');
      const errData = tokenErr.response?.data;
      console.error('Error:', errData?.error_description || tokenErr.message);
      
      return {
        success: false,
        error: `PayPal authentication failed: ${errData?.error_description || tokenErr.message}`,
        errorCode: 'AUTH_FAILED'
      };
    }

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ Authentication successful');

    // Step 2: Validate card data
    const cardNumber = paymentData.cardNumber.replace(/\s/g, '');
    const cvv = String(paymentData.cvv).trim();
    const expiryMonth = String(paymentData.expiryMonth).padStart(2, '0');
    const expiryYear = String(paymentData.expiryYear).slice(-2); // Get last 2 digits for MM/YY format

    // Validate card format
    if (!/^\d{13,19}$/.test(cardNumber)) {
      console.error('❌ Invalid card number format');
      return {
        success: false,
        error: 'Invalid card number format (must be 13-19 digits)',
        errorCode: 'INVALID_CARD'
      };
    }

    if (!/^\d{3,4}$/.test(cvv)) {
      console.error('❌ Invalid CVV format');
      return {
        success: false,
        error: 'Invalid CVV format',
        errorCode: 'INVALID_CVV'
      };
    }

    // Validate expiry is in future
    const fullExpiryYear = paymentData.expiryYear.length === 2 
      ? '20' + paymentData.expiryYear 
      : paymentData.expiryYear;
    const expiryDate = new Date(parseInt(fullExpiryYear), parseInt(expiryMonth) - 1);
    const now = new Date();
    if (expiryDate < now) {
      console.error('❌ Card expired');
      return {
        success: false,
        error: 'Card has expired',
        errorCode: 'CARD_EXPIRED'
      };
    }

    console.log('✅ Card validation passed');

    // Step 3: Create order with card payment source
    console.log('📤 Creating PayPal order with card payment...');

    const amountValue = Number(paymentData.amount).toFixed(2);

    // PayPal requires expiry in YYYY-MM format (not MM/YY or MM/YYYY)
    const fullYear = paymentData.expiryYear.length === 2 
      ? '20' + paymentData.expiryYear 
      : paymentData.expiryYear;
    const expiryFormatted = `${fullYear}-${expiryMonth}`; // YYYY-MM format required by PayPal

    // Build billing address if provided
    const billingAddress = {};
    if (paymentData.addressLine1) {
      billingAddress.address_line_1 = paymentData.addressLine1;
    }
    if (paymentData.addressLine2) {
      billingAddress.address_line_2 = paymentData.addressLine2;
    }
    if (paymentData.city) {
      billingAddress.admin_area_2 = paymentData.city; // City
    }
    if (paymentData.state) {
      billingAddress.admin_area_1 = paymentData.state; // State
    }
    if (paymentData.postalCode) {
      billingAddress.postal_code = paymentData.postalCode;
    }
    if (paymentData.countryCode) {
      billingAddress.country_code = paymentData.countryCode; // ISO 3166-1 alpha-2 (e.g., "US")
    }

    // Build cardholder name object - PayPal requires BOTH given_name AND surname if name is provided
    // NOTE: For direct card payments, PayPal does NOT accept the name field in card object
    // The name is used for internal validation only
    const cardholderName = {};
    if (paymentData.firstName && paymentData.lastName) {
      cardholderName.given_name = paymentData.firstName;
      cardholderName.surname = paymentData.lastName;
    }

    // Build card payment source
    const cardPaymentSource = {
      number: cardNumber,
      expiry: expiryFormatted, // PayPal format: YYYY-MM (e.g., "2025-12")
      security_code: cvv
    };

    // DO NOT add name to card object - PayPal rejects it for direct card payments
    // The name field is not supported in card payment source for orders API

    // Add billing address if provided
    if (Object.keys(billingAddress).length > 0) {
      cardPaymentSource.billing_address = billingAddress;
    }

    // Simplified payload - only required fields for card processing
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: paymentData.invoiceNumber || 'default',
          description: paymentData.description || `Invoice ${paymentData.invoiceNumber}`,
          custom_id: paymentData.invoiceNumber || '',
          // Don't send invoice_id to avoid duplicate errors when retrying payments
          // invoice_id: paymentData.invoiceNumber || '',
          amount: {
            currency_code: paymentData.currency || 'USD',
            value: amountValue
          }
        }
      ],
      payment_source: {
        card: cardPaymentSource
      }
    };

    console.log('📋 Order details:');
    console.log('  Amount:', amountValue, paymentData.currency);
    console.log('  Card:', cardNumber.slice(0, 4) + '****' + cardNumber.slice(-4));
    console.log('  Cardholder:', paymentData.cardHolder);
    console.log('  Expiry (formatted):', expiryFormatted);
    console.log('  Name:', paymentData.firstName, paymentData.lastName);
    console.log('  Company:', paymentData.companyName || 'N/A');
    console.log('  Address:', paymentData.addressLine1, paymentData.city, paymentData.state, paymentData.postalCode);
    console.log('📤 Sending order payload:', JSON.stringify(orderPayload, null, 2));

    let orderResponse;
    try {
      orderResponse = await axios.post(
        `${apiEndpoint}/v2/checkout/orders`,
        orderPayload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'PayPal-Request-Id': `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }
        }
      );
    } catch (orderErr) {
      console.error('❌ Order creation failed');
      const errData = orderErr.response?.data;
      console.error('Status:', orderErr.response?.status);
      console.error('Response:', JSON.stringify(errData, null, 2));

      // Parse PayPal error response
      let errorMessage = 'Order creation failed';
      if (errData?.details && Array.isArray(errData.details)) {
        errorMessage = errData.details
          .map(d => d.issue || d.description || d.field)
          .filter(Boolean)
          .join('; ');
      } else if (errData?.message) {
        errorMessage = errData.message;
      } else if (errData?.name) {
        errorMessage = errData.name;
      }

      return {
        success: false,
        error: `PayPal order creation failed: ${errorMessage}`,
        errorCode: 'ORDER_CREATION_FAILED',
        details: errData
      };
    }

    const orderId = orderResponse.data.id;
    const orderStatus = orderResponse.data.status;
    console.log('✅ Order created:', orderId);
    console.log('   Status:', orderStatus);

    // Check if order is already completed/captured
    let transactionId = orderId;
    let captureResponse = orderResponse.data;

    // If order status is COMPLETED, it was auto-captured (common with card payments)
    if (orderStatus === 'COMPLETED') {
      console.log('✅ Order auto-captured by PayPal');
      
      // Extract transaction ID and check capture status
      if (orderResponse.data.purchase_units && orderResponse.data.purchase_units[0]) {
        const payments = orderResponse.data.purchase_units[0].payments;
        if (payments && payments.captures && payments.captures[0]) {
          const capture = payments.captures[0];
          transactionId = capture.id;
          const captureStatus = capture.status;
          
          console.log('   Transaction ID:', transactionId);
          console.log('   Capture Status:', captureStatus);
          
          // Check if capture was actually successful
          if (captureStatus === 'DECLINED') {
            console.error('❌ Payment capture was declined by processor');
            const processorResponse = capture.processor_response || {};
            const declineReason = processorResponse.response_code || 'Unknown reason';
            
            return {
              success: false,
              error: `Payment declined by card processor (Code: ${declineReason})`,
              errorCode: 'PAYMENT_DECLINED',
              details: {
                captureId: transactionId,
                captureStatus,
                processorResponse
              }
            };
          } else if (captureStatus !== 'COMPLETED') {
            console.error('❌ Unexpected capture status:', captureStatus);
            
            return {
              success: false,
              error: `Payment capture failed with status: ${captureStatus}`,
              errorCode: 'CAPTURE_FAILED',
              details: {
                captureId: transactionId,
                captureStatus
              }
            };
          }
        }
      }
    } else {
      // Step 4: Capture the order manually (for non-auto-captured orders)
      console.log('📤 Capturing payment...');

      try {
        captureResponse = await axios.post(
          `${apiEndpoint}/v2/checkout/orders/${orderId}/capture`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Order captured manually');
        
        // Extract transaction ID and check status from manual capture response
        if (captureResponse.data.purchase_units && captureResponse.data.purchase_units[0]) {
          const payments = captureResponse.data.purchase_units[0].payments;
          if (payments && payments.captures && payments.captures[0]) {
            const capture = payments.captures[0];
            transactionId = capture.id;
            const captureStatus = capture.status;
            
            console.log('   Transaction ID:', transactionId);
            console.log('   Capture Status:', captureStatus);
            
            // Check if manual capture was successful
            if (captureStatus === 'DECLINED') {
              console.error('❌ Payment capture was declined by processor');
              const processorResponse = capture.processor_response || {};
              const declineReason = processorResponse.response_code || 'Unknown reason';
              
              return {
                success: false,
                error: `Payment declined by card processor (Code: ${declineReason})`,
                errorCode: 'PAYMENT_DECLINED',
                details: {
                  captureId: transactionId,
                  captureStatus,
                  processorResponse
                }
              };
            } else if (captureStatus !== 'COMPLETED') {
              console.error('❌ Unexpected capture status:', captureStatus);
              
              return {
                success: false,
                error: `Payment capture failed with status: ${captureStatus}`,
                errorCode: 'CAPTURE_FAILED',
                details: {
                  captureId: transactionId,
                  captureStatus
                }
              };
            }
          }
        }
      } catch (captureErr) {
        console.error('❌ Payment capture failed');
        const errData = captureErr.response?.data;
        console.error('Status:', captureErr.response?.status);
        console.error('Response:', JSON.stringify(errData, null, 2));

        let errorMessage = 'Payment capture failed';
        if (errData?.details && Array.isArray(errData.details)) {
          errorMessage = errData.details
            .map(d => d.issue || d.description)
            .filter(Boolean)
            .join('; ');
        } else if (errData?.message) {
          errorMessage = errData.message;
        }

        return {
          success: false,
          error: `PayPal payment capture failed: ${errorMessage}`,
          errorCode: 'CAPTURE_FAILED',
          details: errData
        };
      }
    }

    console.log('✅ Payment successful!');
    console.log('   Transaction ID:', transactionId);
    console.log('   Order ID:', orderId);
    
    return {
      success: true,
      transactionId: transactionId,
      message: 'Payment processed successfully',
      reference: transactionId,
      orderId: orderId,
      mode: credentials.mode,
      amount: amountValue,
      currency: paymentData.currency || 'USD'
    };

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
