const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Function to log to file
function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(path.join(logsDir, 'beyondbancard.log'), logMessage);
  console.log(message); // Also log to console
}

// BeyondBancard API endpoint - uses form-encoded POST
// Documentation: https://beyondbancard.com
// The transact.php endpoint accepts form-encoded parameters
const BEYONDBANCARD_API_ENDPOINT = 'https://beyondbancard.transactiongateway.com/api/transact.php';
const BEYONDBANCARD_SANDBOX_ENDPOINT = 'https://api.sandbox.transactiongateway.com/api/transact.php';

async function processBeyondbancardPayment(credentials, paymentData) {
  try {
    // Log at the very start
    console.log('🚀 BeyondBancard payment processor started');
    logToFile('🚀 BeyondBancard payment processor started');
    
    const hasToken = !!paymentData.token;
    const hasCardData = !!paymentData.cardNumber;
    
    console.log('Input credentials:', { hasCredentials: !!credentials, hasApiKey: !!credentials?.apiKey, hasApiSecret: !!credentials?.apiSecret, mode: credentials?.mode });
    console.log('Input paymentData:', { 
      amount: paymentData.amount,
      hasToken: hasToken,
      hasCardNumber: hasCardData,
      cardHolder: paymentData.cardHolder,
      expiryMonth: paymentData.expiryMonth,
      expiryYear: paymentData.expiryYear,
      hasCvv: !!paymentData.cvv,
      currency: paymentData.currency
    });
    
    // Validate credentials
    if (!credentials || !credentials.apiKey || !credentials.apiSecret) {
      console.error('❌ Missing credentials:', { hasCredentials: !!credentials, hasApiKey: !!credentials?.apiKey, hasApiSecret: !!credentials?.apiSecret });
      logToFile('❌ Missing credentials');
      return {
        success: false,
        error: 'BeyondBancard API Key and Secret are required',
        errorCode: 'MISSING_CREDENTIALS'
      };
    }

    console.log('✅ Credentials present');
    logToFile('✅ Credentials present');
    
    // Handle tokenized payments (from Collect.js)
    if (paymentData.token) {
      console.log('🔷 Processing tokenized payment...');
      logToFile('🔷 Processing tokenized payment with token: ' + paymentData.token);
      
      const endpoint = credentials.mode === 'live' 
        ? BEYONDBANCARD_API_ENDPOINT 
        : BEYONDBANCARD_SANDBOX_ENDPOINT;

      console.log('📍 Using endpoint:', endpoint);
      logToFile('📍 Endpoint: ' + endpoint);
      
      // Build payment request using token
      const paymentRequest = {
        type: 'sale',
        amount: (paymentData.amount * 100).toFixed(0), // Amount in cents
        currency: paymentData.currency || 'USD',
        payment_token: paymentData.token, // Use token instead of card data
        firstname: paymentData.cardHolder.split(' ')[0] || paymentData.cardHolder,
        lastname: paymentData.cardHolder.split(' ').slice(1).join(' ') || '',
        orderid: paymentData.description,
        orderdescription: paymentData.description,
        username: credentials.apiKey,
        password: credentials.apiSecret
      };

      console.log('\n📤 SENDING TOKENIZED REQUEST TO BEYONDBANCARD');
      console.log('Endpoint:', endpoint);
      console.log('Amount:', paymentData.amount, 'USD (cents:', paymentRequest.amount + ')');
      console.log('Token:', paymentData.token.substring(0, 10) + '...');
      console.log('Cardholder:', paymentData.cardHolder);
      console.log('Request keys:', Object.keys(paymentRequest));
      
      logToFile('\n📤 SENDING TOKENIZED REQUEST');
      logToFile('Endpoint: ' + endpoint);
      logToFile('Amount: ' + paymentData.amount + ' USD');
      logToFile('Token: ' + paymentData.token.substring(0, 10) + '...');
      logToFile('Request keys: ' + Object.keys(paymentRequest).join(', '));

      // Convert to URL-encoded form data
      const formData = new URLSearchParams();
      Object.entries(paymentRequest).forEach(([key, value]) => {
        formData.append(key, value);
      });

      console.log('Form data prepared');
      logToFile('Form data prepared');
      
      let response;
      
      try {
        console.log(`\n🔷 Posting tokenized request to ${endpoint}...`);
        logToFile(`🔷 Posting tokenized request to ${endpoint}...`);
        
        const httpsAgent = new (require('https').Agent)({
          rejectUnauthorized: false
        });
        
        response = await axios.post(endpoint, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000,
          validateStatus: () => true,
          httpsAgent: httpsAgent
        });

        console.log(`✅ Response received - Status ${response.status}`);
        logToFile(`✅ Response received - Status ${response.status}`);
        
      } catch (error) {
        console.error('❌ Request error:', error.message);
        logToFile('❌ Request error: ' + error.message);
        throw error;
      }

      // Parse response
      const responseText = response.data || '';
      console.log('\n📥 Raw response:', responseText);
      logToFile('\n📥 Raw response: ' + responseText);
      
      const params = new URLSearchParams(responseText);
      const resultCode = params.get('response') || '';
      const reasonText = params.get('responsetext') || '';
      const transactionId = params.get('transactionid') || '';
      const authCode = params.get('authcode') || '';
      
      console.log('Response parsed:', {
        resultCode,
        reasonText,
        transactionId,
        authCode
      });
      logToFile('Response parsed: resultCode=' + resultCode + ', reasonText=' + reasonText);
      
      // Check result
      if (resultCode === '1') {
        console.log('✅ Tokenized payment successful! Transaction ID:', transactionId);
        logToFile('✅ TOKENIZED PAYMENT SUCCESSFUL');
        logToFile('Transaction ID: ' + transactionId);
        
        return {
          success: true,
          transactionId: transactionId,
          authCode: authCode,
          message: 'Payment processed successfully',
          reference: transactionId
        };
      }
      
      if (resultCode === '2') {
        const errorMsg = reasonText || 'Payment declined';
        console.log('❌ Payment declined:', errorMsg);
        logToFile('❌ PAYMENT DECLINED: ' + errorMsg);
        return {
          success: false,
          error: 'Payment declined - ' + errorMsg,
          errorCode: 'PAYMENT_DECLINED'
        };
      }
      
      if (resultCode === '3') {
        const errorMsg = reasonText || 'Payment processing error';
        console.log('❌ Payment error:', errorMsg);
        logToFile('❌ PAYMENT ERROR: ' + errorMsg);
        
        if (reasonText && reasonText.toLowerCase().includes('authentication')) {
          return {
            success: false,
            error: 'Authentication failed - Invalid API Key or Secret. Response: ' + reasonText,
            errorCode: 'AUTH_FAILED'
          };
        }
        
        return {
          success: false,
          error: 'Payment error - ' + errorMsg,
          errorCode: 'PAYMENT_ERROR'
        };
      }
      
      console.error('❌ Unknown result code:', resultCode);
      logToFile('❌ Unknown result code: ' + resultCode);
      logToFile('Full response: ' + responseText);
      
      return {
        success: false,
        error: 'Unknown payment response - ' + (reasonText || 'Please contact support'),
        errorCode: 'UNKNOWN_RESPONSE'
      };
    }
    
    // Original raw card data handling (for fallback)
    
    // Validate card data - STRICT VALIDATION
    if (!paymentData.cardNumber || !paymentData.cardHolder || !paymentData.expiryMonth || !paymentData.expiryYear || !paymentData.cvv) {
      console.error('❌ Card data incomplete:', { 
        cardNumber: !!paymentData.cardNumber, 
        cardHolder: !!paymentData.cardHolder, 
        expiryMonth: !!paymentData.expiryMonth, 
        expiryYear: !!paymentData.expiryYear, 
        cvv: !!paymentData.cvv 
      });
      logToFile('❌ Card data incomplete');
      return {
        success: false,
        error: 'Card information is incomplete',
        errorCode: 'INCOMPLETE_CARD_DATA'
      };
    }

    console.log('✅ Card data complete');
    logToFile('✅ Card data complete');

    // Validate and format card data
    const cardNumber = paymentData.cardNumber.replace(/\s/g, '');
    const cvv = String(paymentData.cvv).trim();
    const expiryMonth = String(paymentData.expiryMonth).padStart(2, '0');
    const expiryYear = String(paymentData.expiryYear);
    
    console.log('Card data formatted:', {
      cardNumber: cardNumber.slice(0, 4) + '...' + cardNumber.slice(-4),
      expiryMonth,
      expiryYear,
      cvvLength: cvv.length
    });
    logToFile('Card data formatted successfully');

    console.log('Validating card format...');
    logToFile('Validating card format...');

    // Validate card number (must be 13-19 digits)
    if (!/^\d{13,19}$/.test(cardNumber)) {
      console.error('❌ Invalid card number format:', { 
        length: cardNumber.length, 
        pattern: `/^\d{13,19}$/`,
        sample: cardNumber.slice(0, 4) + '...' 
      });
      logToFile('❌ Invalid card number format: length=' + cardNumber.length);
      return {
        success: false,
        error: 'Invalid card number format',
        errorCode: 'INVALID_CARD_FORMAT'
      };
    }

    console.log('✅ Card number format valid');
    logToFile('✅ Card number format valid');

    // Validate CVV (3-4 digits)
    if (!/^\d{3,4}$/.test(cvv)) {
      console.error('❌ Invalid CVV:', { length: cvv.length, pattern: `/^\d{3,4}$/` });
      logToFile('❌ Invalid CVV: length=' + cvv.length);
      return {
        success: false,
        error: 'Invalid CVV',
        errorCode: 'INVALID_CVV'
      };
    }

    console.log('✅ CVV valid');
    logToFile('✅ CVV valid');

    // Validate expiry month (01-12)
    if (!/^(0[1-9]|1[0-2])$/.test(expiryMonth)) {
      console.error('❌ Invalid expiry month:', expiryMonth);
      logToFile('❌ Invalid expiry month: ' + expiryMonth);
      return {
        success: false,
        error: 'Invalid expiry month',
        errorCode: 'INVALID_MONTH'
      };
    }

    console.log('✅ Expiry month valid');
    logToFile('✅ Expiry month valid');

    // Validate expiry year (current or future)
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const year = parseInt(expiryYear);
    
    if (isNaN(year) || year < currentYear || (year === currentYear && parseInt(expiryMonth) < currentMonth)) {
      console.error('❌ Card has expired or invalid year:', { 
        expiryYear: expiryYear, 
        year: year, 
        currentYear: currentYear, 
        currentMonth: currentMonth, 
        expiryMonth: expiryMonth 
      });
      logToFile(`❌ Card expired/invalid: year=${year}, current=${currentYear}`);
      return {
        success: false,
        error: 'Card has expired',
        errorCode: 'CARD_EXPIRED'
      };
    }

    console.log('✅ Expiry date valid');
    logToFile('✅ Expiry date valid');

    // Luhn algorithm validation for card number
    if (!luhnCheck(cardNumber)) {
      console.error('❌ Invalid card number (Luhn check failed)');
      logToFile('❌ Luhn check failed');
      return {
        success: false,
        error: 'Invalid card number',
        errorCode: 'INVALID_CARD'
      };
    }

    console.log('✅ Luhn check passed');
    logToFile('✅ Luhn check passed');

    // Get endpoint
    const endpoint = credentials.mode === 'live' 
      ? BEYONDBANCARD_API_ENDPOINT 
      : BEYONDBANCARD_SANDBOX_ENDPOINT;

    console.log('📍 Using endpoint:', endpoint);
    logToFile('📍 Endpoint: ' + endpoint);
    
    // BeyondBancard transact.php uses form-encoded POST
    // Build form data for the API
    const paymentRequest = {
      type: 'sale',
      amount: (paymentData.amount * 100).toFixed(0), // Amount in cents (no decimal)
      currency: paymentData.currency || 'USD',
      ccnumber: cardNumber,
      ccexp: `${expiryMonth}${expiryYear}`, // Format: MMYY
      cvv: cvv,
      firstname: paymentData.cardHolder.split(' ')[0] || paymentData.cardHolder,
      lastname: paymentData.cardHolder.split(' ').slice(1).join(' ') || '',
      orderid: paymentData.description,
      orderdescription: paymentData.description,
      username: credentials.apiKey,
      password: credentials.apiSecret
    };

    console.log('\n📤 SENDING REQUEST TO BEYONDBANCARD');
    console.log('Endpoint:', endpoint);
    console.log('Amount:', paymentData.amount, 'USD (cents:', paymentRequest.amount + ')');
    console.log('Card last 4:', cardNumber.slice(-4));
    console.log('Cardholder:', paymentData.cardHolder);
    console.log('Expiry:', `${expiryMonth}/${expiryYear}`);
    console.log('Request keys:', Object.keys(paymentRequest));
    
    logToFile('\n📤 SENDING REQUEST');
    logToFile('Endpoint: ' + endpoint);
    logToFile('Amount: ' + paymentData.amount + ' USD');
    logToFile('Card: ' + cardNumber.slice(-4));
    logToFile('Request keys: ' + Object.keys(paymentRequest).join(', '));

    // Convert object to URL-encoded form data
    const formData = new URLSearchParams();
    Object.entries(paymentRequest).forEach(([key, value]) => {
      formData.append(key, value);
    });

    console.log('Form data prepared');
    logToFile('Form data prepared');
    
    let response;
    
    try {
      console.log(`\n🔷 Posting to ${endpoint}...`);
      logToFile(`🔷 Posting to ${endpoint}...`);
      
      // In development, disable SSL certificate verification for sandbox endpoints
      const httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false // Allow self-signed/mismatched certificates in development
      });
      
      response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000,
        validateStatus: () => true, // Accept all status codes
        httpsAgent: httpsAgent
      });

      console.log(`✅ Response received - Status ${response.status}`);
      logToFile(`✅ Response received - Status ${response.status}`);
      
    } catch (error) {
      console.error('❌ Request error:', error.message);
      logToFile('❌ Request error: ' + error.message);
      throw error;
    }

    // Parse response - BeyondBancard returns query-string format
    // Format: response=X&responsetext=...&authcode=...&transactionid=...
    // response = Result code (1=approved, 2=declined, 3=error)
    
    const responseText = response.data || '';
    console.log('\n📥 Raw response:', responseText);
    logToFile('\n📥 Raw response: ' + responseText);
    
    // Parse query string format response
    const params = new URLSearchParams(responseText);
    const resultCode = params.get('response') || '';
    const reasonText = params.get('responsetext') || '';
    const transactionId = params.get('transactionid') || '';
    const authCode = params.get('authcode') || '';
    
    console.log('Response parsed:', {
      resultCode,
      reasonText,
      transactionId,
      authCode
    });
    logToFile('Response parsed: resultCode=' + resultCode + ', reasonText=' + reasonText + ', transactionId=' + transactionId);
    
    // Check if payment was successful
    // Result code 1 = Approved
    if (resultCode === '1') {
      console.log('✅ Payment successful! Transaction ID:', transactionId);
      logToFile('✅ PAYMENT SUCCESSFUL');
      logToFile('Transaction ID: ' + transactionId);
      logToFile('Auth Code: ' + authCode);
      
      return {
        success: true,
        transactionId: transactionId,
        authCode: authCode,
        message: 'Payment processed successfully',
        reference: transactionId
      };
    }
    
    // Result code 2 = Declined
    if (resultCode === '2') {
      const errorMsg = reasonText || 'Payment declined';
      console.log('❌ Payment declined:', errorMsg);
      logToFile('❌ PAYMENT DECLINED: ' + errorMsg);
      return {
        success: false,
        error: 'Payment declined - ' + errorMsg,
        errorCode: 'PAYMENT_DECLINED'
      };
    }
    
    // Result code 3 = Error
    if (resultCode === '3') {
      const errorMsg = reasonText || 'Payment processing error';
      console.log('❌ Payment error:', errorMsg);
      logToFile('❌ PAYMENT ERROR: ' + errorMsg);
      
      // Special handling for authentication errors
      if (reasonText && reasonText.toLowerCase().includes('authentication')) {
        return {
          success: false,
          error: 'Authentication failed - Invalid API Key or Secret. Response: ' + reasonText,
          errorCode: 'AUTH_FAILED'
        };
      }
      
      return {
        success: false,
        error: 'Payment error - ' + errorMsg,
        errorCode: 'PAYMENT_ERROR'
      };
    }
    
    // Unknown result code
    console.error('❌ Unknown result code:', resultCode);
    logToFile('❌ Unknown result code: ' + resultCode);
    logToFile('Full response: ' + responseText);
    
    return {
      success: false,
      error: 'Unknown payment response - ' + (reasonText || 'Please contact support'),
      errorCode: 'UNKNOWN_RESPONSE'
    };
    
  } catch (error) {
    console.error('\n❌❌❌ CATCH BLOCK ERROR ❌❌❌');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    
    logToFile('\n❌❌❌ CATCH BLOCK ERROR ❌❌❌');
    logToFile('Message: ' + error.message);
    logToFile('Code: ' + error.code);
    
    if (error.response) {
      console.error('---Response Details---');
      console.error('Status:', error.response.status);
      console.error('StatusText:', error.response.statusText);
      console.error('Data:', error.response.data);
      
      logToFile('---Response Details---');
      logToFile('Status: ' + error.response.status);
      logToFile('Data: ' + error.response.data);
    }

    // Handle specific error codes
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

    if (error.response?.status === 401 || error.response?.status === 403) {
      return {
        success: false,
        error: 'Authentication failed - Invalid API Key or Secret',
        errorCode: 'AUTH_FAILED'
      };
    }

    if (error.response?.status === 404) {
      return {
        success: false,
        error: 'BeyondBancard API endpoint not found. Please verify the endpoint configuration: ' + BEYONDBANCARD_API_ENDPOINT,
        errorCode: 'ENDPOINT_NOT_FOUND'
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

    console.log('Testing BeyondBancard credentials at:', endpoint);
    
    // Test with a minimal transaction request to verify auth works
    const testData = new URLSearchParams({
      type: 'sale',
      amount: '1', // $0.01
      currency: 'USD',
      ccnumber: '4242424242424242', // Test card
      ccexp: '1225', // 12/25
      cvv: '999',
      firstname: 'Test',
      lastname: 'User',
      orderid: 'TEST',
      orderdescription: 'Credential Test',
      username: apiKey,
      password: apiSecret
    });

    try {
      // Allow self-signed certificates in development
      const httpsAgent = new (require('https').Agent)({
        rejectUnauthorized: false
      });

      const response = await axios.post(endpoint, testData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        validateStatus: () => true,
        httpsAgent: httpsAgent
      });

      // Parse response
      const fields = response.data.split('|');
      const resultCode = fields[0] ? fields[0].trim() : '';
      
      // Any result (approved, declined, error) means the API is reachable and auth worked
      if (response.status === 200 && resultCode) {
        return {
          success: true,
          message: 'Credentials are valid and API is accessible'
        };
      }
      
      return {
        success: false,
        message: 'API responded but with unexpected format'
      };
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        return {
          success: false,
          message: 'Invalid API Key or Secret - Authentication failed',
          errorCode: 'AUTH_FAILED'
        };
      }

      if (error.code === 'ENOTFOUND') {
        return {
          success: false,
          message: 'Cannot reach BeyondBancard API. Please check your connection or endpoint configuration.',
          errorCode: 'ENDPOINT_NOT_FOUND'
        };
      }

      throw error;
    }
  } catch (error) {
    console.error('BeyondBancard credential test error:', error.message);
    
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
