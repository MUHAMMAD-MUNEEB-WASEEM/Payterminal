const axios = require('axios');
const crypto = require('crypto');

/**
 * BrokerPay (brokerpay.net) gateway client.
 *
 * Docs: https://brokerpay.net/documentation/list
 *
 * Credentials stored on the merchant record:
 *   secretKey  - "API Key" / Secret Key from dashboard Settings, sent as a Bearer token
 *   aesKey     - base64 AES-256 key used to encrypt the transaction payload
 *   hmacKey    - base64 key used to sign the encrypted payload
 *   terminalId - optional, routes the charge through one specific connector
 *   mode       - 'sandbox' (default) or 'live'
 *   apiUsername - kept for reference only, the API does not use it
 *
 * Unlike the other gateways a charge is not always final when the call
 * returns: the bank may ask for 3D Secure (auth_url) or leave it pending.
 * Those come back as { pending: true } and are settled later from the
 * return URL, the webhook, or the checkout page polling the Status API.
 */

const BASE_URL = 'https://brokerpay.net/v1';

// API status code -> transaction.result.status, for responses without a transaction body
const CODE_TO_STATUS = {
  200: 'success',
  300: 'redirected',
  303: 'pending',
  304: 'to_be_confirm',
  400: 'failed',
  403: 'blocked',
};

const SUCCESS_STATUSES = ['success'];
const FAILED_STATUSES = ['failed', 'fail', 'blocked', 'canceled', 'abandoned'];
const IN_PROGRESS_STATUSES = ['redirected', 'pending', 'to_be_confirm'];

function environment(credentials) {
  return credentials.mode === 'live' ? 'live' : 'test';
}

function decodeKey(value, name) {
  const key = Buffer.from(String(value || '').trim(), 'base64');
  if (key.length !== 32) {
    throw new Error(`BrokerPay ${name} must be a base64 encoded 32-byte key`);
  }
  return key;
}

/** AES-256-CBC with a fresh IV, then HMAC-SHA256 over the base64 ciphertext. */
function encryptPayload(payload, aesKey, hmacKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', decodeKey(aesKey, 'AES key'), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]).toString('base64');
  const signature = crypto.createHmac('sha256', decodeKey(hmacKey, 'HMAC key')).update(encrypted).digest('hex');
  return { encrypted_data: encrypted, iv: iv.toString('hex'), signature };
}

function decryptPayload(body, aesKey) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', decodeKey(aesKey, 'AES key'), Buffer.from(body.iv, 'hex'));
  const decrypted = Buffer.concat([decipher.update(body.encrypted_data, 'base64'), decipher.final()]).toString('utf8');
  return JSON.parse(decrypted);
}

