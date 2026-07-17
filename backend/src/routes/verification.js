const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, adminOrCompliance } = require('../middleware/auth');
const { sendVerificationCode, ALL_ADMIN_EMAILS } = require('../utils/emailService');

// Generate and send verification code
router.post('/generate', auth, adminOrCompliance, async (req, res) => {
  try {
    const { action, targetId, targetName } = req.body;

    console.log('📥 Generate verification request:', { action, targetId, targetName, userId: req.user._id });

    // Validate action
    const validActions = [
      'reset_volume', 
      'reset_ticket_size', 
      'toggle_merchant', 
      'create_brand',
      'edit_brand',
      'delete_brand',
      'assign_merchant_to_brand',
      'archive_invoice',
      'unarchive_invoice',
      'update_refund',
      'update_chargeback'
    ];
    if (!validActions.includes(action)) {
      console.error('❌ Invalid action:', action);
      return res.status(400).json({ message: 'Invalid action type' });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Create verification record
    const verification = await db.verificationCodes.insert({
      code,
      userId: req.user._id,
      userName: req.user.username,
      action,
      targetId: targetId || null,
      targetName: targetName || null,
      email: ALL_ADMIN_EMAILS,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
    });

    // Send email
    const emailResult = await sendVerificationCode(code, action, req.user.username);

    if (!emailResult.success) {
      console.error('Failed to send email, but code created:', verification._id);
    }

    // Log the code to console for development
    console.log('\n🔐 ====================');
    console.log(`📧 VERIFICATION CODE: ${code}`);
    console.log(`👤 User: ${req.user.username}`);
    console.log(`🎯 Action: ${action}`);
    console.log(`⏰ Expires: ${new Date(verification.expiresAt).toLocaleTimeString()}`);
    console.log('🔐 ====================\n');

    res.json({
      success: true,
      message: `Verification code sent to ${ALL_ADMIN_EMAILS}`,
      codeId: verification._id,
      expiresAt: verification.expiresAt,
    });
  } catch (err) {
    console.error('Generate verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Verify code
router.post('/verify', auth, adminOrCompliance, async (req, res) => {
  try {
    const { code, action } = req.body;

    if (!code || !action) {
      return res.status(400).json({ message: 'Code and action are required' });
    }

    // Trim and normalize the code
    const normalizedCode = code.toString().trim();

    console.log('🔍 Verifying code:', {
      code: normalizedCode,
      action,
      userId: req.user._id,
      username: req.user.username
    });

    // Find verification record
    const verification = await db.verificationCodes.findOne({
      code: normalizedCode,
      action,
      userId: req.user._id,
      used: false,
    });

    console.log('📝 Found verification:', verification ? 'YES' : 'NO');
    if (verification) {
      console.log('📋 Verification details:', {
        code: verification.code,
        action: verification.action,
        used: verification.used,
        expiresAt: verification.expiresAt
      });
    }

    if (!verification) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or already used verification code' 
      });
    }

    // Check expiration
    if (new Date(verification.expiresAt) < new Date()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired' 
      });
    }

    // Mark as used
    await db.verificationCodes.update(
      { _id: verification._id },
      { $set: { used: true, usedAt: new Date().toISOString() } }
    );

    console.log('✅ Code verified successfully');

    res.json({
      success: true,
      message: 'Verification successful',
      verificationId: verification._id,
      targetId: verification.targetId,
    });
  } catch (err) {
    console.error('Verify code error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Resend code (generate new one, invalidate old)
router.post('/resend', auth, adminOrCompliance, async (req, res) => {
  try {
    const { action, targetId } = req.body;

    // Invalidate any existing unused codes for this action
    await db.verificationCodes.update(
      { 
        userId: req.user._id, 
        action, 
        targetId, 
        used: false 
      },
      { $set: { used: true, usedAt: new Date().toISOString() } },
      { multi: true }
    );

    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const verification = await db.verificationCodes.insert({
      code,
      userId: req.user._id,
      userName: req.user.username,
      action,
      targetId: targetId || null,
      email: ALL_ADMIN_EMAILS,
      used: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    // Send email
    await sendVerificationCode(code, action, req.user.username);

    // Log the code to console for development
    console.log('\n🔐 ==================== RESEND');
    console.log(`📧 NEW VERIFICATION CODE: ${code}`);
    console.log(`👤 User: ${req.user.username}`);
    console.log(`🎯 Action: ${action}`);
    console.log(`⏰ Expires: ${new Date(verification.expiresAt).toLocaleTimeString()}`);
    console.log('🔐 ====================\n');

    res.json({
      success: true,
      message: `New verification code sent to ${ALL_ADMIN_EMAILS}`,
      codeId: verification._id,
      expiresAt: verification.expiresAt,
    });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
