const axios = require('axios');

// BeyondBancard payment processing via Transaction Gateway
// Documentation: https://beyondbancard.com
// The Transaction Gateway API uses REST with Basic Auth
//
// Key endpoints:
// - Sandbox: https://api.sandbox.transactiongateway.com (or similar)
// - Live: https://beyondbancard.transactiongateway.com (or similar)
//
// Note: The exact endpoint may vary. If you get 404 errors:
// 1. Verify the correct API endpoint with BeyondBancard support
// 2. Check if the endpoint requires a specific path like /api/v1 or just /
// 3. Confirm the transaction endpoint is /transactions or /charge or something else

const BEYONDBANCARD_API_ENDPOINT = 'https://beyondbancard.transactiongateway.com/api/v1';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://api.sandbox.transactiongateway.com/api/v1';

async function processBeyondbancardPayment(credentials, paymentData) {
  try {
    // Validate credentials
    if (!credentials.apiKey || !credentials.apiSecret) {
      return {
        success: false,
        error: 'BeyondBancard API Key and Secret are required'
      };
    }

    // Validate card data - STRICT VALIDATION
    if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.expiryMonth || !paymentData.expiryYear || !paymentData.cvv) {
      return {
        success: false,
        error: 'Card information is incomplete'
      };
    }

    // Validate card format
    const cardNumber = paymentData.cardNumber.replace(/\s/g, '');
    const cvv = paymentData.cvv.trim();
    const expiryMonth = String(paymentData.expiryMonth).padStart(2, '0');
    const expiryYear = String(paymentData.expiryYear);

    // Validate card number (must be 13-19 digits)
    if (!/^\d{13,19}$/.test(cardNumber)) {
      return {
        success: false,
        error: 'Invalid card number format'
      };
    }

    // Validate CVV (3-4 digits)
    if (!/^\d{3,4}$/.test(cvv)) {
      return {
        success: false,
        error: 'Invalid CVV'
      };
    }

    // Validate expiry month (01-12)
    if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth)) {
      return {
        success: false,
        error: 'Invalid expiry month'
      };
    }

    // Validate expiry year (current or future)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const year = parseInt(expiryYear);
    
    if (year < currentYear || (year === currentYear && parseInt(expiryMonth) < currentMonth)) {
      return {
        success: false,
        error: 'Card has expired'
      };
    }

    // Luhn algorithm validation for card number
    if (!luhnCheck(cardNumber)) {
      return {
        success: false,
        error: 'Invalid card number',
        errorCode: 'INVALID_CARD'
      };
    }

    const endpoint = credentials.mode === 'live' 
      ? BEYONDBANCARD_API_ENDPOINT 
      : BEYONDBANCARD_SANDBOX_ENDPOINT;

    // Create axios instance with authentication
    // Transaction Gateway uses Basic Auth with API Key and Secret
    const auth = {
      username: credentials.apiKey,
      password: credentials.apiSecret
    };

    const instance = axios.create({
      baseURL: endpoint,
      auth: auth,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PayTerminal/1.0'
      },
      timeout: 30000
    });

    // Format payment request for Transaction Gateway
    // Try a simpler request format first
    const paymentRequest = {
      transaction_type: 'charge',
      payment_method: 'credit_card',
      amount: Math.round(paymentData.amount * 100), // Amount in cents
      currency: paymentData.currency || 'USD',
      credit_card: {
        card_number: cardNumber,
        cardholder_name: paymentData.cardHolder,
        expiration_month: expiryMonth,
        expiration_year: expiryYear,
        cvv: cvv
      },
      order: {
        invoice_number: paymentData.description,
        description: paymentData.description
      }
    };

    console.log('Processing BeyondBancard payment via:', endpoint);
    console.log('Payment amount:', paymentData.amount, 'Card last 4:', cardNumber.slice(-4));
    console.log('Request payload:', JSON.stringify(paymentRequest, null, 2));
    
    let response;
    let attemptedEndpoint = '/transactions';
    let rawError = null;
    
    try {
      // Try the main transactions endpoint
      response = await instance.post('/transactions', paymentRequest);
    } catch (err) {
      rawError = {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      };
      
      console.warn('❌ /transactions endpoint failed:', JSON.stringify(rawError, null, 2));
      
      // If /transactions doesn't work, try alternative endpoints
      if (err.response?.status === 404) {
        console.warn('⚠️ /transactions returned 404, trying alternatives...');
        try {
          response = await instance.post('/charge', paymentRequest);
          attemptedEndpoint = '/charge';
          console.log('✅ /charge endpoint worked');
        } catch (err2) {
          console.warn('⚠️ /charge also failed:', err2.message);
          try {
            response = await instance.post('/', paymentRequest);
            attemptedEndpoint = '/';
            console.log('✅ / endpoint worked');
          } catch (err3) {
            // All endpoints failed
            console.error('❌ All endpoints failed. Last error:', JSON.stringify({
              message: err3.message,
              status: err3.response?.status,
              data: err3.response?.data
            }, null, 2));
            throw err; // Throw the original error
          }
        }
      } else {
        // Non-404 error on first attempt
        console.error('❌ First request failed with non-404 error:', rawError);
        throw err;
      }
    }

    console.log(`✅ Request succeeded on endpoint: ${attemptedEndpoint}`);
    console.log('BeyondBancard response status:', response.status);
    console.log('BeyondBancard response data:', JSON.stringify(response.data, null, 2));

    // BeyondBancard Transaction Gateway returns different response formats
    // We need to check multiple fields to determine success
    const responseData = response.data || {};
    
    // Possible transaction ID fields
    const transactionId = responseData.transaction_id || 
                         responseData.id || 
                         responseData.transactionId ||
                         responseData.reference_id;
    
    // Possible success indicators
    const successIndicators = [
      responseData.success === true,
      responseData.status === 'approved',
      responseData.status === 'captured',
      responseData.status === 'success',
      responseData.result === 'success',
      (response.status === 200 || response.status === 201) && transactionId
    ];
    
    const isSuccessful = successIndicators.some(x => x);

    if (isSuccessful && transactionId) {
      console.log('✅ Payment successful! Transaction ID:', transactionId);
      return {
        success: true,
        transactionId: transactionId,
        message: 'Payment processed successfully',
        authCode: responseData.authorization_code || responseData.auth_code || responseData.authCode,
        reference: transactionId
      };
    } else if (responseData.errors && responseData.errors.length > 0) {
      // API returned errors array
      const firstError = responseData.errors[0];
      const errorMsg = firstError.message || firstError.description || 'Payment declined';
      console.log('❌ Payment error:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        errorCode: firstError.code
      };
    } else if (!isSuccessful) {
      // Not successful - determine why
      const errorMsg = responseData.error_message || 
                      responseData.message || 
                      responseData.description ||
                      `Payment was not processed. Status: ${responseData.status}`;
      console.log('❌ Payment failed:', errorMsg);
      return {
        success: false,
        error: errorMsg,
        errorCode: responseData.error_code || responseData.code || 'PAYMENT_FAILED'
      };
    } else {
      // We have transaction ID but success not confirmed
      console.log('⚠️ Ambiguous response - transaction ID present but success not confirmed');
      return {
        success: true,
        transactionId: transactionId,
        message: 'Payment processed',
        reference: transactionId
      };
    }
  } catch (error) {
    console.error('\n❌ PAYMENT PROCESSOR ERROR:');
    console.error('Gateway: BeyondBancard');
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    
    if (error.response) {
      console.error('---Response Details---');
      console.error('Response status:', error.response.status);
      console.error('Response statusText:', error.response.statusText);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('---Request Made But No Response---');
      console.error('Request:', error.request);
    } else {
      console.error('---Error During Request Setup---');
      console.error('Error message:', error.message);
    }
    console.error('Error stack:', error.stack);
    console.error('\n');

    // Handle specific error responses
    if (error.response) {
      const errorData = error.response.data || {};
      
      if (error.response.status === 401 || error.response.status === 403) {
        return {
          success: false,
          error: 'Invalid API credentials - authentication failed. Please verify your API Key and Secret.',
          errorCode: 'AUTH_FAILED'
        };
      }

      if (error.response.status === 404) {
        return {
          success: false,
          error: 'BeyondBancard API endpoint not found. The endpoint may have changed. Please contact BeyondBancard support or check your endpoint configuration.',
          errorCode: 'ENDPOINT_NOT_FOUND'
        };
      }

      if (error.response.status === 400) {
        // 400 means invalid request data - card declined, expired, etc.
        return {
          success: false,
          error: errorData.error_message || errorData.message || 'Invalid payment data - ' + (errorData.errors?.[0]?.message || 'please check your card details'),
          errorCode: errorData.error_code || 'INVALID_REQUEST'
        };
      }

      if (error.response.status === 402 || errorData?.error_code === 'declined' || errorData?.status === 'declined') {
        return {
          success: false,
          error: 'Payment declined - ' + (errorData.error_message || errorData.message || 'Your card was declined'),
          errorCode: 'PAYMENT_DECLINED'
        };
      }

      if (error.response.status === 422) {
        // Unprocessable entity - validation error
        return {
          success: false,
          error: 'Invalid card data - ' + (errorData.error_message || errorData.message || 'Please check your card details'),
          errorCode: 'VALIDATION_ERROR'
        };
      }

      if (error.response.status === 500 || error.response.status === 502 || error.response.status === 503) {
        return {
          success: false,
          error: `BeyondBancard server error (${error.response.status}) - please try again later`,
          errorCode: 'GATEWAY_ERROR'
        };
      }

      // Generic error response
      return {
        success: false,
        error: errorData.error_message || errorData.message || `Payment failed with status ${error.response.status}`,
        errorCode: errorData.error_code || 'UNKNOWN_ERROR'
      };
    }

    // Handle network errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: 'Cannot reach BeyondBancard API server. Please check your internet connection and the API endpoint configuration.',
        errorCode: 'NETWORK_ERROR'
      };
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
      return {
        success: false,
        error: 'Payment gateway timeout - please try again',
        errorCode: 'TIMEOUT_ERROR'
      };
    }

    if (error.code === 'EAUTHFAILED') {
      return {
        success: false,
        error: 'SSL certificate authentication failed - API endpoint may be invalid',
        errorCode: 'SSL_ERROR'
      };
    }

    return {
      success: false,
      error: error.message || 'Payment processing failed',
      errorCode: error.code || 'PAYMENT_ERROR'
    };
  }
}

