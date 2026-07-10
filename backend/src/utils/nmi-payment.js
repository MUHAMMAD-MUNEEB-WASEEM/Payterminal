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
  fs.appendFileSync(path.join(logsDir, 'nmi-payment.log'), logMessage);
  console.log(message);
}

// NMI API endpoint
const NMI_ENDPOINT = 'https://secure.nmi.com/api/transact.php';

/**
 * Process payment with NMI (BeyondBancard)
 * @param {Object} credentials - Merchant credentials { security_key, mode }
 * @param {Object} paymentData - { amount, currency, cardNumber, cardHolder, expiryMonth, expiryYear, cvv, description }
 * @returns {Object} { success, transactionId, error }
 */
async function processNMIPayment(credentials, paymentData) {
  try {
    console.log('🚀 NMI payment processor started');
    logToFile('🚀 NMI payment processor started');
    
    const hasToken = !!paymentData.token;
    const hasCardData = !!paymentData.cardNumber;
    
    console.log('Input credentials:', { 
      hasCredentials: !!credentials, 
      hasSecurityKey: !!credentials?.security_key, 
      mode: credentials?.mode 
    });
    console.log('Input paymentData:', { 
      amount: paymentData.amount,
      hasToken: hasToken,
      hasCardNumber: hasCardData,
      cardHolder: paymentData.cardHolder,
      currency: paymentData.currency
    });
    
    // Validate credentials
    if (!credentials || !credentials.security_key) {
      console.error('❌ Missing NMI security_key');
      logToFile('❌ Missing NMI security_key');
      return {
        success: false,
        error: 'NMI security_key is required',
        errorCode: 'MISSING_CREDENTIALS'
      };
    }

    console.log('✅ Credentials present');
    logToFile('✅ Credentials present');
    
    // Handle tokenized payments (from Collect.js)
    if (paymentData.token) {
      console.log('🔷 Processing tokenized payment with NMI...');
      logToFile('🔷 Processing tokenized payment with NMI token');
      
      // Build NMI payment request using token
      const paymentRequest = {
        security_key: credentials.security_key,
        type: 'sale',
        payment_token: paymentData.token, // Token from NMI Collect.js
        amount: String(paymentData.amount), // Amount in dollars (NMI accepts decimal format)
        currency: paymentData.currency || 'USD',
        first_name: paymentData.firstName || paymentData.cardHolder.split(' ')[0] || paymentData.cardHolder,
        last_name: paymentData.lastName || paymentData.cardHolder.split(' ').slice(1).join(' ') || '',
        email: paymentData.email || '',
        address1: paymentData.addressLine1 || '',
        address2: paymentData.addressLine2 || '',
        city: paymentData.city || '',
        state: paymentData.state || '',
        zip: paymentData.postalCode || '',
        country: paymentData.countryCode || 'US',
        phone: paymentData.phone || '',
        order_id: `${paymentData.description}-${Date.now()}`, // Add timestamp to prevent duplicates
        order_description: paymentData.description
      };

      console.log('\n📤 SENDING TOKENIZED REQUEST TO NMI');
      console.log('Endpoint:', NMI_ENDPOINT);
      console.log('Amount:', paymentData.amount, 'USD');
      console.log('Token:', paymentData.token.substring(0, 15) + '...');
      console.log('Cardholder:', paymentData.cardHolder);
      
      logToFile('\n📤 SENDING TOKENIZED REQUEST');
      logToFile('Endpoint: ' + NMI_ENDPOINT);
      logToFile('Amount: ' + paymentData.amount + ' USD');
      logToFile('Token received from Collect.js');

      // Convert to URL-encoded form data
      const formData = new URLSearchParams();
      Object.entries(paymentRequest).forEach(([key, value]) => {
        formData.append(key, value);
      });

      console.log('Form data prepared');
      logToFile('Form data prepared');
      
      let response;
      
      try {
        console.log(`\n🔷 Posting to NMI...`);
        logToFile(`🔷 Posting to NMI...`);
        
        response = await axios.post(NMI_ENDPOINT, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000,
          validateStatus: () => true
        });

        console.log(`✅ Response received - Status ${response.status}`);
        logToFile(`✅ Response received - Status ${response.status}`);
        
      } catch (error) {
        console.error('❌ Request error:', error.message);
        logToFile('❌ Request error: ' + error.message);
        throw error;
      }

      // Parse response - NMI returns XML or query-string format
      const responseText = response.data || '';
      console.log('\n📥 Raw response:', responseText);
      logToFile('\n📥 Raw response: ' + responseText);
      
      // Try parsing as XML first (NMI can return XML)
      let resultCode, reasonText, transactionId, authCode;
      
      if (responseText.includes('<?xml')) {
        // Parse XML response
        const successMatch = responseText.match(/<response>(\d+)<\/response>/);
        const messageMatch = responseText.match(/<responsetext>(.+?)<\/responsetext>/);
        const tidMatch = responseText.match(/<transactionid>(.+?)<\/transactionid>/);
        const authMatch = responseText.match(/<authcode>(.+?)<\/authcode>/);
        
        resultCode = successMatch ? successMatch[1] : '';
        reasonText = messageMatch ? messageMatch[1] : '';
        transactionId = tidMatch ? tidMatch[1] : '';
        authCode = authMatch ? authMatch[1] : '';
      } else {
        // Parse query-string format
        const params = new URLSearchParams(responseText);
        resultCode = params.get('response') || '';
        reasonText = params.get('responsetext') || '';
        transactionId = params.get('transactionid') || '';
        authCode = params.get('authcode') || '';
      }
      
      console.log('Response parsed:', {
        resultCode,
        reasonText,
        transactionId,
        authCode
      });
      logToFile('Response parsed: resultCode=' + resultCode + ', reasonText=' + reasonText);
      
      // Check result
      if (resultCode === '1') {
        console.log('✅ Payment successful! Transaction ID:', transactionId);
        logToFile('✅ PAYMENT SUCCESSFUL');
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
        
        return {
          success: false,
          error: 'Payment error - ' + errorMsg,
          errorCode: 'PAYMENT_ERROR'
        };
      }
      
      console.error('❌ Unknown result code:', resultCode);
      logToFile('❌ Unknown result code: ' + resultCode);
      
      return {
        success: false,
        error: 'Unknown payment response - ' + (reasonText || 'Please contact support'),
        errorCode: 'UNKNOWN_RESPONSE'
      };
    }
    
    // Fallback: Handle raw card data
    if (paymentData.cardNumber) {
      console.log('📝 Processing raw card data (fallback)...');
      logToFile('📝 Processing raw card data');
      
      const cardNumber = paymentData.cardNumber.replace(/\s/g, '');
      const cvv = String(paymentData.cvv).trim();
      const expiryMonth = String(paymentData.expiryMonth).padStart(2, '0');
      const expiryYear = String(paymentData.expiryYear);
      
      // Build NMI payment request with raw card
      const paymentRequest = {
        security_key: credentials.security_key,
        type: 'sale',
        ccnumber: cardNumber,
        ccexp: `${expiryMonth}${expiryYear}`,
        cvv: cvv,
        amount: String(paymentData.amount), // Amount in dollars (NMI accepts decimal format)
        currency: paymentData.currency || 'USD',
        first_name: paymentData.firstName || paymentData.cardHolder.split(' ')[0] || paymentData.cardHolder,
        last_name: paymentData.lastName || paymentData.cardHolder.split(' ').slice(1).join(' ') || '',
        email: paymentData.email || '',
        address1: paymentData.addressLine1 || '',
        address2: paymentData.addressLine2 || '',
        city: paymentData.city || '',
        state: paymentData.state || '',
        zip: paymentData.postalCode || '',
        country: paymentData.countryCode || 'US',
        phone: paymentData.phone || '',
        order_id: `${paymentData.description}-${Date.now()}`, // Add timestamp to prevent duplicates
        order_description: paymentData.description
      };

      console.log('\n📤 SENDING RAW CARD REQUEST TO NMI');
      console.log('Card last 4:', cardNumber.slice(-4));
      
      const formData = new URLSearchParams();
      Object.entries(paymentRequest).forEach(([key, value]) => {
        formData.append(key, value);
      });

      let response;
      
      try {
        response = await axios.post(NMI_ENDPOINT, formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000,
          validateStatus: () => true
        });
      } catch (error) {
        console.error('❌ Request error:', error.message);
        logToFile('❌ Request error: ' + error.message);
        throw error;
      }

      const responseText = response.data || '';
      console.log('\n📥 Raw response:', responseText);
      logToFile('\n📥 Raw response: ' + responseText);
      
      // Parse response
      let resultCode, reasonText, transactionId, authCode;
      
      if (responseText.includes('<?xml')) {
        const successMatch = responseText.match(/<response>(\d+)<\/response>/);
        const messageMatch = responseText.match(/<responsetext>(.+?)<\/responsetext>/);
        const tidMatch = responseText.match(/<transactionid>(.+?)<\/transactionid>/);
        
        resultCode = successMatch ? successMatch[1] : '';
        reasonText = messageMatch ? messageMatch[1] : '';
        transactionId = tidMatch ? tidMatch[1] : '';
      } else {
        const params = new URLSearchParams(responseText);
        resultCode = params.get('response') || '';
        reasonText = params.get('responsetext') || '';
        transactionId = params.get('transactionid') || '';
      }
      
      if (resultCode === '1') {
        console.log('✅ Payment successful! Transaction ID:', transactionId);
        logToFile('✅ PAYMENT SUCCESSFUL');
        
        return {
          success: true,
          transactionId: transactionId,
          message: 'Payment processed successfully',
          reference: transactionId
        };
      }
      
      if (resultCode === '2') {
        return {
          success: false,
          error: 'Payment declined - ' + reasonText,
          errorCode: 'PAYMENT_DECLINED'
        };
      }
      
      return {
        success: false,
        error: 'Payment error - ' + reasonText,
        errorCode: 'PAYMENT_ERROR'
      };
    }
    
    return {
      success: false,
      error: 'No payment data provided',
      errorCode: 'NO_PAYMENT_DATA'
    };
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    logToFile('\n❌ ERROR: ' + error.message);
    
    return {
      success: false,
      error: error.message || 'Payment processing failed',
      errorCode: 'PAYMENT_ERROR'
    };
  }
}

module.exports = { processNMIPayment };
