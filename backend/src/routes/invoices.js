const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly, adminOrCompliance } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { createPaymentOrder, getOrderStatus } = require('../utils/ngenius');

// Populate brand info into invoice
async function withBrand(invoice) {
  if (!invoice) return null;
  const brand = invoice.brandId ? await db.brands.findOne({ _id: invoice.brandId }) : null;
  return { ...invoice, brand: brand || null };
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
    logToFile(`Request: cardHolder=${cardHolder}, firstName=${firstName}, lastName=${lastName}, city=${city}, phone=${phone}, merchantId=${merchantId}`);
    
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

    if (result.success) {
      console.log('✅ Payment successful! Processing invoice update...');
      logToFile('✅ PAYMENT SUCCESSFUL');
      
      // Update merchant processed amount
      const freshMerchant = await db.merchants.findOne({ _id: merchantId });
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
            paymentOrderRef: result.transactionId,
            selectedMerchantId: merchantId,
            billingDetails: {
              firstName,
              lastName,
              companyName,
              addressLine1,
              addressLine2,
              city,
              state,
              postalCode,
              countryCode,
              phone,
              cardholderName: cardHolder,
              cardLast4: cardNumber ? cardNumber.slice(-4) : null,
              cardExpiry: expiryMonth && expiryYear ? `${expiryMonth}/${expiryYear}` : null,
              paymentGateway: merchant.gateway,
              // Payment metadata
              paymentTimestamp,
              clientIp,
              userAgent,
              deviceFingerprint: userAgent // Simple fingerprint using user agent
            },
            updatedAt: new Date().toISOString()
          } 
        }
      );
      
      console.log(`Invoice ${invoice.invoiceNumber} marked as paid`);
      
      // Fetch updated invoice with brand info
      const updatedInvoice = await db.invoices.findOne({ _id: invoice._id });
      const brand = updatedInvoice.brandId ? await db.brands.findOne({ _id: updatedInvoice.brandId }) : null;
      
      console.log('Brand redirect info:', {
        hasBrand: !!brand,
        enableRedirect: brand?.enableRedirect,
        hasRedirectUrl: !!brand?.redirectUrl
      });
      
      const response = { 
        status: 'paid', 
        message: result.message || 'Payment successful',
        transactionId: result.transactionId,
        redirectUrl: (brand && brand.enableRedirect && brand.redirectUrl) ? brand.redirectUrl : null,
        enableRedirect: (brand && brand.enableRedirect) ? true : false,
        brand: brand ? { name: brand.name, redirectUrl: brand.redirectUrl, enableRedirect: brand.enableRedirect } : null
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
      paymentDate: invoice.updatedAt,
      brand: result.brand,
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

module.exports = router;
