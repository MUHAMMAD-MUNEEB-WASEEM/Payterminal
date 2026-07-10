const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { generateInvoiceNumber } = require('../utils/invoiceNumber');
const { createPaymentOrder, getOrderStatus } = require('../utils/ngenius');

// Populate brand info into invoice
async function withBrand(invoice) {
  if (!invoice) return null;
  const brand = invoice.brandId ? await db.brands.findOne({ _id: invoice.brandId }) : null;
  return { ...invoice, brand: brand || null };
}

// Get all invoices (filtered by user for non-admins)
router.get('/', auth, async (req, res) => {
  try {
    const query = req.user.role === 'admin' ? {} : { createdBy: req.user._id };
    const invoices = await db.invoices.find(query, { createdAt: -1 });
    const populated = await Promise.all(invoices.map(withBrand));
    res.json(populated);
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
              cardholderName: cardHolder,
              cardLast4: cardNumber ? cardNumber.slice(-4) : null,
              paymentGateway: merchant.gateway
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

router.get('/:id/billing', auth, adminOnly, async (req, res) => {
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
      hasBillingDetails: !!invoice.billingDetails
    });
    
    // Return invoice with billing details
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
      brand: result.brand
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
    const { brandId, items, customerEmail, customerName, customerSerialNumber } = req.body;
    
    console.log('\n=== INVOICE CREATE ENDPOINT ===');
    console.log('Received items:', JSON.stringify(items, null, 2));
    
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

// Admin: Mark invoice as refunded
router.patch('/:id/refund', auth, adminOnly, async (req, res) => {
  try {
    const { refundAmount } = req.body;
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

// Admin: Mark invoice as chargebacked
router.patch('/:id/chargeback', auth, adminOnly, async (req, res) => {
  try {
    const { chargebackAmount } = req.body;
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

module.exports = router;
