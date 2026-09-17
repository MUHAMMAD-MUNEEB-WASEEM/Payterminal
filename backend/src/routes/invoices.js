const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const { auth, adminOnly, adminOrCompliance } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { createPaymentOrder, getOrderStatus } = require('../utils/ngenius');

// Populate brand info into invoice
async function withBrand(invoice) {
  if (!invoice) return null;
  const brand = invoice.brandId ? await db.brands.findOne({ _id: invoice.brandId }) : null;
  return { ...invoice, brand: brand || null };
}

// BrokerPay results that are neither paid nor failed yet
const GATEWAY_WAITING = ['pending', 'to_be_confirm'];

// Single client IP; trust proxy is set, so req.ip is the visitor behind Render
function customerIp(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return ip === '::1' ? '127.0.0.1' : ip;
}

// Public base URL of this API, for gateway return and webhook URLs
function publicApiBase(req) {
  return (process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

function buildBillingDetails(req, body, gateway) {
  const { cardNumber, cardHolder, expiryMonth, expiryYear } = body;
  const userAgent = req.headers['user-agent'] || 'Unknown';
  return {
    firstName: body.firstName,
    lastName: body.lastName,
    companyName: body.companyName,
    addressLine1: body.addressLine1,
    addressLine2: body.addressLine2,
    city: body.city,
    state: body.state,
    postalCode: body.postalCode,
    countryCode: body.countryCode,
    phone: body.phone,
    cardholderName: cardHolder,
    cardLast4: cardNumber ? cardNumber.slice(-4) : null,
    cardExpiry: expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : null,
    paymentGateway: gateway,
    // Payment metadata
    paymentTimestamp: new Date().toISOString(),
    clientIp: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown',
    userAgent,
    deviceFingerprint: userAgent // Simple fingerprint using user agent
  };
}

/**
 * Marks an invoice paid and adds it to the merchant's processed volume.
 * Only the first caller wins, so a BrokerPay return, webhook and status poll
 * arriving together cannot count the same payment twice.
 */
async function markInvoicePaid({ invoice, merchantId, transactionId, billingDetails }) {
  const updated = await db.invoices.update(
    { _id: invoice._id, status: { $ne: 'paid' } },
    {
      $set: {
        status: 'paid',
        paymentOrderRef: transactionId,
        selectedMerchantId: merchantId,
        billingDetails,
        updatedAt: new Date().toISOString()
      },
      $unset: { pendingBillingDetails: true, gatewayStatus: true, gatewayMessage: true }
    }
  );
  if (!updated) return false;

  const freshMerchant = await db.merchants.findOne({ _id: merchantId });
  if (!freshMerchant) return true;

  const newProcessedAmount = (freshMerchant.processedAmount || 0) + invoice.total;
  await db.merchants.update(
    { _id: merchantId },
    { $set: { processedAmount: newProcessedAmount, updatedAt: new Date().toISOString() } }
  );
  console.log(`Merchant amount updated: ${freshMerchant.processedAmount || 0} -> ${newProcessedAmount}`);

  // Check if limit reached and notify
  if (freshMerchant.amountLimit && newProcessedAmount >= freshMerchant.amountLimit) {
    await db.notifications.insert({
      type: 'merchant_limit_reached',
      merchantId: freshMerchant._id,
      merchantNickname: freshMerchant.nickname,
      amountLimit: freshMerchant.amountLimit,
      processedAmount: newProcessedAmount,
      message: `Merchant "${freshMerchant.nickname}" has reached its amount limit of $${freshMerchant.amountLimit.toFixed(2)}`,
      read: false,
      createdAt: new Date().toISOString(),
    });
    console.log('Notification created for limit reached');
  }
  return true;
}

async function brandRedirect(invoice) {
  const brand = invoice.brandId ? await db.brands.findOne({ _id: invoice.brandId }) : null;
  return {
    redirectUrl: (brand && brand.enableRedirect && brand.redirectUrl) ? brand.redirectUrl : null,
    enableRedirect: (brand && brand.enableRedirect) ? true : false,
    brand: brand ? { name: brand.name, redirectUrl: brand.redirectUrl, enableRedirect: brand.enableRedirect } : null
  };
}

/**
 * Settles a BrokerPay payment that was left pending or sent to 3D Secure,
 * using the Status API as the source of truth (webhooks are not signed).
 * Returns { status: 'paid' | 'failed' | 'processing' | <unchanged>, message }.
 */
async function syncBrokerPayInvoice(invoiceId) {
  const invoice = await db.invoices.findOne({ _id: invoiceId });
  if (!invoice) return { status: 'not_found' };
  if (invoice.status === 'paid') return { status: 'paid' };
  if (!invoice.gatewayOrderId && !invoice.paymentOrderRef) return { status: invoice.status };

  const merchant = invoice.selectedMerchantId ? await db.merchants.findOne({ _id: invoice.selectedMerchantId }) : null;
  if (!merchant || merchant.gateway !== 'brokerpay') return { status: invoice.status };

  const { getBrokerPayTransaction } = require('../utils/brokerpay');
  const tx = await getBrokerPayTransaction(merchant.credentials, {
    transactionId: invoice.paymentOrderRef,
    orderId: invoice.gatewayOrderId
  });
  console.log(`BrokerPay sync ${invoice.invoiceNumber}: ${tx.state} (${tx.resultStatus || tx.errorCode}) ${tx.message || ''}`);

  if (tx.state === 'paid') {
    if (tx.amount !== null && Math.abs(tx.amount - invoice.total) > 0.01) {
      console.error(`❌ BrokerPay amount mismatch on ${invoice.invoiceNumber}: paid ${tx.amount}, invoice ${invoice.total}`);
      await db.invoices.update({ _id: invoice._id }, { $set: { gatewayStatus: 'amount_mismatch', gatewayMessage: `Gateway reports ${tx.amount} ${tx.currency || ''}`, updatedAt: new Date().toISOString() } });
      return { status: 'processing', message: 'Payment needs manual review' };
    }
    await markInvoicePaid({
      invoice,
      merchantId: merchant._id,
      transactionId: tx.transactionId || invoice.paymentOrderRef,
      billingDetails: invoice.pendingBillingDetails || { paymentGateway: 'brokerpay' }
    });
    return { status: 'paid' };
  }

  if (tx.state === 'failed') {
    await db.invoices.update(
      { _id: invoice._id, status: { $ne: 'paid' } },
      { $set: { status: 'failed', gatewayStatus: tx.resultStatus, gatewayMessage: tx.message, updatedAt: new Date().toISOString() } }
    );
    return { status: 'failed', message: tx.message || 'Payment was not completed' };
  }

  if (tx.state === 'in_progress') {
    await db.invoices.update({ _id: invoice._id }, { $set: { gatewayStatus: tx.resultStatus, updatedAt: new Date().toISOString() } });
    return { status: 'processing', message: tx.message };
  }

  // Lookup failed (network, 401, 404) - leave the invoice as it is and try again later
  return { status: GATEWAY_WAITING.includes(invoice.gatewayStatus) ? 'processing' : invoice.status, message: tx.message };
}

// Customers poll while a payment is pending; don't forward every poll to BrokerPay
const lastBrokerPaySync = new Map();
function syncThrottled(invoiceId) {
  const now = Date.now();
  if (now - (lastBrokerPaySync.get(invoiceId) || 0) < 3000) return true;
  lastBrokerPaySync.set(invoiceId, now);
  return false;
}

// Get all invoices (filtered by user for non-admins, show all for compliance)
router.get('/', auth, async (req, res) => {
  try {
    // Admin and compliance can see all invoices
    const query = (req.user.role === 'admin' || req.user.role === 'compliance') 
      ? {} 
      : { createdBy: req.user._id };
    const invoices = await db.invoices.find(query, { createdAt: -1 });
    const populated = await Promise.all(invoices.map(withBrand));
    res.json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Database Query Search - Returns specific fields only (admin/compliance only)
router.get('/db-search', auth, adminOrCompliance, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      return res.json([]);
    }
    
    const searchTerm = q.toLowerCase();
    
    // Search across multiple fields
    const allInvoices = await db.invoices.find({});
    
    const matches = allInvoices.filter(inv => {
      return (
        (inv.invoiceNumber?.toLowerCase() || '').includes(searchTerm) ||
        (inv.customerName?.toLowerCase() || '').includes(searchTerm) ||
        (inv.customerEmail?.toLowerCase() || '').includes(searchTerm) ||
        (inv.customerSerialNumber?.toLowerCase() || '').includes(searchTerm) ||
        (inv.paymentOrderRef?.toLowerCase() || '').includes(searchTerm) ||
        (inv.billingDetails?.clientIp?.toLowerCase() || '').includes(searchTerm) ||
        (inv.billingDetails?.deviceFingerprint?.toLowerCase() || '').includes(searchTerm) ||
        (inv.billingDetails?.userAgent?.toLowerCase() || '').includes(searchTerm)
      );
    });
    
    // Return ONLY specific fields (no merchant name, no brand name)
    const results = matches.map(inv => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      transactionId: inv.paymentOrderRef || null,
      email: inv.customerEmail,
      customerName: inv.customerName,
      customerSerialNumber: inv.customerSerialNumber,
      ipAddress: inv.billingDetails?.clientIp || null,
      deviceFingerprint: inv.billingDetails?.deviceFingerprint || null,
      userAgent: inv.billingDetails?.userAgent || null,
      paymentTimestamp: inv.billingDetails?.paymentTimestamp || null,
      createdAt: inv.createdAt,
      status: inv.status,
      total: inv.total,
      // Billing details
      cardLast4: inv.billingDetails?.cardLast4 || null,
      cardExpiry: inv.billingDetails?.cardExpiry || null,
      paymentGateway: inv.billingDetails?.paymentGateway || null,
      phone: inv.billingDetails?.phone || null,
      // Address
      addressLine1: inv.billingDetails?.addressLine1 || null,
      city: inv.billingDetails?.city || null,
      state: inv.billingDetails?.state || null,
      postalCode: inv.billingDetails?.postalCode || null,
      countryCode: inv.billingDetails?.countryCode || null
    }));
    
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public invoice view (no auth required)
router.get('/public/:id', async (req, res) => {
  console.log('PUBLIC INVOICE ROUTE HIT - ID:', req.params.id);
  try {
    let invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    // Record link open time if not already recorded
    if (!invoice.linkOpenedAt) {
      const now = new Date().toISOString();
      
      // Update the invoice
      await db.invoices.update(
        { _id: req.params.id },
        { $set: { linkOpenedAt: now } },
        {}
      );
      
      // Fetch updated invoice to confirm
      invoice = await db.invoices.findOne({ _id: req.params.id });
    }
    
    res.json(await withBrand(invoice));
  } catch (err) {
    console.error('Error in public invoice view:', err);
    res.status(500).json({ message: err.message });
  }
});

// Verify customer details (no auth required)
router.post('/public/:id/verify', async (req, res) => {
  try {
    const { customerName, customerEmail, customerSerialNumber } = req.body;
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    // Check if details match
    const nameMatch = invoice.customerName.toLowerCase().trim() === customerName.toLowerCase().trim();
    const emailMatch = invoice.customerEmail.toLowerCase().trim() === customerEmail.toLowerCase().trim();
    const serialMatch = invoice.customerSerialNumber.toLowerCase().trim() === customerSerialNumber.toLowerCase().trim();
    
    if (nameMatch && emailMatch && serialMatch) {
      // Mark as verified
      await db.invoices.update(
        { _id: invoice._id },
        { $set: { customerVerified: true, updatedAt: new Date().toISOString() } }
      );
      
      // Get available merchants for this brand (ordered and filtered by limit)
      const brandMerchants = await db.brandMerchants.find({ brandId: invoice.brandId });
      
      // Sort by creation order to maintain priority
      brandMerchants.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      const merchants = [];
      for (const bm of brandMerchants) {
        const merchant = await db.merchants.findOne({ _id: bm.merchantId, isActive: true });
        if (merchant) {
          // Check if merchant has reached limit
          const hasLimit = merchant.amountLimit && merchant.amountLimit > 0;
          const limitReached = hasLimit && (merchant.processedAmount || 0) >= merchant.amountLimit;
          
          // Only include merchants that haven't reached their limit
          if (!limitReached) {
            merchants.push({
              _id: merchant._id,
              nickname: merchant.nickname,
              gateway: merchant.gateway,
              isDefault: bm.isDefault || false,
            });
          }
        }
      }
      
      res.json({ 
        verified: true, 
        message: 'Customer verified successfully',
        merchants 
      });
    } else {
      res.status(400).json({ 
        verified: false, 
        message: 'Customer details do not match. Please check your information.' 
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Helper function for payment logging
function createPaymentLogger() {
  const fs = require('fs');
  const path = require('path');
  
  // Create logs directory
  const logsDir = path.join(__dirname, '../..', 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  return function logToFile(msg) {
    const timestamp = new Date().toISOString();
    try {
      fs.appendFileSync(path.join(logsDir, 'payment-route.log'), `[${timestamp}] ${msg}\n`);
      console.log(msg);
    } catch (e) {
      console.error('Failed to log to file:', e.message);
      console.log(msg); // at least log to console
    }
  };
}

// PayPal Direct Checkout completion endpoint (no auth required)
router.post('/public/:id/paypal-complete', async (req, res) => {
  try {
    console.log('\n========== PAYPAL COMPLETION REQUEST ==========');
    const { orderId, payerId, captureId, payerEmail, payerName } = req.body;
    
    console.log('PayPal Order ID:', orderId);
    console.log('Payer ID:', payerId);
    console.log('Capture ID:', captureId);
    console.log('Payer Email:', payerEmail);
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      console.log('ERROR: Invoice not found');
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status === 'paid') {
      console.log('WARNING: Invoice already paid');
      return res.status(400).json({ message: 'Invoice already paid' });
    }
    
    if (!invoice.customerVerified) {
      console.log('ERROR: Customer not verified');
      return res.status(400).json({ message: 'Customer verification required' });
    }
    
    // Get PayPal merchant for this brand
    const brandMerchants = await db.brandMerchants.find({ brandId: invoice.brandId });
    let paypalMerchant = null;
    
    for (const bm of brandMerchants) {
      const merchant = await db.merchants.findOne({ _id: bm.merchantId, gateway: 'paypal', isActive: true });
      if (merchant) {
        paypalMerchant = merchant;
        break;
      }
    }
    
    if (!paypalMerchant) {
      console.log('ERROR: PayPal merchant not found');
      return res.status(404).json({ message: 'PayPal payment method not available' });
    }
    
    console.log('PayPal Merchant:', paypalMerchant.nickname);
    
    // Verify the payment with PayPal API (optional but recommended)
    try {
      const axios = require('axios');
      const apiEndpoint = paypalMerchant.credentials.mode === 'live'
        ? 'https://api.paypal.com'
        : 'https://api.sandbox.paypal.com';
      
      // Get access token
      const tokenResponse = await axios.post(
        `${apiEndpoint}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          auth: {
            username: paypalMerchant.credentials.clientId,
            password: paypalMerchant.credentials.clientSecret
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      const accessToken = tokenResponse.data.access_token;
      
      // Verify the order
      const orderResponse = await axios.get(
        `${apiEndpoint}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const orderData = orderResponse.data;
      console.log('PayPal Order Status:', orderData.status);
      
      // Verify order is completed
      if (orderData.status !== 'COMPLETED') {
        console.log('ERROR: Order not completed, status:', orderData.status);
        return res.status(400).json({ 
          message: 'Payment not completed',
          status: orderData.status
        });
      }
      
      // Verify amount matches
      const paidAmount = parseFloat(orderData.purchase_units[0].amount.value);
      const expectedAmount = parseFloat(invoice.total.toFixed(2));
      
      if (Math.abs(paidAmount - expectedAmount) > 0.01) {
        console.log('ERROR: Amount mismatch', { paidAmount, expectedAmount });
        return res.status(400).json({ 
          message: 'Payment amount mismatch',
          paid: paidAmount,
          expected: expectedAmount
        });
      }
      
      console.log('✅ Payment verified with PayPal');
      
    } catch (verifyErr) {
      console.error('PayPal verification error:', verifyErr.message);
      // Continue anyway if verification fails (order already captured)
      console.log('⚠️ Proceeding without verification');
    }
    
    // Update merchant processed amount
    const newProcessedAmount = (paypalMerchant.processedAmount || 0) + invoice.total;
    await db.merchants.update(
      { _id: paypalMerchant._id },
      { $set: { processedAmount: newProcessedAmount, updatedAt: new Date().toISOString() } }
    );
    
    console.log(`Merchant amount updated: ${paypalMerchant.processedAmount || 0} -> ${newProcessedAmount}`);
    
    // Check if limit reached and notify
    if (paypalMerchant.amountLimit && newProcessedAmount >= paypalMerchant.amountLimit) {
      await db.notifications.insert({
        type: 'merchant_limit_reached',
        merchantId: paypalMerchant._id,
        merchantNickname: paypalMerchant.nickname,
        amountLimit: paypalMerchant.amountLimit,
        processedAmount: newProcessedAmount,
        message: `Merchant "${paypalMerchant.nickname}" has reached its amount limit of $${paypalMerchant.amountLimit.toFixed(2)}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      console.log('Notification created for limit reached');
    }
    
    // Capture client metadata
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const paymentTimestamp = new Date().toISOString();
    
    // Update invoice status
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          status: 'paid', 
          paymentOrderRef: captureId || orderId,
          selectedMerchantId: paypalMerchant._id,
          billingDetails: {
            payerEmail: payerEmail,
            payerName: payerName ? `${payerName.given_name || ''} ${payerName.surname || ''}`.trim() : null,
            payerId: payerId,
            paymentGateway: 'paypal',
            paymentMethod: 'paypal_direct',
            paymentTimestamp,
            clientIp,
            userAgent,
            deviceFingerprint: userAgent
          },
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    console.log(`Invoice ${invoice.invoiceNumber} marked as paid via PayPal`);
    
    // Fetch brand info for redirect
    const brand = invoice.brandId ? await db.brands.findOne({ _id: invoice.brandId }) : null;
    
    const response = {
      status: 'paid',
      message: 'Payment completed successfully via PayPal',
      transactionId: captureId || orderId,
      redirectUrl: (brand && brand.enableRedirect && brand.redirectUrl) ? brand.redirectUrl : null,
      enableRedirect: (brand && brand.enableRedirect) ? true : false
    };
    
    console.log('Sending success response:', response);
    console.log('========== PAYPAL COMPLETION COMPLETE ==========\n');
    
    res.json(response);
    
  } catch (err) {
    console.error('\n❌ PAYPAL COMPLETION ERROR:', err.message);
    console.error('Stack:', err.stack);
    
    res.status(500).json({ 
      status: 'error',
      message: err.message || 'PayPal payment completion failed'
    });
  }
});

// Public payment endpoint (no auth required)
router.post('/public/:id/pay', async (req, res) => {
  const logToFile = createPaymentLogger();
  
  try {
    console.log('\n========== PAYMENT REQUEST RECEIVED ==========');
    logToFile('\n========== PAYMENT REQUEST RECEIVED ==========');
    
    // Get request data
    const { 
      cardNumber, 
      cardHolder, 
      expiryMonth, 
      expiryYear, 
      cvv, 
      merchantId,
      stripeToken, // NEW: Stripe token from Stripe.js
      firstName,
      lastName,
      companyName,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      countryCode,
      phone
    } = req.body;
    
    console.log('Request data received:', {
      hasCardNumber: !!cardNumber,
      hasStripeToken: !!stripeToken,
      cardHolder,
      expiryMonth,
      expiryYear,
      hasCvv: !!cvv,
      merchantId,
      firstName,
      lastName,
      companyName,
      city,
      state,
      postalCode,
      countryCode,
      phone
    });
    logToFile(`Request: cardHolder=${cardHolder}, firstName=${firstName}, lastName=${lastName}, city=${city}, phone=${phone}, merchantId=${merchantId}, stripeToken=${stripeToken ? 'present' : 'none'}`);
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    console.log(`Invoice lookup: found=${!!invoice}, id=${req.params.id}`);
    logToFile(`Invoice lookup: found=${!!invoice}, id=${req.params.id}`);
    
    if (!invoice) {
      console.log('ERROR: Invoice not found');
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status === 'paid') {
      console.log('ERROR: Invoice already paid');
      return res.status(400).json({ message: 'Invoice already paid' });
    }
    
    if (!invoice.customerVerified) {
      console.log('ERROR: Customer not verified');
      return res.status(400).json({ message: 'Customer verification required' });
    }

    // A BrokerPay charge still waiting on the bank must settle before another attempt
    if (GATEWAY_WAITING.includes(invoice.gatewayStatus)) {
      const synced = await syncBrokerPayInvoice(invoice._id).catch(() => ({ status: 'processing' }));
      if (synced.status === 'paid') return res.status(400).json({ message: 'Invoice already paid' });
      if (synced.status === 'processing') {
        return res.status(409).json({ status: 'processing', message: 'A payment for this invoice is still being confirmed by the bank' });
      }
    }

    // Validate merchant
    if (!merchantId) {
      console.log('ERROR: No merchantId provided');
      return res.status(400).json({ message: 'Payment method is required' });
    }
    
    const merchant = await db.merchants.findOne({ _id: merchantId });
    console.log(`Merchant lookup: found=${!!merchant}, gateway=${merchant?.gateway}`);
    logToFile(`Merchant lookup: found=${!!merchant}, gateway=${merchant?.gateway}`);
    
    if (!merchant) {
      console.log('ERROR: Merchant not found');
      return res.status(404).json({ message: 'Payment method not found' });
    }
    
    if (!merchant.isActive) {
      console.log('ERROR: Merchant not active');
      return res.status(400).json({ message: 'Payment method is not active' });
    }

    // Prepare payment data
    const paymentData = {
      amount: invoice.total,
      currency: 'USD',
      cardNumber,
      cardHolder,
      expiryMonth: String(expiryMonth),
      expiryYear: String(expiryYear),
      cvv,
      stripeToken, // NEW: Include Stripe token
      description: `Invoice ${invoice.invoiceNumber}`,
      invoiceNumber: invoice.invoiceNumber,
      firstName,
      lastName,
      email: invoice.customerEmail,
      companyName,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      countryCode: countryCode || 'US',
      phone: phone || '',
    };
    
    console.log('Payment data prepared:', {
      amount: paymentData.amount,
      currency: paymentData.currency,
      cardLast4: cardNumber ? cardNumber.slice(-4) : 'MISSING',
      gateway: merchant.gateway
    });

    let result;

    // Process payment based on gateway
    console.log(`\n>>> Processing payment via ${merchant.gateway} gateway...`);
    logToFile(`\n>>> Processing payment via ${merchant.gateway} gateway...`);
    
    try {
      switch (merchant.gateway) {
        case 'stripe': {
          const { processStripePayment } = require('../utils/stripe');
          result = await processStripePayment(merchant.credentials, paymentData);
          break;
        }
        case 'paypal': {
          const { processPayPalPayment } = require('../utils/paypal');
          result = await processPayPalPayment(merchant.credentials, paymentData);
          break;
        }
        case 'authorize': {
          const { processAuthorizePayment } = require('../utils/authorize');
          result = await processAuthorizePayment(merchant.credentials, paymentData);
          break;
        }
        case 'beyondbancard': {
          console.log('🔷 Calling NMI payment processor...');
          logToFile('🔷 Calling NMI payment processor...');
          const { processNMIPayment } = require('../utils/nmi-payment');
          result = await processNMIPayment(merchant.credentials, paymentData);
          console.log('🔷 NMI processor returned:', JSON.stringify(result, null, 2));
          logToFile('🔷 NMI processor returned: ' + JSON.stringify(result, null, 2));
          break;
        }
        case 'crypt2merchant': {
          // Hosted checkout: no card details here, the customer pays on their page
          const { createCrypt2MerchantSession } = require('../utils/crypt2merchant');
          const apiBase = publicApiBase(req);
          // Their callback is not signed, so the URL carries a secret only we and
          // Crypt2Merchant know. It is checked before anything is marked paid.
          const callbackToken = crypto.randomBytes(24).toString('hex');
          paymentData.orderId = invoice.invoiceNumber;
          paymentData.callbackUrl = `${apiBase}/api/invoices/public/${invoice._id}/crypt2merchant/callback?token=${callbackToken}`;
          result = await createCrypt2MerchantSession(merchant.credentials, paymentData);
          if (result.pending) result.callbackToken = callbackToken;
          logToFile('🪙 Crypt2Merchant returned: ' + JSON.stringify(result));
          break;
        }
        case 'brokerpay': {
          const { processBrokerPayPayment } = require('../utils/brokerpay');
          const apiBase = publicApiBase(req);
          paymentData.orderId = `${invoice.invoiceNumber}-${Date.now().toString(36)}`;
          paymentData.ipAddress = customerIp(req);
          paymentData.responseUrl = `${apiBase}/api/invoices/public/${invoice._id}/brokerpay/return`;
          paymentData.webhookUrl = `${apiBase}/api/invoices/public/${invoice._id}/brokerpay/webhook`;
          result = await processBrokerPayPayment(merchant.credentials, paymentData);
          logToFile('🔷 BrokerPay processor returned: ' + JSON.stringify(result));
          break;
        }
        default:
          console.log(`ERROR: Unsupported gateway: ${merchant.gateway}`);
          return res.status(400).json({ message: 'Unsupported payment gateway: ' + merchant.gateway });
      }
    } catch (processorErr) {
      console.error('❌ ERROR in payment processor call:', processorErr.message);
      console.error('Stack:', processorErr.stack);
      logToFile('❌ ERROR in processor: ' + processorErr.message);
      throw processorErr;
    }
    
    if (!result) {
      console.error('❌ Payment processor returned null/undefined result');
      logToFile('❌ Processor returned null');
      return res.status(500).json({ 
        message: 'Payment processor error - no response',
        error: 'Payment processor failed to return result'
      });
    }
    
    console.log('\n>>> Payment processor result:', JSON.stringify(result, null, 2));
    logToFile('\n>>> Processor result: ' + JSON.stringify(result, null, 2));

    // BrokerPay 3D Secure or bank confirmation: settled later by return URL, webhook or polling
    if (result.pending) {
      await db.invoices.update(
        { _id: invoice._id },
        {
          $set: {
            status: 'pending',
            selectedMerchantId: merchantId,
            paymentOrderRef: result.transactionId,
            gatewayOrderId: result.orderId,
            gatewayStatus: result.gatewayStatus,
            gatewayMessage: result.message || null,
            ...(result.sessionId ? { gatewaySessionId: result.sessionId } : {}),
            ...(result.callbackToken ? { gatewayCallbackToken: result.callbackToken } : {}),
            gatewayReturnUrl: `${(req.get('origin') || process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/pay/${invoice._id}?payment=return`,
            pendingBillingDetails: buildBillingDetails(req, req.body, merchant.gateway),
            updatedAt: new Date().toISOString()
          }
        }
      );

      const response = {
        status: 'processing',
        message: result.message || 'Payment is being confirmed',
        transactionId: result.transactionId,
        redirect3DS: result.redirectUrl || undefined
      };
      logToFile('PENDING RESPONSE: ' + JSON.stringify(response));
      return res.json(response);
    }

    if (result.success) {
      console.log('✅ Payment successful! Processing invoice update...');
      logToFile('✅ PAYMENT SUCCESSFUL');

      await markInvoicePaid({
        invoice,
        merchantId,
        transactionId: result.transactionId,
        billingDetails: buildBillingDetails(req, req.body, merchant.gateway)
      });

      console.log(`Invoice ${invoice.invoiceNumber} marked as paid`);

      const response = {
        status: 'paid',
        message: result.message || 'Payment successful',
        transactionId: result.transactionId,
        ...(await brandRedirect(invoice))
      };

      console.log('Sending success response:', response);
      logToFile('SUCCESS RESPONSE: ' + JSON.stringify(response, null, 2));
      res.json(response);
    } else {
      // Payment failed
      console.log('❌ Payment failed:', result.error);
      logToFile('❌ PAYMENT FAILED: ' + result.error);
      
      // Update invoice status to failed
      await db.invoices.update(
        { _id: invoice._id },
        { 
          $set: { 
            status: 'failed',
            updatedAt: new Date().toISOString()
          } 
        }
      );
      
      const errorResponse = {
        status: 'failed',
        message: result.error || 'Payment failed',
        errorCode: result.errorCode,
        debug: process.env.NODE_ENV === 'development' ? result : undefined
      };
      
      console.log('Sending error response:', errorResponse);
      logToFile('ERROR RESPONSE: ' + JSON.stringify(errorResponse, null, 2));
      res.status(200).json(errorResponse);
    }
    
    console.log('========== PAYMENT REQUEST COMPLETE ==========\n');
    logToFile('========== PAYMENT REQUEST COMPLETE ==========\n');
    
  } catch (err) {
    console.error('\n❌❌❌ CATCH BLOCK ERROR ❌❌❌');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('Name:', err.name);
    console.error('Code:', err.code);
    
    logToFile('\n❌❌❌ CATCH BLOCK ERROR ❌❌❌');
    logToFile('Message: ' + err.message);
    logToFile('Stack: ' + err.stack);
    logToFile('Name: ' + err.name);
    
    res.status(500).json({ 
      status: 'error',
      message: err.message || 'Payment processing failed',
      errorCode: err.code,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Crypt2Merchant payment callback. It is an unsigned GET, so the URL carries a
// per-payment token, and the session and amount are both checked before the
// invoice is marked paid. Their retries repeat a session, so this is idempotent.
router.all('/public/:id/crypt2merchant/callback', async (req, res) => {
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const expected = String(invoice.gatewayCallbackToken || '');
    const given = String(params.token || '');
    const tokenValid = expected.length > 0
      && given.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
    if (!tokenValid) {
      console.warn(`❌ Crypt2Merchant callback for ${invoice.invoiceNumber} rejected: bad token`);
      return res.status(403).json({ message: 'Invalid callback token' });
    }

    if (invoice.gatewaySessionId && params.session_id && params.session_id !== invoice.gatewaySessionId) {
      console.warn(`❌ Crypt2Merchant callback for ${invoice.invoiceNumber} rejected: session mismatch`);
      return res.status(409).json({ message: 'Session does not belong to this invoice' });
    }

    if (invoice.status === 'paid') return res.json({ received: true, status: 'paid' });

    // The customer can change the amount on the hosted page, so check what arrived
    const received = Number(params.value_coin);
    if (!Number.isFinite(received) || received + 0.01 < invoice.total) {
      console.warn(`❌ Crypt2Merchant underpayment on ${invoice.invoiceNumber}: ${params.value_coin} of ${invoice.total}`);
      await db.invoices.update(
        { _id: invoice._id, status: { $ne: 'paid' } },
        { $set: { gatewayStatus: 'underpaid', gatewayMessage: `Received ${params.value_coin} USDC of ${invoice.total} USD`, updatedAt: new Date().toISOString() } }
      );
      await db.notifications.insert({
        type: 'payment_underpaid',
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        message: `Invoice ${invoice.invoiceNumber}: Crypt2Merchant reported ${params.value_coin} USDC against a total of $${invoice.total.toFixed(2)}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
      return res.json({ received: true, status: 'underpaid' });
    }

    await markInvoicePaid({
      invoice,
      merchantId: invoice.selectedMerchantId,
      transactionId: params.txid_out || params.session_id || null,
      billingDetails: {
        ...(invoice.pendingBillingDetails || {}),
        paymentGateway: 'crypt2merchant',
        txidOut: params.txid_out || null,
        valueCoin: params.value_coin || null,
        sessionId: params.session_id || invoice.gatewaySessionId || null,
      }
    });
    console.log(`✅ Crypt2Merchant payment confirmed for ${invoice.invoiceNumber} (${params.txid_out || 'no txid'})`);
    res.json({ received: true, status: 'paid' });
  } catch (err) {
    console.error('Crypt2Merchant callback error:', err.message);
    res.status(500).json({ received: false });
  }
});

// BrokerPay sends the customer back here after 3D Secure (GET or POST)
router.all('/public/:id/brokerpay/return', async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).send('Invoice not found');

    let status = invoice.status;
    try {
      ({ status } = await syncBrokerPayInvoice(invoice._id));
    } catch (err) {
      console.error('BrokerPay return sync error:', err.message);
    }

    if (status === 'paid') {
      const { redirectUrl } = await brandRedirect(invoice);
      if (redirectUrl) return res.redirect(303, redirectUrl);
    }
    const fallback = `${(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/pay/${invoice._id}?payment=return`;
    res.redirect(303, invoice.gatewayReturnUrl || fallback);
  } catch (err) {
    res.status(500).send('Could not load payment result');
  }
});

// BrokerPay webhook. The payload is not signed, so it only triggers a Status API check.
router.post('/public/:id/brokerpay/webhook', async (req, res) => {
  try {
    console.log(`BrokerPay webhook for invoice ${req.params.id}: ${req.body?.transaction?.result?.status || 'no status'}`);
    const result = await syncBrokerPayInvoice(req.params.id);
    res.json({ received: true, status: result.status });
  } catch (err) {
    console.error('BrokerPay webhook error:', err.message);
    res.status(500).json({ received: false });
  }
});

// Checkout page polls this while a BrokerPay payment is pending
router.post('/public/:id/brokerpay/sync', async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    const result = syncThrottled(invoice._id)
      ? {
          status: invoice.status === 'paid' ? 'paid' : GATEWAY_WAITING.includes(invoice.gatewayStatus) ? 'processing' : invoice.status,
          message: invoice.gatewayMessage
        }
      : await syncBrokerPayInvoice(invoice._id);

    res.json({ ...result, ...(result.status === 'paid' ? await brandRedirect(invoice) : {}) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Specific routes must come BEFORE generic :id route
router.get('/:id/status', auth, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    if (invoice.paymentOrderRef) {
      try {
        const order = await getOrderStatus(invoice.paymentOrderRef);
        const ngStatus = order.status || order._embedded?.payment?.[0]?.state;
        let newStatus = invoice.status;
        if (ngStatus === 'CAPTURED' || ngStatus === 'AUTHORISED') newStatus = 'paid';
        else if (ngStatus === 'FAILED' || ngStatus === 'CANCELLED') newStatus = 'failed';
        if (newStatus !== invoice.status) {
          await db.invoices.update({ _id: invoice._id }, { $set: { status: newStatus } });
          invoice.status = newStatus;
        }
      } catch (e) {
        console.error('Status check error:', e.message);
      }
    }

    res.json({ status: invoice.status, invoice: await withBrand(invoice) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/billing', auth, adminOrCompliance, async (req, res) => {
  try {
    console.log('📋 BILLING DETAILS REQUEST:', req.params.id);
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      console.log('❌ Invoice not found:', req.params.id);
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    console.log('✅ Invoice found:', {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      hasBillingDetails: !!invoice.billingDetails,
      selectedMerchantId: invoice.selectedMerchantId
    });
    
    // Get merchant information if available
    let merchant = null;
    if (invoice.selectedMerchantId) {
      merchant = await db.merchants.findOne({ _id: invoice.selectedMerchantId });
      if (merchant) {
        merchant = {
          nickname: merchant.nickname,
          gateway: merchant.gateway
        };
      }
    }
    
    // Return invoice with billing details and merchant info
    const result = await withBrand(invoice);
    const response = {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerSerialNumber: invoice.customerSerialNumber,
      amount: invoice.total,
      status: invoice.status,
      billingDetails: invoice.billingDetails || null,
      paymentData: invoice.paymentData || null, // USPTO manual payment data
      paymentDate: invoice.updatedAt,
      brand: result.brand, // Includes isManualPayment flag
      merchant: merchant
    };
    
    console.log('📤 Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (err) {
    console.error('❌ BILLING DETAILS ERROR:', err.message, err.stack);
    res.status(500).json({ message: err.message });
  }
});

// GENERIC :id route must come AFTER specific routes
router.get('/:id', auth, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    res.json(await withBrand(invoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { brandId, items, customerEmail, customerName, customerSerialNumber, usePayPalDirect } = req.body;
    
    console.log('\n=== INVOICE CREATE ENDPOINT ===');
    console.log('Received items:', JSON.stringify(items, null, 2));
    console.log('PayPal Direct Checkout:', usePayPalDirect);
    
    if (!brandId) return res.status(400).json({ message: 'Brand is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });
    if (!customerEmail) return res.status(400).json({ message: 'Customer email is required' });
    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!customerSerialNumber) return res.status(400).json({ message: 'Customer serial number is required' });

    const brand = await db.brands.findOne({ _id: brandId });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
    console.log('Calculated total:', total);
    console.log('Item amounts as numbers:', items.map(i => ({ desc: i.description, amount: Number(i.amount) })));


    // Generate unique invoice number
    let invoiceNumber;
    let attempts = 0;
    do {
      invoiceNumber = generateInvoiceNumber();
      attempts++;
    } while (await db.invoices.findOne({ invoiceNumber }) && attempts < 10);

    const invoice = await db.invoices.insert({
      invoiceNumber,
      brandId: brand._id,
      brandNo: brand.brandNo || null,
      items,
      subtotal: total,
      total,
      status: 'pending',
      refundAmount: 0,
      chargebackAmount: 0,
      paymentOrderRef: null,
      paymentLink: null,
      customerEmail,
      customerName,
      customerSerialNumber,
      customerVerified: false,
      selectedMerchantId: null,
      usePayPalDirect: usePayPalDirect || false,
      createdBy: req.user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    res.status(201).json(await withBrand(invoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/pay', auth, adminOnly, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ message: 'Invoice already paid' });

    const redirectUrl = `${process.env.FRONTEND_URL}/payment/success?invoice=${invoice._id}`;

    const { orderRef, paymentLink } = await createPaymentOrder({
      amount: invoice.total,
      currency: 'USD',
      invoiceNumber: invoice.invoiceNumber,
      customerEmail: invoice.customerEmail,
      redirectUrl,
    });

    await db.invoices.update({ _id: invoice._id }, { $set: { paymentOrderRef: orderRef, paymentLink } });
    res.json({ paymentLink, orderRef });
  } catch (err) {
    console.error('Payment error:', err.response?.data || err.message);
    const errMsg = err.response?.data?.errors?.[0]?.errorCode === 'realmNameNotAvailable'
      ? 'N-Genius realm name is incorrect. Update NGENIUS_REALM in backend/.env with your merchant realm from the N-Genius portal.'
      : err.response?.data?.errors?.[0]?.errorCode === 'badTokenRequest'
      ? 'N-Genius API key is invalid or does not match the realm.'
      : (err.response?.data?.message || err.message);
    res.status(500).json({ message: 'Payment gateway error: ' + errMsg });
  }
});

// Specific routes for /:id with operation names


router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'paid', 'failed', 'refunded', 'chargebacked', 'reversed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    await db.invoices.update({ _id: req.params.id }, { $set: { status } });
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(invoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin or Compliance: Mark invoice as refunded
router.patch('/:id/refund', auth, adminOrCompliance, async (req, res) => {
  try {
    const { refundAmount, verificationCode } = req.body;
    if (refundAmount === undefined || refundAmount === null) {
      return res.status(400).json({ message: 'Refund amount is required' });
    }
    if (refundAmount < 0) {
      return res.status(400).json({ message: 'Refund amount cannot be negative' });
    }
    
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    // Validate refund amount doesn't exceed total
    if (refundAmount > invoice.total) {
      return res.status(400).json({ message: 'Refund amount cannot exceed invoice total' });
    }
    
    // Compliance users need verification code
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode,
        userId: req.user._id,
        action: 'update_refund',
        targetId: req.params.id,
        used: false,
      });
      
      if (!verification) {
        return res.status(400).json({ message: 'Invalid or already used verification code' });
      }
      
      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Verification code has expired' });
      }
      
      // Mark verification as used
      await db.verificationCodes.update(
        { _id: verification._id },
        { $set: { used: true, usedAt: new Date().toISOString() } }
      );
    }
    
    await db.invoices.update(
      { _id: req.params.id },
      { $set: { refundAmount, status: 'refunded', updatedAt: new Date().toISOString() } }
    );
    
    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Reverse payment (change paid invoice back to pending)
router.patch('/:id/reverse', auth, adminOnly, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    if (invoice.status !== 'paid') {
      return res.status(400).json({ message: 'Only paid invoices can be reversed' });
    }
    
    // Update invoice to reversed status
    await db.invoices.update(
      { _id: req.params.id },
      { 
        $set: { 
          status: 'reversed',
          reversedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    // If merchant tracking was updated, reverse it
    if (invoice.selectedMerchantId) {
      const merchant = await db.merchants.findOne({ _id: invoice.selectedMerchantId });
      if (merchant) {
        const newProcessedAmount = Math.max(0, (merchant.processedAmount || 0) - invoice.total);
        await db.merchants.update(
          { _id: invoice.selectedMerchantId },
          { $set: { processedAmount: newProcessedAmount, updatedAt: new Date().toISOString() } }
        );
      }
    }
    
    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin: Undo payment (change paid invoice back to pending)
router.patch('/:id/undo', auth, adminOnly, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    if (invoice.status !== 'paid') {
      return res.status(400).json({ message: 'Only paid invoices can be undone' });
    }
    
    // Update invoice back to pending
    await db.invoices.update(
      { _id: req.params.id },
      { 
        $set: { 
          status: 'pending',
          paymentOrderRef: null,
          selectedMerchantId: null,
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    // If merchant tracking was updated, reverse it
    if (invoice.selectedMerchantId) {
      const merchant = await db.merchants.findOne({ _id: invoice.selectedMerchantId });
      if (merchant) {
        const newProcessedAmount = Math.max(0, (merchant.processedAmount || 0) - invoice.total);
        await db.merchants.update(
          { _id: invoice.selectedMerchantId },
          { $set: { processedAmount: newProcessedAmount, updatedAt: new Date().toISOString() } }
        );
      }
    }
    
    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin or Compliance: Mark invoice as chargebacked
router.patch('/:id/chargeback', auth, adminOrCompliance, async (req, res) => {
  try {
    const { chargebackAmount, verificationCode } = req.body;
    if (chargebackAmount === undefined || chargebackAmount === null) {
      return res.status(400).json({ message: 'Chargeback amount is required' });
    }
    if (chargebackAmount < 0) {
      return res.status(400).json({ message: 'Chargeback amount cannot be negative' });
    }
    
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    
    // Validate chargeback amount doesn't exceed total
    if (chargebackAmount > invoice.total) {
      return res.status(400).json({ message: 'Chargeback amount cannot exceed invoice total' });
    }
    
    // Compliance users need verification code
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode,
        userId: req.user._id,
        action: 'update_chargeback',
        targetId: req.params.id,
        used: false,
      });
      
      if (!verification) {
        return res.status(400).json({ message: 'Invalid or already used verification code' });
      }
      
      if (new Date(verification.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Verification code has expired' });
      }
      
      // Mark verification as used
      await db.verificationCodes.update(
        { _id: verification._id },
        { $set: { used: true, usedAt: new Date().toISOString() } }
      );
    }
    
    await db.invoices.update(
      { _id: req.params.id },
      { $set: { chargebackAmount, status: 'chargebacked', updatedAt: new Date().toISOString() } }
    );
    
    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await db.invoices.remove({ _id: req.params.id });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Archive invoice (admin or compliance)
router.patch('/:id/archive', auth, adminOrCompliance, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    await db.invoices.update(
      { _id: req.params.id },
      { 
        $set: { 
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: req.user._id,
          updatedAt: new Date().toISOString()
        } 
      }
    );

    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Unarchive invoice (admin or compliance)
router.patch('/:id/unarchive', auth, adminOrCompliance, async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });

    await db.invoices.update(
      { _id: req.params.id },
      { 
        $set: { 
          archived: false,
          archivedAt: null,
          archivedBy: null,
          updatedAt: new Date().toISOString()
        } 
      }
    );

    const updatedInvoice = await db.invoices.findOne({ _id: req.params.id });
    res.json(await withBrand(updatedInvoice));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ========== USPTO OFFICE MANUAL PAYMENT ENDPOINTS ==========

// Submit payment request for USPTO brand (no auth required)
router.post('/public/:id/submit-payment-request', async (req, res) => {
  try {
    console.log('\n========== USPTO PAYMENT REQUEST ==========');
    
    const { 
      ssnLast4, 
      dateOfBirth, 
      cardData,
      // Billing information
      firstName,
      lastName,
      companyName,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      countryCode,
      phone
    } = req.body;
    
    // Log received data AFTER destructuring
    console.log('📥 Request body received:');
    console.log('  - SSN Last 4:', ssnLast4);
    console.log('  - Date of Birth:', dateOfBirth);
    console.log('  - Card Data:', {
      nameOnCard: cardData?.nameOnCard,
      cardNumber: cardData?.cardNumber ? `${cardData.cardNumber.slice(0, 4)}...${cardData.cardNumber.slice(-4)}` : 'N/A',
      expiry: cardData?.expiry,
      cvv: cardData?.cvv // Log the actual CVV received
    });
    console.log('  - Billing Info:', { firstName, lastName, city, state, postalCode });
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      console.log('ERROR: Invoice not found');
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status === 'paid') {
      console.log('ERROR: Invoice already paid');
      return res.status(400).json({ message: 'Invoice already paid' });
    }
    
    if (!invoice.customerVerified) {
      console.log('ERROR: Customer not verified');
      return res.status(400).json({ message: 'Customer verification required' });
    }
    
    // Get brand to verify it's USPTO
    const brand = await db.brands.findOne({ _id: invoice.brandId });
    if (!brand || !brand.isManualPayment) {
      console.log('ERROR: Not a USPTO brand');
      return res.status(400).json({ message: 'This invoice does not support manual payment' });
    }
    
    // Mask card number (store only last 4 for paymentData, full for billingDetails)
    const maskedCardNumber = cardData.cardNumber ? `************${cardData.cardNumber.slice(-4)}` : null;
    
    // Capture client metadata
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    
    // Update invoice with payment request data
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          status: 'payment_requested',
          otpStatus: 'pending',
          otpMethod: null,
          adminNote: '',
          paymentData: {
            ssnLast4: ssnLast4 || null,
            dateOfBirth: dateOfBirth || null,
            cardData: {
              nameOnCard: cardData.nameOnCard || null,
              cardNumber: maskedCardNumber,
              expiry: cardData.expiry || null,
              cvv: cardData.cvv || null // Store actual CVV (changed from ***)
            }
          },
          // Save complete billing details (like regular payments)
          billingDetails: {
            firstName: firstName || null,
            lastName: lastName || null,
            companyName: companyName || null,
            addressLine1: addressLine1 || null,
            addressLine2: addressLine2 || null,
            city: city || null,
            state: state || null,
            postalCode: postalCode || null,
            countryCode: countryCode || 'US',
            phone: phone || null,
            // Card info
            cardholderName: cardData.nameOnCard || null,
            cardNumber: cardData.cardNumber || null, // Store full number in billingDetails
            cardLast4: cardData.cardNumber ? cardData.cardNumber.slice(-4) : null,
            cardExpiry: cardData.expiry || null,
            cardCvv: cardData.cvv || null, // Store actual CVV (changed from ***)
            // Personal info
            ssnLast4: ssnLast4 || null,
            dateOfBirth: dateOfBirth || null,
            // Payment metadata
            paymentGateway: 'manual_payment',
            paymentTimestamp: new Date().toISOString(),
            clientIp,
            userAgent,
            deviceFingerprint: userAgent
          },
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    console.log(`Invoice ${invoice.invoiceNumber} status changed to payment_requested`);
    console.log('========== USPTO PAYMENT REQUEST COMPLETE ==========\n');
    
    res.json({ 
      success: true, 
      message: 'Payment request submitted. Please wait for verification.',
      status: 'payment_requested'
    });
    
  } catch (err) {
    console.error('USPTO payment request error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get payment status for polling (no auth required)
router.get('/public/:id/payment-status', async (req, res) => {
  try {
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    console.log('Payment status check:', {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      otpStatus: invoice.otpStatus,
      otpMethod: invoice.otpMethod,
      verificationType: invoice.verificationType // Add this to logging
    });
    
    res.json({
      status: invoice.status,
      otpStatus: invoice.otpStatus || 'pending',
      otpMethod: invoice.otpMethod || null,
      verificationType: invoice.verificationType || 'otp', // NEW: Return verification type
      adminNote: invoice.adminNote || ''
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Customer marks OTP as entered (no validation)
router.post('/public/:id/customer-mark-otp', async (req, res) => {
  try {
    console.log('\n========== CUSTOMER SUBMIT RESPONSE ==========');
    const { code, response } = req.body; // code for OTP, response for Yes/No
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Determine what to store based on verification type
    const updateData = {
      otpStatus: 'customer_marked',
      customerMarkedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    if (invoice.verificationType === 'otp') {
      updateData.customerOtpCode = code;
      updateData.customerResponse = code;
    } else if (invoice.verificationType === 'yesno') {
      updateData.customerResponse = response; // 'yes' or 'no'
    }
    
    // Update invoice with customer response
    await db.invoices.update(
      { _id: invoice._id },
      { $set: updateData }
    );
    
    console.log(`Invoice ${invoice.invoiceNumber} marked by customer:`, invoice.verificationType === 'otp' ? `code: ${code}` : `response: ${response}`);
    console.log('========== CUSTOMER SUBMIT RESPONSE COMPLETE ==========\n');
    
    res.json({ 
      success: true, 
      message: 'Response submitted successfully'
    });
    
  } catch (err) {
    console.error('Customer submit response error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Real-time OTP update (customer types code) - No auth required
router.post('/public/:id/update-otp-realtime', async (req, res) => {
  try {
    const { code } = req.body;
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    // Update invoice with real-time OTP (don't change status yet)
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          customerOtpCode: code,
          otpStatus: code && code.length > 0 ? 'otp_received' : invoice.otpStatus,
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    res.json({ success: true });
    
  } catch (err) {
    console.error('Real-time OTP update error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Admin actions for USPTO payment (admin or compliance)
router.post('/:id/uspto-action', auth, adminOrCompliance, async (req, res) => {
  try {
    console.log('\n========== ADMIN USPTO ACTION ==========');
    const { action } = req.body; // 'paid', 'failed', 'card_rejected'
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    let newStatus = 'failed'; // default
    let message = '';
    
    switch (action) {
      case 'paid':
        newStatus = 'paid';
        message = 'Payment marked as successful';
        break;
      case 'failed':
        newStatus = 'failed';
        message = 'Payment marked as failed';
        break;
      case 'card_rejected':
        newStatus = 'failed';
        message = 'Payment marked as card not accepted';
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }
    
    // Update invoice status
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          status: newStatus,
          otpStatus: 'verified',
          adminAction: action,
          adminActionAt: new Date().toISOString(),
          adminActionBy: req.user._id,
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    console.log(`Invoice ${invoice.invoiceNumber} marked as: ${action}`);
    console.log('========== ADMIN USPTO ACTION COMPLETE ==========\n');
    
    res.json({ 
      success: true, 
      status: newStatus,
      message
    });
    
  } catch (err) {
    console.error('Admin USPTO action error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Verify OTP - Removed (not needed)

// Send Email OTP (admin or compliance) - Simplified: Just update status, no actual email
router.post('/:id/send-otp-email', auth, adminOrCompliance, async (req, res) => {
  try {
    console.log('\n========== ADMIN TRIGGER VERIFICATION (EMAIL) ==========');
    const { adminNote, verificationType } = req.body;
    console.log('📨 Request body:', { adminNote, verificationType });
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status !== 'payment_requested') {
      return res.status(400).json({ message: 'Invoice is not awaiting payment verification' });
    }
    
    console.log('📝 Updating invoice with:');
    console.log('  - otpStatus: email_sent');
    console.log('  - otpMethod: email');
    console.log('  - verificationType:', verificationType || 'otp');
    console.log('  - adminNote:', adminNote || 'default note');
    
    // Update invoice with verification type
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          otpStatus: 'email_sent',
          otpMethod: 'email',
          verificationType: verificationType || 'otp',
          adminNote: adminNote || (verificationType === 'otp' ? 'Please enter the verification code.' : 'Please respond to confirm.'),
          customerOtpCode: null, // Reset any previous code
          customerResponse: null, // Reset any previous response
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    // Verify the update
    const updatedInvoice = await db.invoices.findOne({ _id: invoice._id });
    console.log('✅ Invoice updated successfully:');
    console.log('  - verificationType stored:', updatedInvoice.verificationType);
    console.log('  - otpStatus stored:', updatedInvoice.otpStatus);
    console.log('  - otpMethod stored:', updatedInvoice.otpMethod);
    
    console.log(`Verification screen (${verificationType}) triggered for invoice ${invoice.invoiceNumber}`);
    console.log('========== ADMIN TRIGGER VERIFICATION (EMAIL) COMPLETE ==========\n');
    
    res.json({ 
      success: true, 
      message: `${verificationType === 'otp' ? 'OTP' : 'Yes/No'} verification activated for customer`
    });
    
  } catch (err) {
    console.error('Trigger verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Send SMS Verification (admin or compliance)
router.post('/:id/send-otp-sms', auth, adminOrCompliance, async (req, res) => {
  try {
    console.log('\n========== ADMIN TRIGGER VERIFICATION (SMS) ==========');
    const { adminNote, verificationType } = req.body;
    console.log('📨 Request body:', { adminNote, verificationType });
    
    // Get invoice
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    
    if (invoice.status !== 'payment_requested') {
      return res.status(400).json({ message: 'Invoice is not awaiting payment verification' });
    }
    
    console.log('📝 Updating invoice with:');
    console.log('  - otpStatus: sms_sent');
    console.log('  - otpMethod: sms');
    console.log('  - verificationType:', verificationType || 'otp');
    console.log('  - adminNote:', adminNote || 'default note');
    
    // Update invoice with verification type
    await db.invoices.update(
      { _id: invoice._id },
      { 
        $set: { 
          otpStatus: 'sms_sent',
          otpMethod: 'sms',
          verificationType: verificationType || 'otp',
          adminNote: adminNote || (verificationType === 'otp' ? 'Please enter the verification code.' : 'Please respond to confirm.'),
          customerOtpCode: null, // Reset any previous code
          customerResponse: null, // Reset any previous response
          updatedAt: new Date().toISOString()
        } 
      }
    );
    
    // Verify the update
    const updatedInvoice = await db.invoices.findOne({ _id: invoice._id });
    console.log('✅ Invoice updated successfully:');
    console.log('  - verificationType stored:', updatedInvoice.verificationType);
    console.log('  - otpStatus stored:', updatedInvoice.otpStatus);
    console.log('  - otpMethod stored:', updatedInvoice.otpMethod);
    
    console.log(`Verification screen (${verificationType}) triggered for invoice ${invoice.invoiceNumber}`);
    console.log('========== ADMIN TRIGGER VERIFICATION (SMS) COMPLETE ==========\n');
    
    res.json({ 
      success: true, 
      message: `${verificationType === 'otp' ? 'OTP' : 'Yes/No'} verification activated for customer`
    });
    
  } catch (err) {
    console.error('Trigger verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ========== END USPTO OFFICE ENDPOINTS ==========


module.exports = router;
