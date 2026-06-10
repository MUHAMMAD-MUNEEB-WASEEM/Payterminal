const axios = require('axios');

// BeyondBancard payment processing
// Assumes API endpoint and authentication as per BeyondBancard documentation
// Credentials needed: apiKey, apiSecret (or similar auth tokens)

const BEYONDBANCARD_API_ENDPOINT = 'https://api.beyondbancard.com/v1'; // May need to be updated based on actual endpoint
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://sandbox-api.beyondbancard.com/v1'; // Sandbox endpoint

async function processBeyondbancardPayment(credentials, paymentData) {
  try {
    // Validate credentials
    if (!credentials.apiKey || !credentials.apiSecret) {
      return {
        success: false,
        error: 'BeyondBancard API Key and Secret are required'
      };
    }

    const endpoint = credentials.mode === 'live' 
      ? BEYONDBANCARD_API_ENDPOINT 
      : BEYONDBANCARD_SANDBOX_ENDPOINT;

    // Format payment request
    const paymentRequest = {
      amount: Math.round(paymentData.amount * 100), // Convert to cents
      currency: paymentData.currency || 'USD',
      card: {
        number: paymentData.cardNumber.replace(/\s/g, ''),
        name: paymentData.cardHolder,
        expiryMonth: paymentData.expiryMonth,
        expiryYear: paymentData.expiryYear,
        cvv: paymentData.cvv
      },
      description: paymentData.description,
      reference: `TXN-${Date.now()}`,
      metadata: {
        integration: 'PayTerminal'
      }
    };

    // Create axios instance with authentication
    const instance = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'X-API-Secret': credentials.apiSecret,
        'Content-Type': 'application/json',
        'User-Agent': 'PayTerminal/1.0'
      },
      timeout: 30000
    });

    // Process payment
    const response = await instance.post('/transactions/charge', paymentRequest);

    // Handle successful response
    if (response.data && response.data.success) {
      return {
        success: true,
        transactionId: response.data.transactionId || response.data.id,
        message: 'Payment processed successfully',
        authCode: response.data.authCode,
        reference: response.data.reference
      };
    } else {
      return {
        success: false,
        error: response.data?.message || 'Payment processing failed',
        errorCode: response.data?.errorCode
      };
    }
  } catch (error) {
    console.error('BeyondBancard payment error:', error.message);

    // Handle specific error responses
    if (error.response) {
      const errorData = error.response.data;
      
      if (error.response.status === 401) {
        return {
          success: false,
          error: 'Invalid API credentials',
          errorCode: 'AUTH_FAILED'
        };
      }

      if (error.response.status === 400) {
        return {
          success: false,
          error: errorData.message || 'Invalid payment data',
          errorCode: errorData.errorCode || 'INVALID_DATA'
        };
      }

      if (error.response.status === 402) {
        return {
          success: false,
          error: 'Payment declined',
          errorCode: errorData.errorCode || 'PAYMENT_DECLINED'
        };
      }

      return {
        success: false,
        error: errorData.message || 'Payment processing failed',
        errorCode: errorData.errorCode
      };
    }

    return {
      success: false,
      error: error.message || 'Payment processing failed',
      errorCode: 'NETWORK_ERROR'
    };
  }
}

// Test BeyondBancard credentials
async function testBeyondbancardCredentials(apiKey, apiSecret, mode = 'sandbox') {
  try {
    const endpoint = mode === 'live'
      ? BEYONDBANCARD_API_ENDPOINT
      : BEYONDBANCARD_SANDBOX_ENDPOINT;

    const instance = axios.create({
      baseURL: endpoint,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Secret': apiSecret,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    // Test connection with a simple API call
    const response = await instance.get('/account/verify');

    if (response.status === 200) {
      return {
        success: true,
        message: 'Credentials are valid'
      };
    }

    return {
      success: false,
      message: 'Failed to verify credentials'
    };
  } catch (error) {
    console.error('BeyondBancard credential test error:', error.message);
    
    if (error.response?.status === 401) {
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
