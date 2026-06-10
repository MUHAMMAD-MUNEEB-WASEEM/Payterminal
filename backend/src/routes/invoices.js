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

// Public payment endpoint (no auth required)
router.post('/public/:id/pay', async (req, res) => {
  try {
    const { cardNumber, cardHolder, expiryMonth, expiryYear, cvv, merchantId } = req.body;
    const invoice = await db.invoices.findOne({ _id: req.params.id });
    
    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ message: 'Invoice already paid' });
    if (!invoice.customerVerified) return res.status(400).json({ message: 'Customer verification required' });

    // Get selected merchant
    if (!merchantId) return res.status(400).json({ message: 'Payment method is required' });
    
    const merchant = await db.merchants.findOne({ _id: merchantId });
    if (!merchant) return res.status(404).json({ message: 'Payment method not found' });
    if (!merchant.isActive) return res.status(400).json({ message: 'Payment method is not active' });

    // Prepare payment data
    const paymentData = {
      amount: invoice.total,
      currency: 'USD',
      cardNumber,
      cardHolder,
      expiryMonth,
      expiryYear,
      cvv,
      description: `Invoice ${invoice.invoiceNumber}`,
    };

    let result;

    // Process payment based on gateway
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
        const { processBeyondbancardPayment } = require('../utils/beyondbancard');
        result = await processBeyondbancardPayment(merchant.credentials, paymentData);
        break;
      }
      default:
        return res.status(400).json({ message: 'Unsupported payment gateway' });
    }

    if (result.success) {
      // Update merchant processed amount
      const merchant = await db.merchants.findOne({ _id: merchantId });
      const newProcessedAmount = (merchant.processedAmount || 0) + invoice.total;
      await db.merchants.update(
        { _id: merchantId },
        { $set: { processedAmount: newProcessedAmount, updatedAt: new Date().toISOString() } }
      );
      
      // Check if limit reached and notify
      if (merchant.amountLimit && newProcessedAmount >= merchant.amountLimit) {
        // Create notification for admin
        await db.notifications.insert({
          type: 'merchant_limit_reached',
          merchantId: merchant._id,
          merchantNickname: merchant.nickname,
          amountLimit: merchant.amountLimit,
          processedAmount: newProcessedAmount,
          message: `Merchant "${merchant.nickname}" has reached its amount limit of $${merchant.amountLimit.toFixed(2)}`,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      
      // Update invoice status
      await db.invoices.update(
        { _id: invoice._id },
        { 
          $set: { 
            status: 'paid', 
            paymentOrderRef: result.transactionId,
            selectedMerchantId: merchantId,
            updatedAt: new Date().toISOString()
          } 
        }
      );
      
      res.json({ 
        status: 'paid', 
        message: result.message || 'Payment successful',
        transactionId: result.transactionId
      });
    } else {
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
      
      res.status(400).json({ 
        message: result.error || 'Payment failed' 
      });
    }
  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ message: err.message || 'Payment processing failed' });
  }
});

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
    
    if (!brandId) return res.status(400).json({ message: 'Brand is required' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });
    if (!customerEmail) return res.status(400).json({ message: 'Customer email is required' });
    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!customerSerialNumber) return res.status(400).json({ message: 'Customer serial number is required' });

    const brand = await db.brands.findOne({ _id: brandId });
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    const total = items.reduce((sum, item) => sum + Number(item.amount), 0);

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

router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'paid', 'failed', 'refunded', 'chargebacked'].includes(status)) {
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
