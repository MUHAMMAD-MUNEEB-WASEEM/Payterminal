const axios = require('axios');

const NGENIUS_API_URL = process.env.NGENIUS_API_URL || 'https://api-gateway.sandbox.ngenius-payments.com';
const NGENIUS_API_KEY = process.env.NGENIUS_API_KEY;
const NGENIUS_OUTLET_REF = process.env.NGENIUS_OUTLET_REF;

// Step 1: Get access token
async function getAccessToken() {
  const response = await axios.post(
    `${NGENIUS_API_URL}/identity/auth/access-token`,
    {}, // No request body needed - authentication is via Authorization header only
    {
      headers: {
        Authorization: `Basic ${NGENIUS_API_KEY}`,
        'Content-Type': 'application/vnd.ni-identity.v1+json',
        Accept: 'application/vnd.ni-identity.v1+json',
      },
    }
  );
  return response.data.access_token;
}

// Step 2: Create payment order
async function createPaymentOrder({ amount, currency = 'USD', invoiceNumber, customerEmail, redirectUrl }) {
  const token = await getAccessToken();

  const amountInFils = Math.round(amount * 100); // Convert to smallest unit (fils)

  const payload = {
    action: 'SALE',
    amount: {
      currencyCode: currency,
      value: amountInFils,
    },
    merchantAttributes: {
      redirectUrl,
      cancelUrl: redirectUrl,
      skipConfirmationPage: false,
    },
    description: `Invoice ${invoiceNumber}`,
    merchantOrderReference: invoiceNumber,
  };

  if (customerEmail) payload.emailAddress = customerEmail;

  const response = await axios.post(
    `${NGENIUS_API_URL}/transactions/outlets/${NGENIUS_OUTLET_REF}/orders`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.ni-payment.v2+json',
        Accept: 'application/vnd.ni-payment.v2+json',
      },
    }
  );

  const order = response.data;
  const paymentLink = order._links?.payment?.href || null;

  return { orderRef: order.reference, paymentLink };
}

// Get order status
async function getOrderStatus(orderRef) {
  const token = await getAccessToken();
  const response = await axios.get(
    `${NGENIUS_API_URL}/transactions/outlets/${NGENIUS_OUTLET_REF}/orders/${orderRef}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.ni-payment.v2+json',
      },
    }
  );
  return response.data;
}

// Direct API: Process card payment
async function processDirectPayment({ amount, currency = 'USD', invoiceNumber, cardNumber, cardHolder, expiryMonth, expiryYear, cvv }) {
  const token = await getAccessToken();
  const amountInFils = Math.round(amount * 100);

  // Convert 4-digit year to 2-digit year (e.g., 2029 -> 29)
  const yearTwoDigit = expiryYear.length === 4 ? expiryYear.slice(-2) : expiryYear;

  const payload = {
    action: 'PURCHASE',
    amount: {
      currencyCode: currency,
      value: amountInFils,
    },
    merchantOrderReference: invoiceNumber,
    paymentMethod: {
      pan: cardNumber.replace(/\s/g, ''),
      cardholderName: cardHolder,
      expiry: `${yearTwoDigit}${expiryMonth.padStart(2, '0')}`, // Format: YYMM (e.g., "2902" for Feb 2029)
      cvv,
    },
  };

  console.log('N-Genius Direct Payment Request:', JSON.stringify(payload, null, 2));

  const response = await axios.post(
    `${NGENIUS_API_URL}/transactions/outlets/${NGENIUS_OUTLET_REF}/orders`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.ni-payment.v2+json',
        Accept: 'application/vnd.ni-payment.v2+json',
      },
    }
  );

  const order = response.data;
  const status = order._embedded?.payment?.[0]?.state || order.state;
  const redirect3DS = order._links?.['3ds:redirect']?.href || null;

  return {
    status,
    orderRef: order.reference,
    redirect3DS,
    raw: order,
  };
}

module.exports = { getAccessToken, createPaymentOrder, getOrderStatus, processDirectPayment };
