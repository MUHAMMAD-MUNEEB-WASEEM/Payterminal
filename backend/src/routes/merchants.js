const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOnly, adminOrCompliance } = require('../middleware/auth');

// Get all merchants (admin or compliance)
router.get('/', auth, adminOrCompliance, async (req, res) => {
  try {
    const merchants = await db.merchants.find({});
    // Don't send full credentials to frontend, only masked info
    const safeMerchants = merchants.map(m => ({
      ...m,
      credentials: m.credentials ? { configured: true } : { configured: false }
    }));
    res.json(safeMerchants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single merchant (admin or compliance)
router.get('/:id', auth, adminOrCompliance, async (req, res) => {
  try {
    const merchant = await db.merchants.findOne({ _id: req.params.id });
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });
    
    // Mask credentials
    const safeMerchant = {
      ...merchant,
      credentials: merchant.credentials ? { configured: true } : { configured: false }
    };
    res.json(safeMerchant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create merchant (admin only)
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { nickname, gateway, credentials, amountLimit, ticketSize } = req.body;
    
    if (!nickname || !gateway) {
      return res.status(400).json({ message: 'Nickname and gateway are required' });
    }
    
    if (!['stripe', 'paypal', 'authorize', 'beyondbancard'].includes(gateway)) {
      return res.status(400).json({ message: 'Invalid gateway. Must be stripe, paypal, authorize, or beyondbancard' });
    }
    
    const merchant = await db.merchants.insert({
      nickname,
      gateway,
      credentials: credentials || {},
      amountLimit: amountLimit ? Number(amountLimit) : null,
      ticketSize: ticketSize ? Number(ticketSize) : null,
      processedAmount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    res.status(201).json(merchant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update merchant (admin only)
router.patch('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { nickname, credentials, isActive, amountLimit, ticketSize, processedAmount } = req.body;
    const updateData = { updatedAt: new Date().toISOString() };
    
    if (nickname !== undefined) updateData.nickname = nickname;
    if (credentials !== undefined) updateData.credentials = credentials;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (amountLimit !== undefined) updateData.amountLimit = amountLimit ? Number(amountLimit) : null;
    if (ticketSize !== undefined) updateData.ticketSize = ticketSize ? Number(ticketSize) : null;
    if (processedAmount !== undefined) updateData.processedAmount = Number(processedAmount);
    
    await db.merchants.update({ _id: req.params.id }, { $set: updateData });
    const merchant = await db.merchants.findOne({ _id: req.params.id });
    
    res.json(merchant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete merchant (admin only)
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    // Also remove brand-merchant associations
    await db.brandMerchants.remove({ merchantId: req.params.id }, { multi: true });
    await db.merchants.remove({ _id: req.params.id });
    res.json({ message: 'Merchant deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get brands for a merchant (admin or compliance)
router.get('/brand-list/:merchantId', auth, adminOrCompliance, async (req, res) => {
  try {
    const brandMerchants = await db.brandMerchants.find({ merchantId: req.params.merchantId });
    const brandIds = brandMerchants.map(bm => bm.brandId);
    
    const brands = [];
    for (const id of brandIds) {
      const brand = await db.brands.findOne({ _id: id });
      if (brand) {
        brands.push(brand);
      }
    }
    
    res.json(brands);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get merchants for a brand (public endpoint for payment page)
router.get('/brand/:brandId/public', async (req, res) => {
  try {
    const brandMerchants = await db.brandMerchants.find({ brandId: req.params.brandId });
    
    // Sort by creation order to maintain priority
    brandMerchants.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    
    const merchants = [];
    for (const bm of brandMerchants) {
      const merchant = await db.merchants.findOne({ _id: bm.merchantId, isActive: true });
      if (merchant) {
        // Check if merchant has reached limit
        const hasLimit = merchant.amountLimit && merchant.amountLimit > 0;
        const limitReached = hasLimit && merchant.processedAmount >= merchant.amountLimit;
        
        // Only include merchants that haven't reached their limit
        if (!limitReached) {
          const merchantData = {
            _id: merchant._id,
            nickname: merchant.nickname,
            gateway: merchant.gateway,
            isDefault: bm.isDefault || false,
            ticketSize: merchant.ticketSize || null,
            // Include tokenization key for frontend (safe to expose - it's public)
            tokenizationKey: merchant.credentials?.tokenizationKey || null,
          };
          
          // For PayPal, include credentials (clientId is safe to expose - it's public)
          if (merchant.gateway === 'paypal') {
            merchantData.credentials = {
              clientId: merchant.credentials?.clientId || null,
              mode: merchant.credentials?.mode || 'sandbox'
            };
          }
          
          // For Stripe, include publishable key (safe to expose - it's public)
          if (merchant.gateway === 'stripe') {
            merchantData.credentials = {
              publishableKey: merchant.credentials?.publishableKey || null
            };
          }
          
          merchants.push(merchantData);
        }
      }
    }
    
    res.json(merchants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get merchants for a brand (admin or compliance)
router.get('/brand/:brandId', auth, adminOrCompliance, async (req, res) => {
  try {
    const brandMerchants = await db.brandMerchants.find({ brandId: req.params.brandId });
    const merchantIds = brandMerchants.map(bm => bm.merchantId);
    
    const merchants = [];
    for (const id of merchantIds) {
      const merchant = await db.merchants.findOne({ _id: id });
      if (merchant) {
        merchants.push({
          ...merchant,
          isDefault: brandMerchants.find(bm => bm.merchantId === id)?.isDefault || false,
          credentials: merchant.credentials ? { configured: true } : { configured: false }
        });
      }
    }
    
    res.json(merchants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Assign merchant to brand (admin only)
router.post('/brand/:brandId/assign', auth, adminOnly, async (req, res) => {
  try {
    const { merchantId, isDefault } = req.body;
    
    if (!merchantId) {
      return res.status(400).json({ message: 'Merchant ID is required' });
    }
    
    // Check if already assigned
    const existing = await db.brandMerchants.findOne({ 
      brandId: req.params.brandId, 
      merchantId 
    });
    
    if (existing) {
      return res.status(400).json({ message: 'Merchant already assigned to this brand' });
    }
    
    // If this is default, unset other defaults
    if (isDefault) {
      await db.brandMerchants.update(
        { brandId: req.params.brandId },
        { $set: { isDefault: false } },
        { multi: true }
      );
    }
    
    const assignment = await db.brandMerchants.insert({
      brandId: req.params.brandId,
      merchantId,
      isDefault: isDefault || false,
      createdAt: new Date().toISOString(),
    });
    
    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Remove merchant from brand (admin only)
router.delete('/brand/:brandId/merchant/:merchantId', auth, adminOnly, async (req, res) => {
  try {
    await db.brandMerchants.remove({ 
      brandId: req.params.brandId, 
      merchantId: req.params.merchantId 
    });
    res.json({ message: 'Merchant removed from brand' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test Authorize.net credentials (admin only)
router.post('/test-authorize', auth, adminOnly, async (req, res) => {
  try {
    const { apiLoginId, transactionKey, mode } = req.body;
    
    if (!apiLoginId || !transactionKey) {
      return res.status(400).json({ message: 'API Login ID and Transaction Key are required' });
    }

    console.log('Testing Authorize.net credentials:', {
      apiLoginId,
      transactionKeyLength: transactionKey.length,
      mode: mode || 'sandbox'
    });

    const ApiContracts = require('authorizenet').APIContracts;
    const ApiControllers = require('authorizenet').APIControllers;
    const SDKConstants = require('authorizenet').Constants;

    const merchantAuth = new ApiContracts.MerchantAuthenticationType();
    merchantAuth.setName(apiLoginId);
    merchantAuth.setTransactionKey(transactionKey);

    const creditCard = new ApiContracts.CreditCardType();
    creditCard.setCardNumber('4007000000027');
    creditCard.setExpirationDate('2025-12');
    creditCard.setCardCode('123');

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setCreditCard(creditCard);

    const transactionRequest = new ApiContracts.TransactionRequestType();
    transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
    transactionRequest.setPayment(paymentType);
    transactionRequest.setAmount(0.01);

    const createRequest = new ApiContracts.CreateTransactionRequest();
    createRequest.setMerchantAuthentication(merchantAuth);
    createRequest.setTransactionRequest(transactionRequest);

    const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
    
    if (mode === 'live') {
      ctrl.setEnvironment(SDKConstants.endpoint.production);
    } else {
      ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
    }

    ctrl.execute(() => {
      const apiResponse = ctrl.getResponse();
      const response = new ApiContracts.CreateTransactionResponse(apiResponse);

      if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
        const transResponse = response.getTransactionResponse();
        if (transResponse && transResponse.getMessages()) {
          res.json({
            success: true,
            message: '✅ Credentials are valid! Authentication successful.',
            transactionId: transResponse.getTransId(),
            note: 'Your API credentials are working correctly.'
          });
        } else if (transResponse && transResponse.getErrors()) {
          const error = transResponse.getErrors().getError()[0];
          // E00027 means auth worked but transaction failed
          if (error.getErrorCode() === '27' || error.getErrorCode() === 'E00027') {
            res.json({
              success: true,
              message: '✅ Authentication successful! (Transaction declined but credentials are valid)',
              note: 'Your credentials work. The transaction was declined, which is normal for test accounts. You can use this merchant for payments.',
              errorCode: error.getErrorCode(),
              errorText: error.getErrorText()
            });
          } else {
            res.json({
              success: false,
              message: 'Authentication passed but transaction failed',
              error: error.getErrorText(),
              errorCode: error.getErrorCode()
            });
          }
        }
      } else {
        const errorMsg = response.getMessages().getMessage()[0];
        res.json({
          success: false,
          message: 'Authentication failed',
          errorCode: errorMsg.getCode(),
          errorText: errorMsg.getText()
        });
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test BeyondBancard credentials (admin only)
router.post('/test-beyondbancard', auth, adminOnly, async (req, res) => {
  try {
    const { apiKey, apiSecret, mode } = req.body;
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'API Key and Secret are required' });
    }

    const { testBeyondbancardCredentials } = require('../utils/beyondbancard');
    const result = await testBeyondbancardCredentials(apiKey, apiSecret, mode || 'sandbox');

    if (result.success) {
      res.json({
        success: true,
        message: '✅ ' + result.message,
        note: 'Your BeyondBancard credentials are valid and working correctly.'
      });
    } else {
      res.json({
        success: false,
        message: '❌ ' + result.message,
        errorCode: result.errorCode
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Debug endpoint to test BeyondBancard payment processor directly (admin only)
router.post('/debug-beyondbancard-payment', auth, adminOnly, async (req, res) => {
  try {
    const { apiKey, apiSecret, mode, amount } = req.body;
    
    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: 'API Key and Secret are required' });
    }

    const { processBeyondbancardPayment } = require('../utils/beyondbancard');
    
    const testPaymentData = {
      amount: amount || 1.00,
      currency: 'USD',
      cardNumber: '4242424242424242',
      cardHolder: 'Test User',
      expiryMonth: '12',
      expiryYear: '2025',
      cvv: '123',
      description: 'Debug Test Payment'
    };

    const credentials = {
      apiKey,
      apiSecret,
      mode: mode || 'sandbox'
    };

    console.log('🔍 Debug: Testing BeyondBancard payment processor');
    console.log('Credentials:', { apiKey: '***', apiSecret: '***', mode });
    console.log('Payment data:', testPaymentData);

    const result = await processBeyondbancardPayment(credentials, testPaymentData);

    console.log('🔍 Debug: Result:', JSON.stringify(result, null, 2));

    res.json({
      debug: true,
      result,
      testPaymentData,
      message: result.success ? 'Payment processor test successful' : 'Payment processor test failed'
    });
  } catch (err) {
    console.error('🔍 Debug: Error in payment test:', err);
    res.status(500).json({ 
      message: 'Debug test error',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Reset merchant volume with verification (admin or compliance)
router.post('/:id/reset-volume', auth, adminOrCompliance, async (req, res) => {
  try {
    const { verificationCode } = req.body;
    
    const merchant = await db.merchants.findOne({ _id: req.params.id });
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });
    
    // Compliance users need verification code, admin users bypass
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode,
        userId: req.user._id,
        action: 'reset_volume',
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
    
    // Reset the volume
    await db.merchants.update(
      { _id: req.params.id },
      { $set: { processedAmount: 0, updatedAt: new Date().toISOString() } }
    );
    
    const updatedMerchant = await db.merchants.findOne({ _id: req.params.id });
    res.json({
      message: `Merchant volume reset successfully`,
      merchant: updatedMerchant,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset merchant ticket size with verification (admin or compliance)
router.post('/:id/reset-ticket-size', auth, adminOrCompliance, async (req, res) => {
  try {
    const { verificationCode, ticketSize } = req.body;
    
    const merchant = await db.merchants.findOne({ _id: req.params.id });
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });
    
    // Compliance users need verification code, admin users bypass
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode,
        userId: req.user._id,
        action: 'reset_ticket_size',
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
    
    // Update ticket size
    await db.merchants.update(
      { _id: req.params.id },
      { $set: { ticketSize: ticketSize ? Number(ticketSize) : null, updatedAt: new Date().toISOString() } }
    );
    
    const updatedMerchant = await db.merchants.findOne({ _id: req.params.id });
    res.json({
      message: `Merchant ticket size updated successfully`,
      merchant: updatedMerchant,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle merchant active status with verification (admin or compliance)
router.post('/:id/toggle-active', auth, adminOrCompliance, async (req, res) => {
  try {
    const { verificationCode } = req.body;
    
    const merchant = await db.merchants.findOne({ _id: req.params.id });
    if (!merchant) return res.status(404).json({ message: 'Merchant not found' });
    
    // Compliance users need verification code, admin users bypass
    if (req.user.role === 'compliance') {
      if (!verificationCode) {
        return res.status(400).json({ message: 'Verification code is required' });
      }
      
      // Verify the code
      const verification = await db.verificationCodes.findOne({
        code: verificationCode,
        userId: req.user._id,
        action: 'toggle_merchant',
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
    
    // Toggle active status
    const newStatus = !merchant.isActive;
    await db.merchants.update(
      { _id: req.params.id },
      { $set: { isActive: newStatus, updatedAt: new Date().toISOString() } }
    );
    
    const updatedMerchant = await db.merchants.findOne({ _id: req.params.id });
    res.json({
      message: `Merchant ${newStatus ? 'activated' : 'deactivated'} successfully`,
      merchant: updatedMerchant,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