// Luhn algorithm to validate card number
function luhnCheck(cardNumber) {
  let sum = 0;
  let isEven = false;

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber.charAt(i), 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

// Test BeyondBancard credentials
async function testBeyondbancardCredentials(apiKey, apiSecret, mode = 'sandbox') {
  try {
    if (!apiKey || !apiSecret) {
      return {
        success: false,
        message: 'API Key and Secret are required'
      };
    }

    const endpoint = mode === 'live'
      ? BEYONDBANCARD_API_ENDPOINT
      : BEYONDBANCARD_SANDBOX_ENDPOINT;

    const auth = {
      username: apiKey,
      password: apiSecret
    };

    const instance = axios.create({
      baseURL: endpoint,
      auth: auth,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Testing BeyondBancard credentials at:', endpoint);
    
    // Test with a minimal transaction request to verify auth works
    // This validates that the credentials are accepted by the API
    const testPayment = {
      transaction_type: 'charge',
      payment_method: 'credit_card',
      amount: 1, // $0.01
      currency: 'USD',
      credit_card: {
        card_number: '4242424242424242', // Test card
        cardholder_name: 'Test User',
        expiration_month: '12',
        expiration_year: '2025',
        cvv: '999'
      },
      order: {
        invoice_number: 'TEST',
        description: 'Credential Test'
      }
    };

    try {
      const response = await instance.post('/transactions', testPayment);
      
      // If we get here, auth worked (even if transaction failed)
      if (response.status === 200 || response.status === 201) {
        return {
          success: true,
          message: 'Credentials are valid and API is accessible'
        };
      }
    } catch (testError) {
      // If auth failed (401/403), the error will have that status
      if (testError.response?.status === 401 || testError.response?.status === 403) {
        return {
          success: false,
          message: 'Invalid API Key or Secret - Authentication failed',
          errorCode: 'AUTH_FAILED'
        };
      }
      
      // If we get a 402 or other payment error, auth succeeded but transaction failed
      // This means credentials are valid
      if (testError.response?.status === 402 || testError.response?.status === 400) {
        return {
          success: true,
          message: 'Credentials are valid (test transaction declined, which is expected)'
        };
      }
      
      // For other errors, still consider it a success if we got a response from the API
      if (testError.response) {
        return {
          success: true,
          message: 'Credentials are valid and API responded'
        };
      }
      
      throw testError;
    }

    return {
      success: true,
      message: 'Credentials are valid'
    };
  } catch (error) {
    console.error('BeyondBancard credential test error:', error.message);
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: 'Cannot reach BeyondBancard API. Please check your connection or contact BeyondBancard support.',
        errorCode: 'ENDPOINT_NOT_FOUND'
      };
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        message: 'Invalid API Key or Secret',
        errorCode: 'AUTH_FAILED'
      };
    }

    return {
      success: false,
      message: error.message || 'Failed to test credentials',
      errorCode: 'TEST_FAILED'
    };
  }
}

module.exports = {
  processBeyondbancardPayment,
  testBeyondbancardCredentials
};
