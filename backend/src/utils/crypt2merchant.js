const axios = require('axios');

/**
 * Crypt2Merchant (crypt2merchant.net) gateway client.
 *
 * Docs: https://dashboard.crypt2merchant.net/docs
 *
 * Credentials stored on the merchant record:
 *   apiKey - the c2m_... key, sent in the X-Api-Key header
 *
 * This one does not take card details on our page. We create a session, send
 * the customer to Crypt2Merchant's hosted checkout, and the payment is
 * confirmed later by a callback. There is no status endpoint to ask, so the
 * callback is the only signal that a payment completed.
 */

const API_URL = 'https://api.crypt2merchant.net';
const CHECKOUT_URL = 'https://dashboard.crypt2merchant.net/checkout';
const MINIMUM_USD = 20;

function requestHeaders(credentials) {
  return {
    'X-Api-Key': String(credentials.apiKey || '').trim(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function parseBody(data) {
  if (typeof data !== 'string') return data || {};
  try {
    return JSON.parse(data);
  } catch {
    return { error: data.slice(0, 300) };
  }
}

/** Their errors are either a stable snake_case code or a plain message. */
function describeError(httpStatus, data) {
  if (data.message) return data.message;
  if (httpStatus === 401) return 'Crypt2Merchant rejected the API key';
  if (httpStatus === 429) return 'Crypt2Merchant is rate limiting this server, please try again shortly';
  if (httpStatus === 503) return 'Crypt2Merchant is provisioning deposit addresses, please try again in a minute';
  if (httpStatus === 502) return 'Crypt2Merchant payment provider is unavailable, please try again';
  return data.error || `Crypt2Merchant returned HTTP ${httpStatus}`;
}

/**
 * Creates a payment session and returns where to send the customer.
 * Shaped like the other clients' pending result so the pay route can treat
 * it the same way it treats a 3D Secure redirect.
 */
async function createCrypt2MerchantSession(credentials, paymentData) {
  try {
    if (!credentials || !credentials.apiKey) {
      return { success: false, error: 'Crypt2Merchant API key is required', errorCode: 'MISSING_CREDENTIALS' };
    }

    const currency = paymentData.currency || 'USD';
    if (currency !== 'USD') {
      return { success: false, error: 'Crypt2Merchant charges in USD only', errorCode: 'UNSUPPORTED_CURRENCY' };
    }

    const amount = Number(Number(paymentData.amount).toFixed(2));
    if (!Number.isFinite(amount) || amount < MINIMUM_USD) {
      return {
        success: false,
        error: `Crypt2Merchant needs at least $${MINIMUM_USD}.00 USD, this invoice is $${amount.toFixed(2)}`,
        errorCode: 'AMOUNT_BELOW_MINIMUM',
      };
    }

    const body = {
      amount_fiat: amount,
      currency: 'USD',
      order_id: paymentData.orderId,
      callback_url: paymentData.callbackUrl,
    };
    console.log(`🪙 Crypt2Merchant session: order ${body.order_id}, ${amount} USD`);

    const response = await axios.post(`${API_URL}/api/session`, body, {
      headers: requestHeaders(credentials),
      timeout: 30000,
      validateStatus: () => true,
    });
    const data = parseBody(response.data);

    if (response.status >= 200 && response.status < 300 && data.session_id) {
      const checkoutUrl = `${CHECKOUT_URL}?session_id=${encodeURIComponent(data.session_id)}&amount=${encodeURIComponent(data.amount_fiat || amount)}`;
      console.log(`🪙 Crypt2Merchant session ${data.session_id} created`);
      return {
        success: false, // not paid yet - the customer still has to pay on the hosted page
        pending: true,
        gatewayStatus: 'awaiting_payment',
        redirectUrl: checkoutUrl,
        sessionId: data.session_id,
        orderId: body.order_id,
        transactionId: null,
        depositAddress: data.deposit_address || null,
        amount: Number(data.amount_fiat || amount),
        message: 'Continue on the secure Crypt2Merchant payment page',
      };
    }

    console.error(`❌ Crypt2Merchant session failed: HTTP ${response.status}`, data);
    return {
      success: false,
      error: describeError(response.status, data),
      errorCode: data.error || `HTTP_${response.status}`,
    };
  } catch (error) {
    console.error('❌ Crypt2Merchant error:', error.message);
    return { success: false, error: error.message || 'Could not start the payment', errorCode: 'PAYMENT_ERROR' };
  }
}

/**
 * Checks the API key without creating a payment session, by calling the
 * currency converter. A 401 means the key is wrong.
 */
async function testCrypt2MerchantCredentials(credentials) {
  const response = await axios.get(`${API_URL}/api/currency/convert?amount=1&from=USD&to=USD`, {
    headers: requestHeaders(credentials),
    timeout: 20000,
    validateStatus: () => true,
  });
  if (response.status === 401 || response.status === 403) {
    return { success: false, message: 'Crypt2Merchant rejected this API key' };
  }
  if (response.status >= 200 && response.status < 300) {
    return { success: true, message: 'API key accepted by Crypt2Merchant' };
  }
  return { success: false, message: describeError(response.status, parseBody(response.data)) };
}

module.exports = { createCrypt2MerchantSession, testCrypt2MerchantCredentials, MINIMUM_USD, CHECKOUT_URL };
