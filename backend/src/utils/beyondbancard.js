const axios = require('axios');

// BeyondBancard payment processing
// API endpoint for BeyondBancard - update based on actual endpoint from BeyondBancard docs
const BEYONDBANCARD_API_ENDPOINT = 'https://api.beyondbancard.com/api/v1';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://sandbox.beyondbancard.com/api/v1';

async function processBeyondbancardPayment(credentials, paymentData) {
  try {
    // Validate credentials
    if (!credentials.apiKey || !credentials.apiSecret) {
      return {
        success: false,
        error: 'BeyondBancard API Key and Secret are required'
      };
    }

    // Validate card data
    if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.expiryMonth || !paymentData.expiryYear || !paymentData.cvv) {
      return {
        success: false,
        error: 'Card information is incomplete'
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
        expiryMonth: String(paymentData.expiryMonth).padStart(2, '0'),
        expiryYear: String(paymentData.expiryYear),
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
    if (response.data && (response.data.success || response.data.status === 'completed' || response.data.status === 'approved')) {
      return {
        success: true,
        transactionId: response.data.transactionId || response.data.id || response.data.reference,
        message: 'Payment processed successfully',
        authCode: response.data.authCode || response.data.auth_code,
        reference: response.data.reference
      };
    } else {
      return {
        success: false,
        error: response.data?.message || response.data?.error || 'Payment processing failed',
        errorCode: response.data?.errorCode || response.data?.code
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

    // Handle network errors
    if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: 'Cannot connect to BeyondBancard API. Please check endpoint URL or try again later.',
        errorCode: 'NETWORK_ERROR'
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

    if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        message: 'Cannot reach BeyondBancard API endpoint. Please verify the endpoint URL is correct.',
        errorCode: 'ENDPOINT_NOT_FOUND'
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