async function callApi(credentials, path, body) {
  const response = await axios.post(`${BASE_URL}/${environment(credentials)}/${path}`, body, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${String(credentials.secretKey || '').trim()}`,
    },
    timeout: 45000,
    validateStatus: () => true,
  });

  let data = response.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      data = { status: response.status, message: data.slice(0, 300) };
    }
  }
  // The docs only show plain JSON responses, but the AES key is described as
  // being for "encryption/decryption", so accept an encrypted reply too.
  if (data && data.encrypted_data && data.iv && credentials.aesKey) {
    data = decryptPayload(data, credentials.aesKey);
  }
  return { httpStatus: response.status, data: data || {} };
}

/**
 * Reduces any Transaction/Status/Webhook body to one of:
 *   paid | failed | in_progress | error
 */
function interpretTransaction(data) {
  const code = Number(data.status);
  const transaction = data.transaction || {};
  const resultStatus = String(transaction.result?.status || CODE_TO_STATUS[code] || '').toLowerCase();

  const details = {
    resultStatus,
    transactionId: transaction.transaction_id || null,
    orderId: transaction.order_id || null,
    amount: transaction.order?.amount !== undefined ? Number(transaction.order.amount) : null,
    currency: transaction.order?.currency || null,
    authUrl: data.auth_url || null,
    message: transaction.result?.message || data.message || '',
  };

  if (code === 401) {
    return { ...details, state: 'error', errorCode: 'INVALID_CREDENTIALS', message: data.message || 'Invalid Secret key' };
  }
  if (code === 402) {
    const errors = Object.values(data.errors || {}).flat().join(' ');
    return { ...details, state: 'error', errorCode: 'VALIDATION_ERROR', message: errors || data.message || 'Request validation error' };
  }
  if (code === 404) {
    return { ...details, state: 'error', errorCode: 'NOT_FOUND', message: 'Transaction not found' };
  }

  if (SUCCESS_STATUSES.includes(resultStatus)) return { ...details, state: 'paid' };
  if (FAILED_STATUSES.includes(resultStatus)) return { ...details, state: 'failed' };
  if (IN_PROGRESS_STATUSES.includes(resultStatus)) return { ...details, state: 'in_progress' };

  return { ...details, state: 'error', errorCode: 'UNKNOWN_RESPONSE', message: data.message || `Unexpected BrokerPay response (${code || 'no status'})` };
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') };
}

function buildTransactionPayload(credentials, paymentData) {
  const name = splitName(paymentData.cardHolder);
  const firstName = paymentData.firstName || name.first;
  const expiryYear = String(paymentData.expiryYear || '').trim();

  const payload = {
    first_name: firstName,
    last_name: paymentData.lastName || name.last || firstName,
    email: paymentData.email,
    currency: paymentData.currency || 'USD',
    amount: Number(Number(paymentData.amount).toFixed(2)),
    ip_address: paymentData.ipAddress,
    response_url: paymentData.responseUrl,
    order_id: paymentData.orderId || `${paymentData.invoiceNumber}-${Date.now().toString(36)}`,
    phone_number: String(paymentData.phone || '').replace(/[^\d+]/g, ''),
    zip: paymentData.postalCode,
    address: [paymentData.addressLine1, paymentData.addressLine2].filter(Boolean).join(', '),
    city: paymentData.city,
    state: paymentData.state,
    country: (paymentData.countryCode || 'US').toUpperCase(),
    card_number: String(paymentData.cardNumber || '').replace(/\D/g, ''),
    card_expiry_month: String(paymentData.expiryMonth || '').trim().padStart(2, '0'),
    card_expiry_year: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
    card_cvv: String(paymentData.cvv || '').trim(),
    terminal_id: credentials.terminalId,
    webhook_url: paymentData.webhookUrl,
  };

  // Optional fields are left out rather than sent empty.
  for (const key of ['state', 'terminal_id', 'webhook_url']) {
    if (!payload[key]) delete payload[key];
  }
  return payload;
}

/**
 * Same contract as the other gateway clients, plus a pending variant:
 *   { success: true, transactionId, message }
 *   { success: false, pending: true, redirectUrl, transactionId, orderId, gatewayStatus, message }
 *   { success: false, error, errorCode }
 */
async function processBrokerPayPayment(credentials, paymentData) {
  try {
    if (!credentials || !credentials.secretKey || !credentials.aesKey || !credentials.hmacKey) {
      return {
        success: false,
        error: 'BrokerPay Secret Key, AES Key and HMAC Key are all required',
        errorCode: 'MISSING_CREDENTIALS',
      };
    }

    const payload = buildTransactionPayload(credentials, paymentData);
    console.log(`🔷 BrokerPay ${environment(credentials)} transaction: order ${payload.order_id}, ${payload.amount} ${payload.currency}, card ending ${payload.card_number.slice(-4)}`);

    const { httpStatus, data } = await callApi(credentials, 'transaction', encryptPayload(payload, credentials.aesKey, credentials.hmacKey));
    const result = interpretTransaction(data);
    console.log(`🔷 BrokerPay response: http ${httpStatus}, status ${data.status}, result ${result.resultStatus}, tx ${result.transactionId}`);

    if (result.state === 'paid') {
      return {
        success: true,
        transactionId: result.transactionId,
        message: result.message || 'Payment processed successfully',
        reference: result.transactionId,
      };
    }

    if (result.state === 'in_progress') {
      return {
        success: false,
        pending: true,
        redirectUrl: result.authUrl,
        transactionId: result.transactionId,
        orderId: result.orderId || payload.order_id,
        gatewayStatus: result.resultStatus,
        message: result.message,
      };
    }

    if (result.state === 'failed') {
      return {
        success: false,
        error: 'Payment declined - ' + (result.message || result.resultStatus),
        errorCode: result.resultStatus === 'blocked' ? 'PAYMENT_BLOCKED' : 'PAYMENT_DECLINED',
        transactionId: result.transactionId,
      };
    }

    return { success: false, error: 'Payment error - ' + result.message, errorCode: result.errorCode };
  } catch (error) {
    console.error('❌ BrokerPay error:', error.message);
    return { success: false, error: error.message || 'Payment processing failed', errorCode: 'PAYMENT_ERROR' };
  }
}

/** Status API. Pass the BrokerPay transactionId when known; orderId otherwise. */
async function getBrokerPayTransaction(credentials, { transactionId, orderId }) {
  const body = transactionId ? { transaction_id: transactionId } : { order_id: orderId };
  const { data } = await callApi(credentials, 'get/transaction', body);
  return interpretTransaction(data);
}

/**
 * Checks the Secret Key without charging anything: looking up an order that
 * cannot exist answers 404 for a valid key and 401 for a bad one. It does
 * not exercise the AES/HMAC keys - only a real transaction does that.
 */
async function testBrokerPayCredentials(credentials) {
  const { data } = await callApi(credentials, 'get/transaction', { order_id: `credential-check-${Date.now()}` });
  const code = Number(data.status);
  if (code === 404 || code === 200) {
    return { success: true, message: `Secret Key accepted by BrokerPay (${environment(credentials)} environment)` };
  }
  return { success: false, message: data.message || `BrokerPay answered with status ${code}`, errorCode: code };
}

module.exports = {
  processBrokerPayPayment,
  getBrokerPayTransaction,
  testBrokerPayCredentials,
  encryptPayload,
  decryptPayload,
};
